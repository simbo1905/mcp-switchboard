#!/bin/bash
# Perfect binding-generator: Delegate to module commands for build + run
# Coordinates binding-generator binary perfection without duplicating module logic

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill any existing processes using PID files
for pidfile in /tmp/binding-generator-*.pid; do
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
echo "🧹 Delegating to binding-generator clean..."
TARGETS=binding-generator ./clean_modules.sh

echo "=== PERFECTING BINDING-GENERATOR BINARY ==="

echo "1. 🔨 Delegating to binding-generator build command..."
cd binding-generator
if cargo build --release > /tmp/binding-generator-build.log 2>&1; then
    echo "✅ cargo build --release completed"
else
    echo "❌ cargo build failed! Check module configuration:"
    tail -20 /tmp/binding-generator-build.log
    echo ""
    echo "💡 Fix the module's Cargo.toml and src/main.rs, then retry"
    exit 1
fi
cd ..

echo ""
echo "2. 🧪 Delegating to binding-generator run command..."

# Verify mcp-core dependency (coordination logic)
echo "   Verifying mcp-core dependency..."
if [ -f "/tmp/build-mcp-core.properties" ]; then
    MCP_CORE_FINGERPRINT=$(grep "FINGERPRINT=" /tmp/build-mcp-core.properties | cut -d'=' -f2)
    echo "   Upstream mcp-core fingerprint: $MCP_CORE_FINGERPRINT"
else
    echo "   ⚠️  mcp-core build info not found - continuing anyway"
fi

cd binding-generator
if cargo run --release > /tmp/binding-generator-run.log 2>&1; then
    echo "✅ cargo run --release completed"
    
    # Display generation output for observability (coordination logic)
    echo "   Generation log:"
    cat /tmp/binding-generator-run.log | sed 's/^/     /'
    
    # Verify artifacts created (coordination logic)
    if [ -f "../mcp-switchboard-ui/src/bindings.ts" ]; then
        echo "✅ TypeScript bindings file created"
        lines=$(wc -l < "../mcp-switchboard-ui/src/bindings.ts")
        echo "   Generated $lines lines of TypeScript bindings"
        
        # Show build fingerprint in bindings
        echo "   Bindings header:"
        head -3 "../mcp-switchboard-ui/src/bindings.ts" | sed 's/^/     /'
        
        # Display build metadata
        if [ -f "/tmp/build-info-binding-generator.json" ]; then
            echo "   Build metadata:"
            cat /tmp/build-info-binding-generator.json | jq -r '
            "     Module: " + .module + 
            "\n     Fingerprint: " + .fingerprint + 
            "\n     Dependencies verified: " + (.dependencies | map(.verified) | all | tostring)'
        fi
    else
        echo "❌ TypeScript bindings file not found"
        exit 1
    fi
else
    echo "❌ cargo run failed!"
    cat /tmp/binding-generator-run.log
    exit 1
fi
cd ..

echo ""
echo "3. 🔍 Delegating to binding-generator lint command..."
cd binding-generator
if cargo clippy --all-targets --all-features -- -D warnings > /tmp/binding-generator-lint.log 2>&1; then
    echo "✅ cargo clippy completed with no warnings"
else
    warnings=$(grep -c "warning:" /tmp/binding-generator-lint.log || echo "0")
    echo "⚠️  cargo clippy found $warnings warnings"
    if [ "$warnings" -gt 0 ]; then
        head -10 /tmp/binding-generator-lint.log
    fi
fi
cd ..

echo ""
echo "4. ✨ Final verification (coordination logic)..."
echo "   - Binary file: $(ls -la target/release/binding-generator 2>/dev/null || echo 'NOT FOUND')"
echo "   - TypeScript bindings: $(ls -la mcp-switchboard-ui/src/bindings.ts 2>/dev/null || echo 'NOT FOUND')"
echo "   - Build metadata: $([ -f /tmp/build-info-binding-generator.json ] && echo 'PRESENT' || echo 'MISSING')"

if [ -f "target/release/binding-generator" ] && [ -f "mcp-switchboard-ui/src/bindings.ts" ]; then
    echo ""
    echo "🎯 BINDING-GENERATOR IS NOW PERFECT AND READY"
    echo "   Ready for mcp-switchboard-ui to use generated TypeScript bindings"
else
    echo ""
    echo "❌ BINDING-GENERATOR PERFECTION FAILED"
    echo "   Module commands completed but artifacts missing"
    exit 1
fi

echo "All coordination logs in /tmp/binding-generator-*.log"