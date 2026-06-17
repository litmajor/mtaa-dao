#!/usr/bin/env bash
# Build and optionally push a production Docker image using Dockerfile.prod
# Usage:
#   ./scripts/docker-build-prod.sh my-registry/my-image:tag [push]

set -euo pipefail
IMAGE=${1:-mtaa-dao:latest}
PUSH=${2:-}

echo "Building ${IMAGE} using Dockerfile.prod..."
docker build -f Dockerfile.prod -t "${IMAGE}" .

echo "Built ${IMAGE}"
if [ "${PUSH}" = "push" ]; then
  echo "Pushing ${IMAGE} to registry..."
  docker push "${IMAGE}"
fi
