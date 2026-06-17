Freqtrade Wrapper — server/tools/freqtrade_wrapper.py

Purpose
- Provide a lightweight subprocess wrapper that the Node.js backend can spawn
  to run Freqtrade backtests or optimizations. This wrapper intentionally
  calls the installed Freqtrade CLI or a container image — it does NOT fork
  or vend the Freqtrade code.

Do NOT fork Freqtrade
---------------------
Forking Freqtrade is unnecessary and costly: you would inherit the burden of
maintaining every upstream bugfix and security patch. Instead, install the
official package (or use the official Docker image) and call it from this
wrapper. The wrapper is the correct seam between our TypeScript server and
the Python-based backtest engine.

Quick start (recommended)
-------------------------
1) Install Freqtrade locally (dev) or use the official Docker image (prod):

   # pip install (local/dev)
   pip install freqtrade

   # or use the official Docker image (recommended for isolation)
   docker pull freqtradeorg/freqtrade:stable

2) Download historical data for backtesting (example):

   freqtrade download-data \
     --exchange binance \
     --pairs BTC/USDT ETH/USDT SOL/USDT \
     --timeframes 1h 4h \
     --timerange 20230101-20241231

3) Configure env vars for the wrapper and server (example):

   # point to the CLI binary (or a wrapper script that calls the CLI)
   export FREQTRADE_CLI=freqtrade

   # optional: path to a freqtrade config.json
   export FREQTRADE_CONFIG=/path/to/user_data/config.json

   # optional: strategies dir where your strategy files live (the wrapper
   # will write a strategy file here if you pass source in the payload)
   export FREQTRADE_STRATEGIES_DIR=/path/to/user_data/strategies

   # optionally force mock (useful for CI/dev without Freqtrade available)
   export FREQTRADE_MODE=mock

4) Run the wrapper end-to-end (example):

   echo '{"strategyId":"test","pair":"BTC/USDT","timeframe":"1h","timerange":"20230101-20231231","stakeAmount":100}' \
     | python server/tools/freqtrade_wrapper.py

Notes on live trading
---------------------
Freqtrade is ideal for backtesting and strategy validation. For production
live execution on Celo DEXes (Ubeswap / Mento) you should NOT force Freqtrade
to execute on-chain directly unless you implement a custom exchange adapter
that maps Freqtrade's exchange interface to your on-chain execution layer
(YUKI). Writing a custom adapter is preferable to forking.

Example custom exchange (sketch)

  # user_data/freqtrade_user_data/exchange/celo_dex.py
  from freqtrade.exchange import Exchange

  class CeloDex(Exchange):
      def fetch_ticker(self, pair: str) -> dict:
          # call your on-chain price oracle or YUKI service
          ...

      def create_order(self, pair, ordertype, side, amount, rate=None, params={}):
          # route order creation through YUKI
          ...

Production invocation template
------------------------------
You can set `FREQTRADE_INVOCATION_TEMPLATE` to control the exact CLI form.
Default template used by the wrapper:

  '{freqtrade_cli} backtesting --strategy {strategy_name} --strategy-path {strategies_dir} --timerange {timerange} --config {config} --export json --datadir {datadir}'

Security and isolation
----------------------
- Prefer running backtests in an isolated environment (Docker) to avoid
  contaminating host resource caches.
- Do not mount host secrets into strategy data directories used by the
  wrapper without careful review.

Docker Compose example
----------------------
Below is a minimal `docker-compose.yml` service example showing how you might
expose a small wrapper container that the Node server can `docker run` to
perform backtests. This is illustrative — adapt volumes, paths and the image
to match your infra.

services:
  freqtrade-backtest:
    image: ghcr.io/your-org/freqtrade-backtest:latest
    environment:
      - TZ=UTC
    volumes:
      - ./strategies:/app/strategies:ro
      - /var/lib/data:/data
    entrypoint: ["/app/entrypoint.sh"]

Docker image example
---------------------
If you'd like a ready-to-build example, the repository includes a small
Docker image under `server/tools/docker/` which installs `freqtrade` and
exposes an `entrypoint.sh` that reads stdin and calls an inner wrapper.

Build and run locally (example):

  docker build -t mtaa/freqtrade-wrapper server/tools/docker

  # Run the container and pipe a payload
  echo '{"strategyId":"test","timerange":"2020-01-01:2020-12-31"}' | \
    docker run --rm -i mtaa/freqtrade-wrapper


How Node invokes Docker mode
- Set `FREQTRADE_DOCKER_IMAGE=ghcr.io/your-org/freqtrade-backtest:latest`
- The wrapper will run `docker run --rm <image> ...` and the image should
  accept a payload on stdin and output JSON with `metrics` to stdout.

Security notes
- Running arbitrary containers or commands from the server requires careful
  consideration. Run wrapper containers in an isolated environment, avoid
  mounting sensitive host paths, and ensure resource limits are enforced.
