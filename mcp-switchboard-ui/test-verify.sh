#!/bin/bash

# Integration Test Runner - Full test suite with Lima
# Follows Maven-style pattern: fast tests + integration tests

set -euo pipefail

# Configuration
VERIFY_LOG=".lima-state/verify-tests.log"
ARTIFACTS_DIR=".lima-state/verify-artifacts"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
PROJECT_NAME="mcp-switchboard-ui"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure state directory exists
mkdir -p .lima-state
rm -rf "$ARTIFACTS_DIR" || true
mkdir -p "$ARTIFACTS_DIR"

# Initialize log
echo "=== Integration Test Run - $TIMESTAMP ===" > "$VERIFY_LOG"

log() {
    local level="$1"
    shift
    local message="$*"
    echo "[$TIMESTAMP] [$level] $message" >> "$VERIFY_LOG"
    
    case "$level" in
        ERROR)
            echo -e "${RED}❌ $message${NC}" >&2
            ;;
        SUCCESS)
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        WARNING)
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        INFO)
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        *)
            echo "$message"
            ;;
    esac
}

# Track results
FAST_TESTS_RESULT=0
LIMA_SETUP_RESULT=0
BUILD_RESULT=0
E2E_RESULT=0
START_TIME=$(date +%s)

echo "=== Integration Test Runner - Full Test Suite ==="
log INFO "Starting comprehensive test suite"

# Phase 1: Fast Tests
echo
log INFO "Phase 1: Running fast tests..."
if ./test-fast.sh 2>&1 | tee -a "$VERIFY_LOG"; then
    log SUCCESS "Fast tests passed"
    FAST_TESTS_RESULT=0
else
    log ERROR "Fast tests failed - stopping integration tests"
    FAST_TESTS_RESULT=1
    
    echo
    log ERROR "INTEGRATION TESTS SKIPPED - Fix fast tests first"
    echo "📝 Run: npm test"
    echo "📝 Check logs: $VERIFY_LOG"
    exit 1
fi

# Phase 2: Lima Verification
echo
log INFO "Phase 2: Checking Lima availability..."

# First do a fast check
if ./lima-check.sh 2>&1 | tee -a "$VERIFY_LOG"; then
    log SUCCESS "Lima is ready"
    LIMA_SETUP_RESULT=0
else
    check_result=$?
    case $check_result in
        1)
            log ERROR "Lima prerequisites missing"
            LIMA_SETUP_RESULT=1
            echo
            echo "Prerequisites not met:"
            echo "📝 Install Lima: brew install lima"
            echo "📝 Then setup: npm run lima:setup"
            echo "📝 Check logs: $VERIFY_LOG"
            exit 1
            ;;
        2)
            log WARNING "Lima setup required"
            LIMA_SETUP_RESULT=1
            echo
            echo "Lima setup needed:"
            echo "📝 Run: npm run lima:setup"
            echo "📝 Or: ./lima-manager.sh setup"
            echo "📝 Check logs: $VERIFY_LOG"
            exit 2
            ;;
        *)
            log ERROR "Lima check failed unexpectedly"
            LIMA_SETUP_RESULT=1
            exit 1
            ;;
    esac
fi

# Phase 3: Build in Lima
echo
log INFO "Phase 3: Building application in Lima..."

./lima-manager.sh start 2>&1 | tee -a "$VERIFY_LOG" || {
    log ERROR "Failed to start Lima instance"
    exit 1
}

PROJECT_DIR="$(pwd)"

limactl shell tauri-test bash -c "
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
" 2>&1 | tee -a "$VERIFY_LOG"

if [ "${PIPESTATUS[0]}" -eq 0 ]; then
    log SUCCESS "Linux build completed"
    BUILD_RESULT=0
else
    log ERROR "Linux build failed"
    BUILD_RESULT=1
fi

# Phase 4: E2E Tests (only if build succeeded)
if [ $BUILD_RESULT -eq 0 ]; then
    echo
    log INFO "Phase 4: Running E2E tests in Lima..."
    
    # Start tauri-driver in background
    limactl shell tauri-test bash -c "
    set -euo pipefail
    cd '$PROJECT_DIR'
    source ~/.cargo/env
    
    echo 'Killing any existing tauri-driver processes...'
    pkill -f tauri-driver || true
    sleep 2
    
    echo 'Starting tauri-driver on port 4444...'
    tauri-driver --port 4444 > .lima-state/tauri-driver.log 2>&1 &
    DRIVER_PID=\$!
    echo \$DRIVER_PID > .lima-state/tauri-driver.pid
    
    echo 'Waiting for tauri-driver to be ready...'
    for i in {1..30}; do
        if curl -s http://localhost:4444/status > /dev/null 2>&1; then
            echo 'tauri-driver is ready'
            exit 0
        fi
        sleep 1
    done
    
    echo 'tauri-driver failed to start'
    exit 1
    " 2>&1 | tee -a "$VERIFY_LOG"
    
    if [ "${PIPESTATUS[0]}" -eq 0 ]; then
        log SUCCESS "tauri-driver started"
        
        # Run E2E tests
        limactl shell tauri-test bash -c "
        set -euo pipefail
        cd '$PROJECT_DIR'
        
        echo 'Running E2E tests...'
        export DISPLAY=:99
        Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
        XVFB_PID=\$!
        
        sleep 2
        
        node src-tauri/tests/e2e-basic.js 2>&1
        TEST_RESULT=\$?
        
        kill \$XVFB_PID || true
        
        exit \$TEST_RESULT
        " 2>&1 | tee -a "$VERIFY_LOG"
        
        E2E_RESULT=${PIPESTATUS[0]}
        
        if [ "$E2E_RESULT" -eq 0 ]; then
            log SUCCESS "E2E tests passed"
        else
            log ERROR "E2E tests failed"
        fi
        
        # Cleanup tauri-driver
        limactl shell tauri-test bash -c "
        cd '$PROJECT_DIR'
        if [ -f .lima-state/tauri-driver.pid ]; then
            DRIVER_PID=\$(cat .lima-state/tauri-driver.pid)
            kill \$DRIVER_PID || true
            rm -f .lima-state/tauri-driver.pid
        fi
        pkill -f tauri-driver || true
        " 2>/dev/null || true
        
    else
        log ERROR "Failed to start tauri-driver"
        E2E_RESULT=1
    fi
    
    # Copy artifacts from Lima
    log INFO "Collecting test artifacts..."
    limactl shell tauri-test bash -c "
    cd '$PROJECT_DIR'
    mkdir -p .lima-state/artifacts-temp
    cp -f *.png .lima-state/artifacts-temp/ 2>/dev/null || true
    cp -f .lima-state/*.log .lima-state/artifacts-temp/ 2>/dev/null || true
    " 2>/dev/null || true
    
    # Copy to local artifacts directory
    cp -r .lima-state/artifacts-temp/* "$ARTIFACTS_DIR/" 2>/dev/null || true
    
else
    log WARNING "Skipping E2E tests due to build failure"
    E2E_RESULT=1
fi

# Calculate final results
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
TOTAL_FAILURES=$((FAST_TESTS_RESULT + LIMA_SETUP_RESULT + BUILD_RESULT + E2E_RESULT))

echo
echo "=== Integration Test Results ==="
echo "Duration: ${DURATION}s"

log SUCCESS "Fast Tests: PASSED" 
log SUCCESS "Lima Setup: READY"

if [ $BUILD_RESULT -eq 0 ]; then
    log SUCCESS "Linux Build: PASSED"
else
    log ERROR "Linux Build: FAILED"
fi

if [ "$E2E_RESULT" -eq 0 ]; then
    log SUCCESS "E2E Tests: PASSED"
else
    log ERROR "E2E Tests: FAILED"
fi

echo
if [ $TOTAL_FAILURES -eq 0 ]; then
    log SUCCESS "🎉 ALL INTEGRATION TESTS PASSED ($DURATION seconds)"
    echo "✨ Ready for production deployment"
    echo "📦 Linux binary available at: src-tauri/target/release/$PROJECT_NAME"
    exit 0
else
    log ERROR "💥 $TOTAL_FAILURES INTEGRATION TEST(S) FAILED"
    echo "📝 Check logs: $VERIFY_LOG"
    echo "📁 Artifacts: $ARTIFACTS_DIR/"
    echo
    echo "Troubleshooting:"
    echo "- Fast tests: npm test"
    echo "- Lima setup: npm run lima:setup"
    echo "- Lima status: npm run lima:verify"
    exit $TOTAL_FAILURES
fi