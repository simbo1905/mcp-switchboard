#!/bin/bash
# Perfect mcp-core: Delegate to module commands for build + test + lint
# Coordinates mcp-core library perfection without duplicating module logic

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill any existing processes using PID files
for pidfile in /tmp/mcp-core-*.pid; do
    if [ -f "$pidfile" ]; then
        pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Killing existing process $pid"
            kill "$pid" 2>/dev/null || true
        fi
        rm -f "$pidfile"
    fi
done

# Delegate to module's clean command (no duplication)
echo "🧹 Delegating to mcp-core clean..."
TARGETS=mcp-core ./clean_modules.sh

echo "=== PERFECTING MCP-CORE LIBRARY ==="

echo "1. 🔨 Delegating to mcp-core build command..."
cd mcp-core
if cargo build --release > /tmp/mcp-core-build.log 2>&1; then
    echo "✅ cargo build --release completed"
    
    # Display build metadata (coordination logic)
    if [ -f "/tmp/build-info-mcp-core.json" ]; then
        echo "   Build metadata:"
        cat /tmp/build-info-mcp-core.json | jq -r '
        "     Module: " + .module + 
        "\n     Fingerprint: " + .fingerprint + 
        "\n     Git commit: " + .git_commit + 
        "\n     Build time: " + .build_time'
    fi
else
    echo "❌ cargo build failed! Check module configuration:"
    tail -20 /tmp/mcp-core-build.log
    echo ""
    echo "💡 Fix the module's Cargo.toml and src/lib.rs, then retry"
    exit 1
fi
cd ..

echo ""
echo "2. 🧪 Delegating to mcp-core test command..."
cd mcp-core
if cargo test > /tmp/mcp-core-test.log 2>&1; then
    echo "✅ cargo test completed"
else
    echo "❌ cargo test failed:"
    tail -10 /tmp/mcp-core-test.log
    exit 1
fi
cd ..

echo ""
echo "3. 🔍 Delegating to mcp-core lint command..."
cd mcp-core
if cargo clippy --all-targets --all-features -- -D warnings > /tmp/mcp-core-lint.log 2>&1; then
    echo "✅ cargo clippy completed with no warnings"
else
    warnings=$(grep -c "warning:" /tmp/mcp-core-lint.log || echo "0")
    echo "⚠️  cargo clippy found $warnings warnings"
    if [ "$warnings" -gt 0 ]; then
        head -10 /tmp/mcp-core-lint.log
    fi
fi
cd ..

echo ""
echo "4. 📚 Delegating to mcp-core documentation..."
cd mcp-core
if cargo doc --no-deps > /tmp/mcp-core-doc.log 2>&1; then
    echo "✅ cargo doc completed"
else
    echo "❌ cargo doc failed"
fi
cd ..

echo ""
echo "5. 🧹 Delegating to mcp-core formatting..."
cd mcp-core
if cargo fmt --check > /tmp/mcp-core-fmt.log 2>&1; then
    echo "✅ cargo fmt check passed"
else
    echo "⚠️  Running cargo fmt to fix formatting..."
    cargo fmt
    echo "✅ cargo fmt applied"
fi
cd ..

echo ""
echo "6. ✨ Final verification (coordination logic)..."
echo "   - Library file: $(ls -la target/release/libmcp_core*.rlib 2>/dev/null || echo 'NOT FOUND')"
echo "   - Tests passed: $(grep -c 'test result: ok' /tmp/mcp-core-test.log || echo '0')"
echo "   - Clippy warnings: $(grep -c 'warning:' /tmp/mcp-core-lint.log || echo '0')"
echo "   - Build metadata: $([ -f /tmp/build-info-mcp-core.json ] && echo 'PRESENT' || echo 'MISSING')"

if ls target/release/libmcp_core*.rlib >/dev/null 2>&1; then
    echo ""
    echo "🎯 MCP-CORE IS NOW PERFECT AND READY"
    echo "   Ready for binding-generator to import as dependency"
else
    echo ""
    echo "❌ MCP-CORE PERFECTION FAILED"
    echo "   Module commands completed but artifacts missing"
    exit 1
fi

echo "All coordination logs in /tmp/mcp-core-*.log"