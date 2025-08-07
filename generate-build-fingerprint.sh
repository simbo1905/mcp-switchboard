#!/bin/bash
# Generate build fingerprint for a module
# Usage: ./generate-build-fingerprint.sh <module_name> <source_dir>

MODULE_NAME="$1"
SOURCE_DIR="$2"

if [ -z "$MODULE_NAME" ] || [ -z "$SOURCE_DIR" ]; then
    echo "Usage: $0 <module_name> <source_dir>"
    echo "Example: $0 mcp-core /Users/Shared/mcp-switchboard/mcp-core"
    exit 1
fi

echo "Generating build fingerprint for $MODULE_NAME..."

# Create fingerprint from all source files
FINGERPRINT=$(find "$SOURCE_DIR" -type f \( -name "*.rs" -o -name "*.toml" \) -exec cat {} \; | sha256sum | cut -d' ' -f1)

# Get git commit SHA
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Get build timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create build info JSON
BUILD_INFO=$(cat <<EOF
{
  "module": "$MODULE_NAME",
  "fingerprint": "$FINGERPRINT",
  "git_commit": "$GIT_SHA", 
  "build_time": "$BUILD_TIME",
  "source_files": [
$(find "$SOURCE_DIR" -type f \( -name "*.rs" -o -name "*.toml" \) | sed 's/.*/"&"/' | paste -sd, -)
  ]
}
EOF
)

# Write to build info file
BUILD_INFO_FILE="/tmp/build-info-$MODULE_NAME.json"
echo "$BUILD_INFO" > "$BUILD_INFO_FILE"

echo "✅ Build fingerprint: $FINGERPRINT"
echo "✅ Git commit: $GIT_SHA"  
echo "✅ Build time: $BUILD_TIME"
echo "✅ Build info written to: $BUILD_INFO_FILE"

# Also create a simple properties file for shell scripts
cat > "/tmp/build-$MODULE_NAME.properties" <<EOF
MODULE=$MODULE_NAME
FINGERPRINT=$FINGERPRINT
GIT_SHA=$GIT_SHA
BUILD_TIME=$BUILD_TIME
EOF

echo "$FINGERPRINT"