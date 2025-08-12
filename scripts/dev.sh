#!/usr/bin/env bash
set -euo pipefail

npm --prefix backend run build
node backend/dist/scripts/start.js &
BACK_PID=$!

npm --prefix frontend run dev &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID" EXIT

wait
