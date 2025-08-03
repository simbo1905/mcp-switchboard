#!/bin/bash

# Complete Test Script - Handles Everything From Scratch
# This is the ONLY script you need to run - it does everything automatically

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level="$1"
    shift
    local message="$*"
    
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
    esac
}

echo "=== Complete Test Suite - Handles Everything Automatically ==="
echo

# Step 1: Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    log ERROR "This requires macOS (Lima virtualization)"
    log INFO "Current OS: $OSTYPE"
    exit 1
fi

log SUCCESS "Running on macOS"

# Step 2: Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    log ERROR "Homebrew is required but not installed"
    log INFO "Install from: https://brew.sh"
    log INFO "Then run this script again"
    exit 1
fi

log SUCCESS "Homebrew is installed"

# Step 3: Install Lima if missing
if ! command -v limactl &> /dev/null; then
    log INFO "Installing Lima..."
    if brew install lima; then
        log SUCCESS "Lima installed"
    else
        log ERROR "Failed to install Lima"
        exit 1
    fi
else
    log SUCCESS "Lima is already installed"
fi

# Step 4: Install Lima guest agents if missing
if ! brew list lima-additional-guestagents &>/dev/null; then
    log INFO "Installing Lima guest agents (required for Linux VMs)..."
    if brew install lima-additional-guestagents; then
        log SUCCESS "Lima guest agents installed"
    else
        log ERROR "Failed to install Lima guest agents"
        exit 1
    fi
else
    log SUCCESS "Lima guest agents already installed"
fi

# Step 5: Destroy any existing broken Lima instance
log INFO "Cleaning up any existing Lima instances..."
if limactl list 2>/dev/null | grep -q "tauri-test"; then
    log INFO "Destroying existing tauri-test instance..."
    limactl delete tauri-test --force 2>/dev/null || true
fi

log SUCCESS "Lima environment clean"

# Step 6: Run fast local tests first
echo
log INFO "Step 1: Running fast local tests..."
if ./test-fast.sh; then
    log SUCCESS "Fast local tests passed"
else
    log ERROR "Fast local tests failed - fix these first"
    exit 1
fi

# Step 7: Setup Lima and run full test suite
echo
log INFO "Step 2: Setting up Lima and running full test suite..."
if ./test-verify.sh; then
    log SUCCESS "All tests passed (local + Linux E2E)"
else
    log ERROR "Integration tests failed"
    echo
    log INFO "Check logs: .lima-state/verify-tests.log"
    log INFO "Check artifacts: .lima-state/verify-artifacts/"
    exit 1
fi

echo
log SUCCESS "🎉 ALL TESTS PASSED - SYSTEM IS READY"
echo
echo "Summary:"
echo "✅ Fast local tests (frontend + backend)"
echo "✅ Lima environment setup"
echo "✅ Linux build verification"
echo "✅ End-to-end WebDriver tests"
echo
echo "You can now run:"
echo "  npm test          # Fast local tests only"
echo "  npm run verify    # Full test suite"