#!/bin/bash

# Comprehensive test runner for all test suites
# Combines macOS unit tests, frontend tests, and Lima-based E2E tests

set -euo pipefail

TEST_ALL_LOG="./test-all-results.log"
ARTIFACTS_DIR="./test-all-artifacts"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

echo "=== Comprehensive Test Suite Runner ==="
echo "Timestamp: $TIMESTAMP"

# Clean up previous runs
rm -f "$TEST_ALL_LOG" || true
rm -rf "$ARTIFACTS_DIR" || true
mkdir -p "$ARTIFACTS_DIR"

# Track test results
UNIT_TESTS_RESULT=0
FRONTEND_TESTS_RESULT=0
E2E_TESTS_RESULT=0

echo "Starting comprehensive test suite..." | tee "$TEST_ALL_LOG"

# Test 1: macOS Backend Unit Tests
echo "" | tee -a "$TEST_ALL_LOG"
echo "=== Running macOS Backend Unit Tests ===" | tee -a "$TEST_ALL_LOG"
if ./test-models.sh 2>&1 | tee -a "$TEST_ALL_LOG"; then
    echo "✅ Backend unit tests started successfully" | tee -a "$TEST_ALL_LOG"
    
    # Wait for backend tests to complete
    echo "Waiting for backend tests to complete..." | tee -a "$TEST_ALL_LOG"
    if [ -f "./test.pid" ]; then
        TEST_PID=$(cat ./test.pid)
        while kill -0 "$TEST_PID" 2>/dev/null; do
            sleep 2
        done
        
        # Check results
        if grep -q "test result: ok" ./test.log 2>/dev/null; then
            echo "✅ Backend unit tests passed" | tee -a "$TEST_ALL_LOG"
            UNIT_TESTS_RESULT=0
        else
            echo "❌ Backend unit tests failed" | tee -a "$TEST_ALL_LOG"
            UNIT_TESTS_RESULT=1
        fi
        
        # Copy backend test logs
        cp ./test.log "$ARTIFACTS_DIR/backend-tests-$TIMESTAMP.log" 2>/dev/null || true
    else
        echo "⚠️  Backend test PID file not found" | tee -a "$TEST_ALL_LOG"
        UNIT_TESTS_RESULT=1
    fi
else
    echo "❌ Failed to start backend unit tests" | tee -a "$TEST_ALL_LOG"
    UNIT_TESTS_RESULT=1
fi

# Test 2: Frontend Unit Tests
echo "" | tee -a "$TEST_ALL_LOG"
echo "=== Running Frontend Unit Tests ===" | tee -a "$TEST_ALL_LOG"
if npm run test:run 2>&1 | tee -a "$TEST_ALL_LOG"; then
    echo "✅ Frontend unit tests passed" | tee -a "$TEST_ALL_LOG"
    FRONTEND_TESTS_RESULT=0
else
    echo "❌ Frontend unit tests failed" | tee -a "$TEST_ALL_LOG"
    FRONTEND_TESTS_RESULT=1
fi

# Test 3: Lima-based E2E Tests
echo "" | tee -a "$TEST_ALL_LOG"
echo "=== Running Lima-based E2E Tests ===" | tee -a "$TEST_ALL_LOG"
if ./test-e2e-lima.sh 2>&1 | tee -a "$TEST_ALL_LOG"; then
    echo "✅ E2E tests passed" | tee -a "$TEST_ALL_LOG"
    E2E_TESTS_RESULT=0
    
    # Copy E2E artifacts
    if [ -d "./e2e-artifacts" ]; then
        cp -r ./e2e-artifacts/* "$ARTIFACTS_DIR/" 2>/dev/null || true
    fi
else
    echo "❌ E2E tests failed" | tee -a "$TEST_ALL_LOG"
    E2E_TESTS_RESULT=1
    
    # Copy E2E artifacts even on failure
    if [ -d "./e2e-artifacts" ]; then
        cp -r ./e2e-artifacts/* "$ARTIFACTS_DIR/" 2>/dev/null || true
    fi
fi

# Generate final summary
echo "" | tee -a "$TEST_ALL_LOG"
echo "=== Test Suite Summary ===" | tee -a "$TEST_ALL_LOG"
echo "Timestamp: $TIMESTAMP" | tee -a "$TEST_ALL_LOG"

if [ $UNIT_TESTS_RESULT -eq 0 ]; then
    echo "✅ Backend Unit Tests: PASSED" | tee -a "$TEST_ALL_LOG"
else
    echo "❌ Backend Unit Tests: FAILED" | tee -a "$TEST_ALL_LOG"
fi

if [ $FRONTEND_TESTS_RESULT -eq 0 ]; then
    echo "✅ Frontend Unit Tests: PASSED" | tee -a "$TEST_ALL_LOG"
else
    echo "❌ Frontend Unit Tests: FAILED" | tee -a "$TEST_ALL_LOG"
fi

if [ $E2E_TESTS_RESULT -eq 0 ]; then
    echo "✅ E2E Tests (Lima): PASSED" | tee -a "$TEST_ALL_LOG"
else
    echo "❌ E2E Tests (Lima): FAILED" | tee -a "$TEST_ALL_LOG"
fi

# Calculate overall result
TOTAL_FAILURES=$((UNIT_TESTS_RESULT + FRONTEND_TESTS_RESULT + E2E_TESTS_RESULT))

if [ $TOTAL_FAILURES -eq 0 ]; then
    echo "" | tee -a "$TEST_ALL_LOG"
    echo "🎉 ALL TESTS PASSED" | tee -a "$TEST_ALL_LOG"
    echo "Results: $TEST_ALL_LOG"
    echo "Artifacts: $ARTIFACTS_DIR/"
    exit 0
else
    echo "" | tee -a "$TEST_ALL_LOG"
    echo "💥 $TOTAL_FAILURES TEST SUITE(S) FAILED" | tee -a "$TEST_ALL_LOG"
    echo "Results: $TEST_ALL_LOG"
    echo "Artifacts: $ARTIFACTS_DIR/"
    exit $TOTAL_FAILURES
fi