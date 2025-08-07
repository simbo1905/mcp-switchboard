#!/usr/bin/env bash
set -euo pipefail

COMMAND="$1"
LOGFILE="/tmp/just-${COMMAND}-$(date +%s).log"
PIDFILE="/tmp/just-${COMMAND}.pid"

echo "🔐 Approval required to run: just $COMMAND"
echo "   Log file: $LOGFILE"
echo "   PID file: $PIDFILE"
read -p "Approve? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Command rejected"
    exit 1
fi

echo "✅ Approved. Running: just $COMMAND"

# Run just command with output redirection and PID tracking
(
    echo $$ > "$PIDFILE"
    exec just "$COMMAND" > "$LOGFILE" 2>&1
) &

JUST_PID=$!
echo "🏃 Running with PID: $JUST_PID"

# Tail the log file while command runs
tail -f "$LOGFILE" &
TAIL_PID=$!

# Wait for just command to complete
wait $JUST_PID
EXIT_CODE=$?

# Kill the tail process
kill $TAIL_PID 2>/dev/null || true

rm -f "$PIDFILE"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Command completed successfully"
    echo "📋 Full output saved to: $LOGFILE"
else
    echo "❌ Command failed with exit code: $EXIT_CODE"
    echo "📋 Check log file: $LOGFILE"
    echo "Last 20 lines:"
    tail -20 "$LOGFILE"
fi

exit $EXIT_CODE