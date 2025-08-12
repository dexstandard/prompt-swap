#!/usr/bin/env bash
set -euo pipefail

npm --prefix backend run build
npm --prefix backend run start &
BACK_PID=$!

npm --prefix frontend run dev &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID" EXIT

wait
