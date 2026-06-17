#!/usr/bin/env python3
"""
Inner wrapper run inside the Docker image. Expects a payload JSON file path
as first arg and calls the installed `freqtrade` CLI with sensible defaults.
"""
import json
import os
import shlex
import subprocess
import sys
import traceback


def main():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"metrics": None, "error": "missing_payload_path"}))
            sys.exit(1)

        payload_path = sys.argv[1]
        with open(payload_path, 'r', encoding='utf8') as f:
            payload = json.load(f)

        freq_cli = os.environ.get('FREQTRADE_CLI', 'freqtrade')
        strategies_dir = os.environ.get('FREQTRADE_STRATEGIES_DIR', '/app/strategies')
        config = os.environ.get('FREQTRADE_CONFIG', '/app/config.json')
        datadir = os.environ.get('FREQTRADE_DATADIR', '/tmp')

        strategy_name = payload.get('strategyName') or payload.get('strategyId') or ''
        timerange = payload.get('timerange', '')

        cmd = (
            f"{freq_cli} backtesting --strategy {shlex.quote(strategy_name)}"
            f" --strategy-path {shlex.quote(strategies_dir)}"
            f" --timerange {shlex.quote(timerange)}"
            f" --config {shlex.quote(config)}"
            f" --export json --datadir {shlex.quote(datadir)}"
        )

        parts = shlex.split(cmd)
        proc = subprocess.run(parts, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=900)

        if proc.returncode != 0:
            sys.stderr.write(proc.stderr.decode('utf8', errors='replace'))
            print(json.dumps({"metrics": None, "error": "freqtrade_cli_failed"}))
            sys.exit(0)

        out = proc.stdout.decode('utf8', errors='replace').strip()

        # If freqtrade printed JSON metrics / trades, forward them; otherwise
        # wrap raw output in a diagnostic envelope.
        try:
            parsed = json.loads(out)
            # If parsed contains metrics, pass through; else wrap
            if isinstance(parsed, dict) and parsed.get('metrics'):
                print(json.dumps(parsed))
            else:
                print(json.dumps({"metrics": parsed}))
        except Exception:
            print(json.dumps({"metrics": None, "note": "non_json_cli_output"}))

    except Exception as exc:
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({"metrics": None, "error": str(exc)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
