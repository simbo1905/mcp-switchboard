#!/bin/bash

# Check build status script - monitors all just build processes
# Conventions:
# - PID files: build-runtime/{command}.pid
# - Log files: build-runtime/{command}.log

echo "🔍 Build Status Check - $(date)"
echo "=================================="

# Find all just PID files
pid_files=(build-runtime/*.pid)
running_count=0
completed_count=0

if [ ! -e "${pid_files[0]}" ]; then
    echo "📭 No just build processes found (no PID files)"
    echo ""
    echo "💡 Available build commands:"
    echo "   just build-core"
    echo "   just build-generator" 
    echo "   just build-ui"
    echo "   just build"
    exit 0
fi

echo "📋 Process Status:"
echo "------------------"

for pid_file in "${pid_files[@]}"; do
    if [ -f "$pid_file" ]; then
        command_name=$(basename "$pid_file" .pid)
        pid=$(cat "$pid_file" 2>/dev/null)
        log_file="build-runtime/${command_name}.log"
        
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            # Process is running
            echo "🟢 $command_name (PID: $pid) - RUNNING"
            running_count=$((running_count + 1))
            
            if [ -f "$log_file" ]; then
                last_modified=$(stat -f "%Sm" -t "%H:%M:%S" "$log_file" 2>/dev/null || echo "unknown")
                echo "   Log: $log_file (last updated: $last_modified)"
                echo "   Last 3 lines:"
                tail -3 "$log_file" 2>/dev/null | sed 's/^/     /'
            fi
        else
            # Process completed or died
            echo "⚫ $command_name (PID: $pid) - COMPLETED/STOPPED"
            completed_count=$((completed_count + 1))
            
            if [ -f "$log_file" ]; then
                last_modified=$(stat -f "%Sm" -t "%H:%M:%S" "$log_file" 2>/dev/null || echo "unknown")
                file_size=$(stat -f "%z" "$log_file" 2>/dev/null || echo "0")
                echo "   Log: $log_file (${file_size} bytes, completed: $last_modified)"
                
                # Check for success/failure indicators
                if grep -q "✅.*built" "$log_file" 2>/dev/null; then
                    echo "   Result: ✅ SUCCESS"
                elif grep -q "error:" "$log_file" 2>/dev/null; then
                    echo "   Result: ❌ ERROR"
                    echo "   Last error:"
                    grep "error:" "$log_file" | tail -1 | sed 's/^/     /'
                else
                    echo "   Result: ❓ Unknown (may have been interrupted)"
                fi
            fi
        fi
        echo ""
    fi
done

echo "📊 Summary:"
echo "-----------"
echo "🟢 Running: $running_count"
echo "⚫ Completed: $completed_count"

# Check for build artifacts
echo ""
echo "📦 Build Artifacts:"
echo "-------------------"
property_files=(/tmp/build-*.properties)
if [ -e "${property_files[0]}" ]; then
    for prop_file in "${property_files[@]}"; do
        if [ -f "$prop_file" ]; then
            module=$(basename "$prop_file" | sed 's/build-\(.*\)\.properties/\1/')
            fingerprint=$(grep "^FINGERPRINT=" "$prop_file" 2>/dev/null | cut -d'=' -f2)
            build_time=$(grep "^BUILD_TIME=" "$prop_file" 2>/dev/null | cut -d'=' -f2)
            echo "📁 $module: ${fingerprint:0:16}... ($build_time)"
        fi
    done
else
    echo "   No build property files found"
fi

echo ""
echo "💡 Tip: Use 'tail -f build-runtime/{command}.log' to follow active builds"