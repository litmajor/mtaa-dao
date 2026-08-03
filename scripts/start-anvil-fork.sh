#!/usr/bin/env bash
# Start Anvil fork using ANVIL_FORK_RPC (or ANVIL_RPC_URL) environment variable
# Usage: ANVIL_FORK_RPC=<rpc> ./scripts/start-anvil-fork.sh

set -euo pipefail
RPC=${ANVIL_FORK_RPC:-${ANVIL_RPC_URL:-}}
BLOCK=${ANVIL_FORK_BLOCK:-}
PORT=${ANVIL_FORK_PORT:-8545}

if [ -z "$RPC" ]; then
  echo "ANVIL_FORK_RPC or ANVIL_RPC_URL must be set to the upstream RPC to fork from"
  exit 1
fi

CMD=(anvil --fork-url "$RPC" -p "$PORT")
if [ -n "$BLOCK" ]; then
  CMD+=(--fork-block-number "$BLOCK")
fi

echo "Starting anvil fork on port $PORT for RPC: $RPC"
exec "${CMD[@]}"
