#!/bin/bash
# Clean development shutdown script

echo "Shutting down all development processes..."

# Function to kill processes from PID file
kill_from_pid_file() {
    local pid_file=$1
    local desc=$2
    
    if [ -f "$pid_file" ]; then
        while read -r pid; do
            if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
                echo "Killing $desc process $pid"
                kill -TERM "$pid" 2>/dev/null
            fi
        done < "$pid_file"
        rm -f "$pid_file"
    fi
}

# Kill all tracked processes
kill_from_pid_file "./main.pid" "main"
kill_from_pid_file "./npm-dev.pid" "npm dev" 
kill_from_pid_file "./vite.pid" "vite"
kill_from_pid_file "./cargo.pid" "cargo"

# Also kill any remaining processes by name
pkill -f "cargo run" || true
pkill -f "npm run dev" || true
pkill -f "vite" || true
pkill -f "tauri dev" || true
pkill -f "npm run tauri" || true

# Wait 3 seconds for graceful shutdown
echo "Waiting 3 seconds for graceful shutdown..."
sleep 3

# Force kill any stubborn processes
echo "Force killing any remaining processes..."
pkill -9 -f "cargo run" || true
pkill -9 -f "npm run dev" || true
pkill -9 -f "vite" || true
pkill -9 -f "tauri dev" || true
pkill -9 -f "npm run tauri" || true

echo "Cleanup complete"