#!/bin/bash
set -e

cd /opt/qa_timeoff

echo "=== Deploy started: $(date) ==="

git fetch origin
git reset --hard origin/main

docker compose down
docker compose up -d --build

docker compose ps

echo "=== Deploy finished: $(date) ==="
