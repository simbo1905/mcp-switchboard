#!/bin/bash

# Fast Test Runner - Local tests only (no Lima required)
# Follows Maven-style pattern for quick development feedback

set -euo pipefail

# Configuration
FAST_TEST_LOG=".lima-state/fast-tests.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure state directory exists
mkdir -p .lima-state

# Initialize log
echo "=== Fast Test Run - $TIMESTAMP ===" > "$FAST_TEST_LOG"

log() {
    local level="$1"
    shift
    local message="$*"
    echo "[$TIMESTAMP] [$level] $message" >> "$FAST_TEST_LOG"
    
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
FRONTEND_RESULT=0
BACKEND_RESULT=0
START_TIME=$(date +%s)

echo "=== Fast Test Runner - Local Tests Only ==="
log INFO "Starting fast test suite (no Lima required)"

# Test 1: Frontend Unit Tests
echo
log INFO "Running frontend unit tests..."
if npm run test:run 2>&1 | tee -a "$FAST_TEST_LOG"; then
    log SUCCESS "Frontend unit tests passed"
    FRONTEND_RESULT=0
else
    log ERROR "Frontend unit tests failed"
    FRONTEND_RESULT=1
fi

# Test 2: Backend Unit Tests
echo
log INFO "Running backend unit tests..."

# Clean up any previous backend test processes
pkill -f "cargo test" || true
rm -f ./test.pid || true

cd src-tauri
if cargo test --no-default-features 2>&1 | tee -a "../$FAST_TEST_LOG"; then
    log SUCCESS "Backend unit tests passed"
    BACKEND_RESULT=0
else
    log ERROR "Backend unit tests failed"
    BACKEND_RESULT=1
fi
cd ..

# Calculate results
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
TOTAL_FAILURES=$((FRONTEND_RESULT + BACKEND_RESULT))

echo
echo "=== Fast Test Results ==="
echo "Duration: ${DURATION}s"

if [ $FRONTEND_RESULT -eq 0 ]; then
    log SUCCESS "Frontend Tests: PASSED"
else
    log ERROR "Frontend Tests: FAILED"
fi

if [ $BACKEND_RESULT -eq 0 ]; then
    log SUCCESS "Backend Tests: PASSED"
else
    log ERROR "Backend Tests: FAILED"
fi

echo
if [ $TOTAL_FAILURES -eq 0 ]; then
    log SUCCESS "ALL FAST TESTS PASSED ($DURATION seconds)"
    echo "✨ Ready for development"
    echo "📝 Run 'npm run verify' for full integration tests"
    exit 0
else
    log ERROR "$TOTAL_FAILURES TEST SUITE(S) FAILED"
    echo "📝 Check logs: $FAST_TEST_LOG"
    echo "🔧 Fix failing tests before running 'npm run verify'"
    exit $TOTAL_FAILURES
fi