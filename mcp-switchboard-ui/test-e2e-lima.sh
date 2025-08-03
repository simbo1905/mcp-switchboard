#!/bin/bash

# Lima-based E2E test runner for Tauri application
# Builds the app in Lima and runs WebDriver tests

set -euo pipefail

PROJECT_DIR="$(pwd)"
PROJECT_NAME="mcp-switchboard-ui"
TEST_LOG="./e2e-lima.log"
DRIVER_PID_FILE="./tauri-driver.pid"
ARTIFACTS_DIR="./e2e-artifacts"

echo "=== Lima-based E2E Testing for Tauri Application ==="

# Clean up previous runs
rm -f "$TEST_LOG" "$DRIVER_PID_FILE" || true
rm -rf "$ARTIFACTS_DIR" || true
mkdir -p "$ARTIFACTS_DIR"

# Ensure Lima environment is ready
echo "Setting up Lima environment..."
if ! ./setup-lima-env.sh; then
    echo "❌ Failed to setup Lima environment"
    exit 1
fi

echo "Building Tauri application in Lima..."

# Build the application inside Lima
limactl shell default bash -c "
set -euo pipefail
set -x

cd '$PROJECT_DIR'

echo 'Installing npm dependencies if needed...'
if [ ! -d node_modules ]; then
    npm install
fi

echo 'Building Tauri application for Linux...'
source ~/.cargo/env
npm run tauri build

echo 'Verifying build artifacts...'
ls -la src-tauri/target/release/
test -f src-tauri/target/release/$PROJECT_NAME || (echo 'Build failed - binary not found' && exit 1)

echo 'Build completed successfully'
" 2>&1 | tee "$TEST_LOG"

if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    echo "❌ Failed to build Tauri application in Lima"
    exit 1
fi

echo "Starting tauri-driver inside Lima..."

# Start tauri-driver in background
limactl shell default bash -c "
set -euo pipefail

cd '$PROJECT_DIR'
source ~/.cargo/env

echo 'Killing any existing tauri-driver processes...'
pkill -f tauri-driver || true
sleep 2

echo 'Starting tauri-driver on port 4444...'
tauri-driver --port 4444 > tauri-driver.log 2>&1 &
DRIVER_PID=\$!
echo \$DRIVER_PID > tauri-driver.pid

echo 'Waiting for tauri-driver to be ready...'
for i in {1..30}; do
    if curl -s http://localhost:4444/status > /dev/null 2>&1; then
        echo 'tauri-driver is ready'
        exit 0
    fi
    sleep 1
done

echo 'tauri-driver failed to start or become ready'
exit 1
" 2>&1 | tee -a "$TEST_LOG"

if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    echo "❌ Failed to start tauri-driver"
    exit 1
fi

echo "Running E2E tests..."

# Run the E2E tests inside Lima
limactl shell default bash -c "
set -euo pipefail

cd '$PROJECT_DIR'

echo 'Running WebDriver E2E tests...'
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
XVFB_PID=\$!

sleep 2

node src-tauri/tests/e2e-basic.js 2>&1
TEST_RESULT=\$?

kill \$XVFB_PID || true

exit \$TEST_RESULT
" 2>&1 | tee -a "$TEST_LOG"

TEST_EXIT_CODE=${PIPESTATUS[0]}

echo "Cleaning up tauri-driver..."

# Stop tauri-driver
limactl shell default bash -c "
cd '$PROJECT_DIR'
if [ -f tauri-driver.pid ]; then
    DRIVER_PID=\$(cat tauri-driver.pid)
    kill \$DRIVER_PID || true
    rm -f tauri-driver.pid
fi
pkill -f tauri-driver || true
" 2>/dev/null || true

echo "Copying test artifacts from Lima..."

# Copy artifacts from Lima to host
limactl shell default bash -c "
cd '$PROJECT_DIR'
mkdir -p e2e-artifacts
cp -f *.png e2e-artifacts/ 2>/dev/null || true
cp -f *.log e2e-artifacts/ 2>/dev/null || true
" 2>/dev/null || true

# Copy artifacts to local artifacts directory
if [ -d e2e-artifacts ]; then
    cp -r e2e-artifacts/* "$ARTIFACTS_DIR/" 2>/dev/null || true
fi

# Final results
if [ "$TEST_EXIT_CODE" -eq 0 ]; then
    echo "✅ E2E tests completed successfully"
    echo "Check $TEST_LOG for detailed output"
    echo "Test artifacts available in $ARTIFACTS_DIR/"
    exit 0
else
    echo "❌ E2E tests failed (exit code: $TEST_EXIT_CODE)"
    echo "Check $TEST_LOG for error details"
    echo "Test artifacts available in $ARTIFACTS_DIR/"
    exit "$TEST_EXIT_CODE"
fi