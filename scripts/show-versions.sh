#!/bin/bash

# Show all module versions (Maven-like version management)

echo "📦 MCP Switchboard - All Module Versions"
echo "========================================"

modules="mcp-core binding-generator mcp-switchboard-ui"

for module in $modules; do
    if [ -f "/tmp/build-$module.properties" ]; then
        echo ""
        echo "📁 $module:"
        while IFS='=' read -r key value || [ -n "$key" ]; do
            case "$key" in
                MODULE) echo "   Name: $value" ;;
                FINGERPRINT) echo "   Fingerprint: ${value:0:16}..." ;;
                GIT_SHA) echo "   Git commit: $value" ;;
                GIT_HEADLINE) echo "   Git headline: $value" ;;
                BUILD_TIME) echo "   Build time: $value" ;;
                *_FINGERPRINT) 
                    dep_name=$(echo "$key" | sed 's/_FINGERPRINT$//')
                    echo "   Dependency $dep_name: ${value:0:8}..."
                    ;;
            esac
        done < "/tmp/build-$module.properties"
    else
        echo ""
        echo "📁 $module: ❌ No build info available"
    fi
done

echo ""
echo "💡 Use 'just build' to generate all version information"
echo "🔗 Use 'just status' for build artifact summary"