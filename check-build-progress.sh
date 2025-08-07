#!/bin/bash
# Checks if cargo build is still running and shows progress
# No arguments needed, just monitors current build status

echo "=== BUILD PROGRESS CHECK ==="
if ps aux | grep -v grep | grep -q "cargo build"; then
    echo "🔄 Still building..."
    echo "Latest compilation lines:"
    tail -5 /tmp/build.log
else
    echo "Build finished. Checking result:"
    if ls target/debug/libmcp_core*.rlib >/dev/null 2>&1; then
        echo "✅ BUILD SUCCESS - mcp-core library built"
        ls -la target/debug/libmcp_core*.rlib
    else
        echo "❌ BUILD FAILED - no library found"
        echo "Last few lines of build log:"
        tail -10 /tmp/build.log
    fi
fi

echo ""
echo "Build log location: /tmp/build.log"