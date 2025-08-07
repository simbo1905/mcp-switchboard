#!/bin/bash
# Clean modules with dependency-aware ordering
# Usage: ./clean_modules.sh [TARGETS=module1,module2,module3]
# Default: Clean all modules in dependency order

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Define module dependency order (downstream modules depend on upstream)
# Clean order is REVERSE of build order to avoid dependency conflicts
MODULES_REVERSE_ORDER=(
    "mcp-switchboard-ui"  # Main app (depends on bindings + mcp-core)
    "binding-generator"   # Bindings (depends on mcp-core) 
    "mcp-core"           # Core library (no dependencies)
)

# Parse targets from environment or use all modules
if [[ -n "${TARGETS:-}" ]]; then
    IFS=',' read -ra TARGET_MODULES <<< "$TARGETS"
    echo "🎯 Cleaning specific targets: ${TARGET_MODULES[*]}"
else
    TARGET_MODULES=("${MODULES_REVERSE_ORDER[@]}")
    echo "🧹 Cleaning all modules in dependency order"
fi

function clean_module() {
    local module=$1
    echo ""
    echo "=== CLEANING MODULE: $module ==="
    
    case $module in
        "mcp-core")
            echo "📦 Delegating to mcp-core clean command..."
            cd mcp-core
            if cargo clean > /tmp/clean-mcp-core.log 2>&1; then
                echo "✅ cargo clean completed"
            else
                echo "❌ cargo clean failed"
                cat /tmp/clean-mcp-core.log
                return 1
            fi
            cd ..
            ;;
            
        "binding-generator")
            echo "🔄 Delegating to binding-generator clean command..."
            cd binding-generator
            if cargo clean > /tmp/clean-binding-generator.log 2>&1; then
                echo "✅ cargo clean completed"
            else
                echo "❌ cargo clean failed" 
                cat /tmp/clean-binding-generator.log
                return 1
            fi
            cd ..
            ;;
            
        "mcp-switchboard-ui")
            echo "🖥️  Delegating to mcp-switchboard-ui clean command..."
            cd mcp-switchboard-ui
            if npm run clean > /tmp/clean-mcp-switchboard-ui.log 2>&1; then
                echo "✅ npm run clean completed"
            else
                echo "❌ npm run clean failed"
                cat /tmp/clean-mcp-switchboard-ui.log
                return 1
            fi
            cd ..
            ;;
            
        *)
            echo "❌ Unknown module: $module"
            return 1
            ;;
    esac
    
    # Clean shared build artifacts (coordination logic, not module logic)
    rm -f /tmp/build-info-${module}.json
    rm -f /tmp/build-${module}.properties
    echo "✅ Shared build artifacts cleaned"
    
    echo "✅ Module $module cleaned successfully"
}

function verify_clean() {
    echo ""
    echo "=== VERIFYING CLEAN STATE ==="
    
    # Check cargo target directories
    local cargo_targets=0
    for module in mcp-core binding-generator mcp-switchboard-ui/src-tauri; do
        if [[ -d "$module/target" ]]; then
            echo "❌ $module/target still exists"
            cargo_targets=$((cargo_targets + 1))
        else
            echo "✅ $module/target removed"
        fi
    done
    
    # Check build artifacts
    local build_artifacts=0
    for artifact in /tmp/build-info-*.json /tmp/build-*.properties; do
        if [[ -f "$artifact" ]]; then
            echo "❌ Build artifact still exists: $artifact"
            build_artifacts=$((build_artifacts + 1))
        fi
    done
    
    if [[ $build_artifacts -eq 0 ]]; then
        echo "✅ All build artifacts removed"
    fi
    
    # Check TypeScript bindings
    if [[ -f "mcp-switchboard-ui/src/bindings.ts" ]]; then
        echo "❌ TypeScript bindings still exist"
        return 1
    else
        echo "✅ TypeScript bindings removed"
    fi
    
    # Check node_modules
    if [[ -d "mcp-switchboard-ui/node_modules" ]]; then
        echo "❌ node_modules still exists"
        return 1
    else
        echo "✅ node_modules removed"
    fi
    
    local total_issues=$((cargo_targets + build_artifacts))
    if [[ $total_issues -eq 0 ]]; then
        echo ""
        echo "🎉 CLEAN VERIFICATION PASSED - All artifacts removed"
        return 0
    else
        echo ""
        echo "⚠️  CLEAN VERIFICATION FAILED - $total_issues issues found"
        return 1
    fi
}

# Main execution
echo "🧹 MODULE CLEANING SYSTEM"
echo "Working directory: $(pwd)"
echo "Timestamp: $(date)"

# Clean each target module in dependency order
for module in "${TARGET_MODULES[@]}"; do
    if clean_module "$module"; then
        echo "✅ $module cleaning completed"
    else
        echo "❌ $module cleaning failed"
        exit 1
    fi
done

# Verify everything is clean
if verify_clean; then
    echo ""
    echo "🎯 ALL MODULES CLEANED SUCCESSFULLY"
    echo "Ready for fresh builds with: npm run generate-bindings"
    exit 0
else
    echo ""
    echo "❌ CLEAN VERIFICATION FAILED"
    exit 1
fi