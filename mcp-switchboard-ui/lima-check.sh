#!/bin/bash

# Fast Lima Availability Checker
# Quick prerequisite check for Lima-based testing
# Exit codes: 0=ready, 1=missing prerequisites, 2=setup needed

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LIMA_INSTANCE_NAME="tauri-test"

# Quick logging
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

# Check if we're on macOS
check_macos() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log ERROR "Lima testing requires macOS"
        log INFO "Current OS: $OSTYPE"
        return 1
    fi
    return 0
}

# Check if Lima is installed
check_lima_installed() {
    if ! command -v limactl &> /dev/null; then
        log ERROR "Lima is not installed"
        log INFO "Install with: brew install lima"
        log INFO "Then run: npm run lima:setup"
        return 1
    fi
    return 0
}

# Check Lima version compatibility
check_lima_version() {
    local lima_version
    lima_version=$(limactl --version 2>/dev/null | head -n1 | grep -o '[0-9]\+\.[0-9]\+' || echo "unknown")
    
    if [[ "$lima_version" == "unknown" ]]; then
        log WARNING "Could not determine Lima version"
        return 0
    fi
    
    # Extract major version (we need at least v0.20 for reliable operation)
    local major_version
    major_version=$(echo "$lima_version" | cut -d. -f1)
    local minor_version
    minor_version=$(echo "$lima_version" | cut -d. -f2)
    
    if [[ "$major_version" -eq 0 && "$minor_version" -lt 20 ]]; then
        log WARNING "Lima version $lima_version may be too old (recommend v0.20+)"
        log INFO "Consider updating: brew upgrade lima"
        return 0
    fi
    
    log SUCCESS "Lima version $lima_version is compatible"
    
    # Check if lima-additional-guestagents is installed (required for Linux VMs)
    if command -v brew &> /dev/null; then
        if ! brew list lima-additional-guestagents &>/dev/null; then
            log WARNING "lima-additional-guestagents not installed"
            log INFO "Required for Linux VM support"
            return 0
        fi
    fi
    
    return 0
}

# Check if tauri-test instance exists and is ready
check_lima_instance() {
    if ! limactl list 2>/dev/null | grep -q "^$LIMA_INSTANCE_NAME"; then
        log WARNING "Lima instance '$LIMA_INSTANCE_NAME' does not exist"
        log INFO "Run: npm run lima:setup"
        return 2
    fi
    
    if ! limactl list 2>/dev/null | grep "^$LIMA_INSTANCE_NAME" | grep -q "Running"; then
        log WARNING "Lima instance '$LIMA_INSTANCE_NAME' is not running"
        log INFO "Run: npm run lima:setup"
        return 2
    fi
    
    log SUCCESS "Lima instance '$LIMA_INSTANCE_NAME' is running"
    return 0
}

# Main check function
main() {
    echo "=== Lima Availability Check ==="
    
    # Platform check
    if ! check_macos; then
        echo
        log ERROR "Platform requirements not met"
        return 1
    fi
    
    # Lima installation check
    if ! check_lima_installed; then
        echo
        log ERROR "Lima installation missing"
        echo
        echo "To fix:"
        echo "1. Install Lima: brew install lima"
        echo "2. Setup instance: npm run lima:setup"
        return 1
    fi
    
    # Version compatibility check
    check_lima_version
    
    # Instance availability check
    local instance_result
    check_lima_instance
    instance_result=$?
    
    echo
    case $instance_result in
        0)
            log SUCCESS "Lima is ready for testing"
            log INFO "You can run: npm run verify"
            return 0
            ;;
        2)
            log WARNING "Lima setup required"
            echo
            echo "To fix:"
            echo "1. Setup Lima: npm run lima:setup" 
            echo "2. Verify setup: npm run lima:verify"
            echo "3. Run tests: npm run verify"
            return 2
            ;;
        *)
            log ERROR "Lima instance check failed"
            return 1
            ;;
    esac
}

# Show usage if requested
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Lima Availability Checker"
    echo
    echo "Usage: $0"
    echo
    echo "Exit codes:"
    echo "  0 = Lima is ready for testing"
    echo "  1 = Missing prerequisites (install Lima)"
    echo "  2 = Setup required (run lima:setup)"
    echo
    echo "Quick fix commands:"
    echo "  brew install lima     # Install Lima"
    echo "  npm run lima:setup    # Setup test instance"
    echo "  npm run lima:verify   # Verify setup"
    exit 0
fi

# Run the check
main