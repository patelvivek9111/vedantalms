#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${MONGO_CI_CONTAINER_NAME:-ci-mongodb}"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
