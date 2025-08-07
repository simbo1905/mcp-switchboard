#!/bin/bash
# Monitor the perfect-mcp-core.sh progress

echo "=== MCP-CORE PERFECTION MONITOR ==="

# Check if any processes are running
for pidfile in /tmp/mcp-core-*.pid; do
    if [ -f "$pidfile" ]; then
        pid=$(cat "$pidfile")
        process=$(basename "$pidfile" .pid | sed 's/mcp-core-//')
        if kill -0 "$pid" 2>/dev/null; then
            echo "✅ $process running (PID: $pid)"
            case "$process" in
                "build")
                    echo "   Latest: $(tail -1 /tmp/mcp-core-build.log | grep -o 'Compiling [^[:space:]]*' | tail -1)"
                    ;;
                "test")
                    echo "   Latest: $(tail -1 /tmp/mcp-core-test.log | grep -o 'test [^[:space:]]*' | tail -1)"
                    ;;
                "clippy")
                    echo "   Latest: $(tail -1 /tmp/mcp-core-lint.log | grep -o 'Checking [^[:space:]]*' | tail -1)"
                    ;;
            esac
        else
            echo "❌ $process finished"
            rm -f "$pidfile"
        fi
    fi
done

# Check logs for completion status
echo ""
echo "=== LOG STATUS ==="
for log in build test lint doc fmt; do
    logfile="/tmp/mcp-core-$log.log"
    if [ -f "$logfile" ]; then
        size=$(wc -l < "$logfile")
        echo "$log: $size lines"
        
        # Check for completion markers
        case "$log" in
            "build")
                if grep -q "Finished release" "$logfile"; then
                    echo "   ✅ BUILD COMPLETE"
                elif grep -q "error:" "$logfile"; then
                    echo "   ❌ BUILD FAILED"
                    tail -3 "$logfile" | head -2
                fi
                ;;
            "test")
                if grep -q "test result: ok" "$logfile"; then
                    echo "   ✅ TESTS PASSED"
                elif grep -q "test result: FAILED" "$logfile"; then
                    echo "   ❌ TESTS FAILED"
                fi
                ;;
            "lint")
                if grep -q "warning:" "$logfile"; then
                    warnings=$(grep -c "warning:" "$logfile")
                    echo "   ⚠️  $warnings WARNINGS"
                elif [ $size -gt 10 ]; then
                    echo "   ✅ CLIPPY CLEAN"
                fi
                ;;
        esac
    else
        echo "$log: not started"
    fi
done