#!/bin/bash
# Clean development restart script

# Function to kill processes from PID file
kill_from_pid_file() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        while read -r pid; do
            if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
                echo "Killing existing process $pid from $pid_file"
                kill -TERM "$pid" 2>/dev/null
            fi
        done < "$pid_file"
        rm -f "$pid_file"
    fi
}

# Clean up any existing processes and files
echo "Cleaning up existing processes..."
kill_from_pid_file "./main.pid"
kill_from_pid_file "./npm-dev.pid" 
kill_from_pid_file "./vite.pid"
kill_from_pid_file "./cargo.pid"

# Clean up logs and any remaining pid files
find . \( -name "*.log" -o -name "*.pid" \) -print0 | xargs -0 rm -f

# Kill any hanging processes by name
pkill -f "cargo run" || true
pkill -f "tauri dev" || true  
pkill -f "npm run tauri" || true
pkill -f "vite" || true

# Start fresh dev session in background
npm run tauri dev > ./build.log 2>&1 & 
MAIN_PID=$!
echo $MAIN_PID > ./main.pid

# Function to capture PIDs with progressive waiting
capture_pids() {
    local pattern=$1
    local pid_file=$2
    local desc=$3
    
    # Try immediately
    if pgrep -f "$pattern" > "$pid_file" 2>/dev/null; then
        echo "Found $desc processes immediately"
        return 0
    fi
    
    # Wait 1s and try again
    sleep 1
    if pgrep -f "$pattern" > "$pid_file" 2>/dev/null; then
        echo "Found $desc processes after 1s"
        return 0
    fi
    
    # Wait 3s more and try again
    sleep 3
    if pgrep -f "$pattern" > "$pid_file" 2>/dev/null; then
        echo "Found $desc processes after 4s total"
        return 0
    fi
    
    # Wait 5s more and try again
    sleep 5
    if pgrep -f "$pattern" > "$pid_file" 2>/dev/null; then
        echo "Found $desc processes after 9s total"
        return 0
    fi
    
    # Give up
    echo "ERROR: Could not find $desc processes after 9s - build may have failed"
    echo "no $desc process found" > "$pid_file"
    return 1
}

echo "Waiting for child processes to spawn..."
capture_pids "npm run dev" "./npm-dev.pid" "npm dev"
capture_pids "vite" "./vite.pid" "vite"  
capture_pids "cargo run" "./cargo.pid" "cargo"

echo "Build started with main PID $MAIN_PID"
echo "PID files created: main.pid, npm-dev.pid, vite.pid, cargo.pid"
echo "Check ./build.log for progress"
echo "Use: tail -f ./build.log to monitor"
echo "Use: ./dev-shutdown.sh to stop all processes"