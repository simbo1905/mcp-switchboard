#!/bin/bash

# Comprehensive test runner for both frontend and backend tests
# Follows project build monitoring patterns - starts in background and returns

set -euo pipefail
set -x

echo "Starting comprehensive test suite..."

# Clean up any previous test runs
rm -f ./test-all.log || true
rm -f ./test-all.pid || true
rm -f ./test.log || true
rm -f ./test.pid || true
pkill -f "cargo test" || true
pkill -f "vitest" || true

echo "Running all tests (frontend + backend) in background..."

# Start comprehensive tests in background
(
  echo "=== Frontend Tests (Spotlight Search) ===" 
  npm run test:run 2>&1
  echo ""
  echo "=== Backend Tests (Model Management) ==="
  cd src-tauri && cargo test tests --no-default-features 2>&1
) > ./test-all.log 2>&1 &

TEST_PID=$!
echo $TEST_PID > ./test-all.pid

echo "All tests started with PID $TEST_PID"
echo "Check ./test-all.log for progress"
echo "Use: tail -f ./test-all.log to monitor"
echo "Use: kill $TEST_PID to stop tests"

# Return immediately like dev-restart.sh does