#!/bin/bash

# Model management unit test runner
# Follows project build monitoring patterns - starts in background and returns

set -euo pipefail
set -x

echo "Starting model management unit tests..."

# Clean up any previous test runs
rm -f ./test.log || true
rm -f ./test.pid || true
pkill -f "cargo test" || true

echo "Running model management unit tests in background..."

# Start tests in background
(cd src-tauri && cargo test tests --no-default-features > ../test.log 2>&1) &
TEST_PID=$!
echo $TEST_PID > ./test.pid

echo "Tests started with PID $TEST_PID"
echo "Check ./test.log for progress"
echo "Use: tail -f ./test.log to monitor"
echo "Use: kill $TEST_PID to stop tests"

# Return immediately like dev-restart.sh does