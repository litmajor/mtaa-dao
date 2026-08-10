#!/usr/bin/env bash
# Installs the local-only dependencies required by the Mtaa security suite.
# Everything runs against a local EVM; no network deployment is touched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v forge >/dev/null 2>&1; then
  curl -L https://foundry.paradigm.xyz | bash
  # shellcheck disable=SC1090
  export PATH="$PATH:$HOME/.foundry/bin"
  foundryup
fi

if [ ! -d lib/forge-std ]; then
  git clone --depth 1 https://github.com/foundry-rs/forge-std.git lib/forge-std
fi

if [ ! -d node_modules/@openzeppelin/contracts ] || [ ! -d node_modules/@openzeppelin/contracts-upgradeable ]; then
  npm install --no-save @openzeppelin/contracts@5.4.0 @openzeppelin/contracts-upgradeable@5.4.0
fi

forge build
echo "Security suite ready:  forge test -vv"
