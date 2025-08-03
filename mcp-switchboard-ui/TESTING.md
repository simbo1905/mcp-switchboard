# Testing Guide - Industrial Grade

This document provides clear instructions for testing the MCP Switchboard UI with proper validation and error handling.

## Quick Start - First Time Setup

### 1. Prerequisites Check
```bash
# Check if your system is ready for Lima testing
./lima-check.sh
```

**Expected outcomes:**
- ✅ Success (exit code 0): Ready to run tests
- ⚠️  Setup needed (exit code 2): Run setup commands below  
- ❌ Missing prerequisites (exit code 1): Install Lima first

### 2. Install Lima (if needed)
```bash
# Install Lima and required guest agents via Homebrew
brew install lima
brew install lima-additional-guestagents

# Verify installation
./lima-check.sh
```

### 3. Setup Lima Environment (one-time)
```bash
# Comprehensive setup with validation
npm run lima:setup

# This runs: ./lima-manager.sh setup
# - Validates macOS version, Lima version, disk space
# - Creates dedicated "tauri-test" Lima instance  
# - Installs Rust, Node.js, tauri-driver, system dependencies
# - Takes ~10-15 minutes on first run
```

### 4. Verify Setup
```bash
# Quick verification
npm run lima:verify

# This runs: ./lima-manager.sh verify
# - Checks instance is running
# - Validates all dependencies installed
# - Fast execution (~30 seconds)
```

## Daily Development Testing

### Fast Local Tests (< 30 seconds)
```bash
# Run during development - no Lima required
npm test

# This runs: ./test-fast.sh
# - Frontend unit tests (Vitest)
# - Backend unit tests (Cargo)
# - Local only, very fast feedback
```

### Full Integration Tests (2-5 minutes)
```bash
# Run before commits/PRs - includes Linux E2E tests
npm run verify

# This runs: ./test-verify.sh  
# - Phase 1: Fast tests (same as `npm test`)
# - Phase 2: Lima availability check
# - Phase 3: Linux build in Lima VM
# - Phase 4: WebDriver E2E tests
```

## Testing Order for New Users

**Follow this exact sequence for first-time setup:**

```bash
# Step 1: Check prerequisites (30 seconds)
./lima-check.sh

# Step 2a: If Lima missing, install it
brew install lima

# Step 2b: If Lima installed, setup test environment  
npm run lima:setup
# ⏱️  10-15 minutes (downloads Ubuntu, builds dependencies)

# Step 3: Verify setup worked
npm run lima:verify
# ⏱️  30 seconds

# Step 4: Run fast tests to verify local setup
npm test  
# ⏱️  30 seconds

# Step 5: Run full integration tests
npm run verify
# ⏱️  2-5 minutes (builds Linux binary, runs E2E tests)
```

## Troubleshooting

### Lima Issues

**Problem: Lima check fails**
```bash
# Get detailed status
./lima-manager.sh status

# Check logs
cat .lima-state/lima-manager.log

# If missing guest agents:
brew install lima-additional-guestagents

# Nuclear option - start fresh
npm run lima:destroy
npm run lima:setup
```

**Problem: "tauri-test" instance won't start**
```bash
# Manual instance management
./lima-manager.sh stop
./lima-manager.sh start

# Check if conflicting with default instance
limactl list
```

**Problem: Low disk space warnings**
```bash
# Check available space
df -h ~

# Lima VMs need ~20GB free space
# Clean up if needed, then retry setup
```

### Test Failures

**Fast tests fail:**
```bash
# Check individual components
npm run test:run    # Frontend only
cd src-tauri && cargo test --no-default-features  # Backend only

# Check logs
cat .lima-state/fast-tests.log
```

**Integration tests fail:**
```bash
# Check build artifacts
ls -la .lima-state/verify-artifacts/

# Rebuild Lima environment
npm run lima:destroy
npm run lima:setup
npm run verify
```

## Script Reference

| Script | Purpose | Duration | Dependencies |
|--------|---------|----------|--------------|
| `./lima-check.sh` | Fast prerequisite check | 5s | None |
| `./lima-manager.sh setup` | One-time Lima setup | 10-15min | Lima installed |
| `./lima-manager.sh verify` | Validate Lima ready | 30s | Lima setup |
| `./test-fast.sh` | Local unit tests | 30s | None |
| `./test-verify.sh` | Full integration suite | 2-5min | Lima ready |

## Exit Codes

All scripts use consistent exit codes:
- **0**: Success - operation completed
- **1**: Error - something failed, check logs  
- **2**: Setup needed - run setup commands

## State Management

**State directory:** `.lima-state/`
- `lima-manager.log` - All Lima operations
- `fast-tests.log` - Local test results
- `verify-tests.log` - Integration test results
- `verify-artifacts/` - Screenshots, build logs
- `instance.json` - Lima instance metadata
- `last-verify.json` - Last verification status

**Log rotation:** Logs are rotated at 10MB to prevent disk bloat.

## CI/CD Integration

```bash
# CI should run full verification
npm run verify

# Exit codes for CI:
# 0 = All tests passed, ready for deployment
# 1 = Fast tests failed, fix before integration
# 2 = Lima setup needed (shouldn't happen in CI)
```

## Performance Expectations

| Operation | First Run | Subsequent Runs |
|-----------|-----------|-----------------|
| Lima setup | 10-15 min | 2-3 min (if existing) |
| Fast tests | 30-45 sec | 15-30 sec |
| Integration tests | 5-8 min | 2-5 min |
| Lima check | 10-15 sec | 5-10 sec |

Times may vary based on system performance and network speed.