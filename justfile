# Default recipe shows available commands
default:
    @just --list --unsorted

# Install all dependencies
install:
    cargo install just
    cd mcp-core && cargo fetch
    cd binding-generator && cargo fetch
    cd mcp-switchboard-ui && npm install

# Clean all modules in reverse dependency order
clean:
    @echo "🧹 Cleaning all modules in reverse dependency order..."
    cd mcp-switchboard-ui && npm run clean || true
    cd binding-generator && cargo clean
    cd mcp-core && cargo clean
    rm -rf target/
    rm -f /tmp/build-*.json
    rm -f /tmp/build-*.properties
    @echo "✅ All modules cleaned"

# Build mcp-core library
build-core:
    @echo "📦 Building mcp-core..."
    cd mcp-core && cargo build --release
    @echo "✅ mcp-core built"

# Format mcp-core
fmt-core:
    @echo "🎨 Formatting mcp-core..."
    cd mcp-core && cargo fmt
    @echo "✅ mcp-core formatted"

# Lint mcp-core  
clippy-core:
    @echo "🔍 Linting mcp-core..."
    cd mcp-core && cargo clippy -- -D warnings
    @echo "✅ mcp-core linted"

# Test mcp-core
test-core: build-core
    @echo "🧪 Testing mcp-core..."
    cd mcp-core && cargo test
    @echo "✅ mcp-core tests passed"

# Perfect mcp-core (format, lint, test, build)
perfect-core: fmt-core clippy-core test-core build-core
    @echo "✨ mcp-core perfected"

# Build binding-generator (depends on mcp-core)
build-generator: build-core
    @echo "🔗 Building binding-generator..."
    cd binding-generator && cargo build --release
    @echo "✅ binding-generator built"

# Generate TypeScript bindings
generate-bindings: build-generator
    @echo "📝 Generating TypeScript bindings..."
    cd binding-generator && cargo run --release
    @echo "✅ TypeScript bindings generated"

# Build UI (depends on bindings)
build-ui: generate-bindings
    @echo "🖥️ Building UI..."
    cd mcp-switchboard-ui && npm install && npm run build
    @echo "✅ UI built"

# Test UI
test-ui: build-ui
    @echo "🧪 Testing UI..."
    cd mcp-switchboard-ui && npm test
    @echo "✅ UI tests passed"

# Full build pipeline
build: build-ui
    @echo "🚀 Full build complete"

# Run all tests
test: test-core test-ui
    @echo "✅ All tests passed"

# Validate build integrity and fingerprints
validate:
    @echo "🔍 Validating build integrity..."
    ./validate_just_idempotent_integrity.sh
    @echo "✅ Build integrity validated"

# Development mode with file watching
dev: generate-bindings
    @echo "🔥 Starting development mode..."
    cd mcp-switchboard-ui && npm run dev

# Show module dependencies
deps:
    @echo "📊 Module dependency graph:"
    @echo "  mcp-core (base)"
    @echo "    ↓"
    @echo "  binding-generator"
    @echo "    ↓"
    @echo "  mcp-switchboard-ui"