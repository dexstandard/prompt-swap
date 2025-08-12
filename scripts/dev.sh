#!/usr/bin/env bash
set -euo pipefail

npm run build
node dist/scripts/start.js &
BACK_PID=$!

npm --prefix frontend run dev &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID" EXIT

wait
