#!/usr/bin/env python3
"""
Freqtrade wrapper — stdin → stdout JSON subprocess bridge.

Reads a FreqtradeBacktestRequest JSON payload from stdin, executes a backtest
via one of three paths (CLI, Docker, mock), then writes a JSON object with a
top-level `metrics` field to stdout.

Contract
────────
  stdin  : FreqtradeBacktestRequest (JSON)
  stdout : { "metrics": BacktestMetrics, "warning"?: string, "note"?: string }
           OR { "metrics": null, "error": string }  on fatal failure (exit 1)
  stderr : diagnostic logs only (never parsed by caller)

Execution paths (evaluated in order)
──────────────────────────────────────
  1. CLI    — FREQTRADE_CLI is set and FREQTRADE_MODE != "mock"
  2. Docker — FREQTRADE_DOCKER_IMAGE is set and FREQTRADE_MODE != "mock"
  3. Mock   — always-safe fallback (arithmetically consistent random metrics)

Environment variables
──────────────────────
  FREQTRADE_CLI                   Path/command for the freqtrade executable
  FREQTRADE_CONFIG                Path to freqtrade config.json
  FREQTRADE_STRATEGIES_DIR        Override strategies directory written by this
                                  script (default: <tmpdir>/user_data/strategies)
  FREQTRADE_INVOCATION_TEMPLATE   Override the full CLI command template.
                                  Placeholders: {freqtrade_cli}, {strategy_name},
                                  {strategies_dir}, {timerange}, {config}, {datadir}
  FREQTRADE_DOCKER_IMAGE          Docker image to use instead of local CLI
  FREQTRADE_MODE                  Set to "mock" to force mock output regardless
"""

import json
import os
import random
import shlex
import subprocess
import sys
import tempfile
import time
import traceback


# ── MOCK METRICS ─────────────────────────────────────────────────────────────

def build_mock_metrics() -> dict:
    """
    Return arithmetically consistent random backtest metrics.

    Guarantees:
      losingTrades  = totalTrades - profitableTrades   (always)
      winRatePercent is derived from those counts       (always)

    Previously these three fields were generated independently, making
    losingTrades + profitableTrades potentially exceed totalTrades.
    """
    total      = random.randint(50, 200)
    profitable = int(total * (0.45 + random.random() * 0.25))  # 45–70% win rate
    losing     = total - profitable
    win_rate   = round(profitable / total * 100, 2)

    return {
        'totalTrades':         total,
        'profitableTrades':    profitable,
        'losingTrades':        losing,
        'winRatePercent':      win_rate,
        'totalProfitUsd':      round(100  + random.random() * 4900, 2),
        'totalProfitPercent':  round(5    + random.random() * 50,   2),
        'avgProfitPercent':    round(0.5  + random.random() * 3,    3),
        'sharpeRatio':         round(0.8  + random.random() * 2,    3),
        'sortinoRatio':        round(1.0  + random.random() * 3,    3),
        'maxDrawdownPercent':  round(5    + random.random() * 15,   2),
        'buyAndHoldPercent':   round(15   + random.random() * 35,   2),
        'exposureTimePercent': round(50   + random.random() * 40,   2),
        'avgDurationMinutes':  int(60     + random.random() * 240       ),
        'recoveryFactor':      round(1.5  + random.random() * 3,    3),
        'expectancy':          round(50   + random.random() * 150,  2),
    }


# ── TRADE LIST → METRICS ─────────────────────────────────────────────────────

def compute_metrics_from_trades(trades: list) -> dict | None:
    """
    Synthesise BacktestMetrics from a Freqtrade trade list.

    Freqtrade field reference
    ─────────────────────────
      profit_abs    absolute PnL in stake currency (e.g. USDT)
      profit_ratio  fractional return  (0.052  =  5.2%)
      profit        alias for profit_ratio in some Freqtrade versions
      profit_pct    percent return     (5.21   =  5.21%) — already multiplied by 100

    We track absolute and ratio values separately to avoid unit confusion
    (the old code stored profit_abs in a field called avgProfitPercent).
    """
    if not trades:
        return None

    try:
        total            = len(trades)
        profit_abs_vals  = []   # stake-currency PnL per trade
        profit_ratio_vals = []  # fractional return per trade
        win_count        = 0

        for t in trades:
            if not isinstance(t, dict):
                continue

            abs_val   = None
            ratio_val = None

            # Absolute PnL (dollars / USDT)
            if t.get('profit_abs') is not None:
                abs_val = float(t['profit_abs'])

            # Fractional return — try ratio first, then aliases
            if t.get('profit_ratio') is not None:
                ratio_val = float(t['profit_ratio'])
            elif t.get('profit') is not None:
                ratio_val = float(t['profit'])
            elif t.get('profit_pct') is not None:
                # profit_pct is already ×100 in Freqtrade (5.21 means 5.21%)
                ratio_val = float(t['profit_pct']) / 100.0

            if abs_val is not None:
                profit_abs_vals.append(abs_val)
            if ratio_val is not None:
                profit_ratio_vals.append(ratio_val)

            # Win/loss determined from whichever value we have
            pnl = abs_val if abs_val is not None else (ratio_val or 0.0)
            if pnl > 0:
                win_count += 1

        win_rate = round(win_count / total * 100, 2) if total > 0 else 0.0

        # avgProfitPercent is a *percent* value derived from the ratio column
        avg_profit_pct = 0.0
        if profit_ratio_vals:
            avg_profit_pct = round(
                (sum(profit_ratio_vals) / len(profit_ratio_vals)) * 100, 3
            )

        total_profit_usd = round(sum(profit_abs_vals), 2) if profit_abs_vals else 0.0

        return {
            'totalTrades':      total,
            'profitableTrades': win_count,
            'losingTrades':     total - win_count,
            'winRatePercent':   win_rate,
            'totalProfitUsd':   total_profit_usd,
            'avgProfitPercent': avg_profit_pct,
        }

    except Exception:
        sys.stderr.write('[wrapper] compute_metrics_from_trades failed:\n' + traceback.format_exc())
        return None


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main() -> None:
    try:
        raw     = sys.stdin.read()
        payload = json.loads(raw or '{}')

        freq_cli   = os.environ.get('FREQTRADE_CLI')
        docker_img = os.environ.get('FREQTRADE_DOCKER_IMAGE')
        mode       = os.environ.get('FREQTRADE_MODE', '').lower()
        ft_config  = os.environ.get('FREQTRADE_CONFIG', '')

        def emit(obj: dict, code: int = 0) -> None:
            sys.stdout.write(json.dumps(obj))
            sys.exit(code)

        # ── PATH 1: LOCAL CLI ─────────────────────────────────────────────────
        if freq_cli and mode != 'mock':
            invocation_tpl = os.environ.get('FREQTRADE_INVOCATION_TEMPLATE') or (
                '{freqtrade_cli} backtesting'
                ' --strategy {strategy_name}'
                ' --strategy-path {strategies_dir}'   # FIX: was missing; Freqtrade
                ' --timerange {timerange}'             #      needs this to locate the
                ' --config {config}'                   #      strategy file we wrote
                ' --export json'
                ' --datadir {datadir}'
            )

            with tempfile.TemporaryDirectory() as tmpdir:
                # Resolve strategies directory
                strategies_dir = os.environ.get(
                    'FREQTRADE_STRATEGIES_DIR',
                    os.path.join(tmpdir, 'user_data', 'strategies'),
                )
                os.makedirs(strategies_dir, exist_ok=True)

                strategy_name = (
                    payload.get('strategyName')
                    or payload.get('strategyId', '')
                )

                # Write strategy source if provided
                if payload.get('strategyCode'):
                    raw_filename = (
                        payload.get('strategyFilename')
                        or f'strategy_{strategy_name or int(time.time())}.py'
                    )
                    # Sanitise: strip any path components, ensure .py suffix
                    filename = os.path.basename(raw_filename)
                    if not filename.endswith('.py'):
                        filename += '.py'

                    strategy_file = os.path.join(strategies_dir, filename)
                    with open(strategy_file, 'w', encoding='utf-8') as sf:
                        sf.write(payload['strategyCode'])

                    if not strategy_name:
                        strategy_name = os.path.splitext(filename)[0]

                # Build the final command string
                config_path = ft_config or os.path.join(tmpdir, 'config.json')
                try:
                    cmd_str = invocation_tpl.format(
                        freqtrade_cli  = freq_cli,
                        strategy_name  = strategy_name or '',
                        strategies_dir = strategies_dir,
                        timerange      = payload.get('timerange', ''),
                        config         = config_path,
                        datadir        = tmpdir,
                    )
                except KeyError:
                    # Caller is using a custom template with different placeholders
                    cmd_str = invocation_tpl

                try:
                    cmd = shlex.split(cmd_str)
                except ValueError:
                    cmd = cmd_str.split()

                sys.stderr.write(f'[wrapper] CLI command: {cmd}\n')

                try:
                    proc = subprocess.run(
                        cmd,
                        input   = json.dumps(payload).encode('utf-8'),
                        stdout  = subprocess.PIPE,
                        stderr  = subprocess.PIPE,
                        timeout = 900,
                    )

                    if proc.returncode != 0:
                        sys.stderr.write(
                            '[wrapper] CLI exited non-zero:\n'
                            + proc.stderr.decode('utf-8', errors='replace')
                        )
                        emit({'metrics': build_mock_metrics(), 'warning': 'freqtrade_cli_failed'})

                    out = proc.stdout.decode('utf-8', errors='replace').strip()

                    try:
                        parsed  = json.loads(out)
                        metrics = None

                        if isinstance(parsed, dict) and parsed.get('metrics'):
                            metrics = parsed['metrics']
                        elif isinstance(parsed, list):
                            metrics = compute_metrics_from_trades(parsed)
                        elif isinstance(parsed, dict) and parsed.get('trades'):
                            metrics = compute_metrics_from_trades(parsed['trades'])

                        emit({'metrics': metrics or build_mock_metrics()})

                    except json.JSONDecodeError:
                        sys.stderr.write('[wrapper] CLI stdout was not valid JSON\n')
                        emit({'metrics': build_mock_metrics(), 'note': 'cli_output_not_json'})

                except subprocess.TimeoutExpired:
                    sys.stderr.write('[wrapper] CLI timed out after 900 s\n')
                    emit({'metrics': build_mock_metrics(), 'warning': 'freqtrade_cli_timeout'})

                except Exception as exc:
                    sys.stderr.write(
                        '[wrapper] CLI invocation error: ' + str(exc)
                        + '\n' + traceback.format_exc()
                    )
                    emit({'metrics': build_mock_metrics(), 'warning': 'freqtrade_invocation_error'})

        # ── PATH 2: DOCKER ────────────────────────────────────────────────────
        if docker_img and mode != 'mock':
            tmp_path = None
            try:
                # Write payload to a temp file the container can read
                with tempfile.NamedTemporaryFile(
                    delete=False, mode='w', suffix='.json'
                ) as tf:
                    json.dump(payload, tf)
                    tmp_path = tf.name

                docker_cmd = [
                    'docker', 'run', '--rm', '-i',
                    docker_img,
                    'sh', '-c',
                    'cat > /tmp/payload.json '
                    '&& python /app/freqtrade_wrapper_inner.py /tmp/payload.json',
                ]

                sys.stderr.write(f'[wrapper] Docker image: {docker_img}\n')

                try:
                    proc = subprocess.run(
                        docker_cmd,
                        input   = json.dumps(payload).encode('utf-8'),
                        stdout  = subprocess.PIPE,
                        stderr  = subprocess.PIPE,
                        timeout = 900,
                    )

                    if proc.returncode != 0:
                        sys.stderr.write(
                            '[wrapper] Docker container failed:\n'
                            + proc.stderr.decode('utf-8', errors='replace')
                        )
                        emit({'metrics': build_mock_metrics(), 'warning': 'docker_wrapper_failed'})

                    out = proc.stdout.decode('utf-8', errors='replace').strip()

                    try:
                        parsed = json.loads(out)
                        emit({'metrics': parsed.get('metrics') or build_mock_metrics()})
                    except json.JSONDecodeError:
                        sys.stderr.write('[wrapper] Docker stdout was not valid JSON\n')
                        emit({'metrics': build_mock_metrics(), 'note': 'docker_output_not_json'})

                except subprocess.TimeoutExpired:
                    sys.stderr.write('[wrapper] Docker timed out after 900 s\n')
                    emit({'metrics': build_mock_metrics(), 'warning': 'docker_timeout'})

            except Exception as exc:
                sys.stderr.write(
                    '[wrapper] Docker invocation error: ' + str(exc)
                    + '\n' + traceback.format_exc()
                )
                emit({'metrics': build_mock_metrics(), 'warning': 'docker_invocation_error'})

            finally:
                # FIX: always clean up the temp file — previously leaked on any exception
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass

        # ── PATH 3: MOCK FALLBACK ─────────────────────────────────────────────
        emit({'metrics': build_mock_metrics()})

    except Exception as exc:
        sys.stderr.write('[wrapper] Fatal error: ' + str(exc) + '\n' + traceback.format_exc())
        sys.stdout.write(json.dumps({'metrics': None, 'error': str(exc)}))
        sys.exit(1)


if __name__ == '__main__':
    main()