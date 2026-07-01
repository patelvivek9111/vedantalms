#!/usr/bin/env bash
# Start MongoDB for GitHub Actions with retried image pulls (avoids flaky service container pulls).
set -euo pipefail

IMAGE="${MONGO_CI_IMAGE:-mongo:7}"
CONTAINER_NAME="${MONGO_CI_CONTAINER_NAME:-ci-mongodb}"

docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

for attempt in 1 2 3 4 5; do
  if docker pull "$IMAGE"; then
    break
  fi
  echo "docker pull attempt ${attempt} failed; retrying..."
  sleep $((attempt * 10))
  if [ "$attempt" -eq 5 ]; then
    echo "docker pull failed after 5 attempts"
    exit 1
  fi
done

docker run -d --name "$CONTAINER_NAME" -p 27017:27017 "$IMAGE"

for i in $(seq 1 60); do
  if docker exec "$CONTAINER_NAME" mongosh --quiet --eval 'db.adminCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1; then
    echo "MongoDB ready"
    exit 0
  fi
  if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 27017 2>/dev/null; then
    echo "MongoDB port open"
    exit 0
  fi
  sleep 2
done

echo "MongoDB did not become ready"
docker logs "$CONTAINER_NAME" 2>/dev/null || true
exit 1
