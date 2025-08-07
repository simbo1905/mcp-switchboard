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
    # Clean UI artifacts (no npm clean needed - just remove build artifacts)
    rm -rf mcp-switchboard-ui/build/ || true
    rm -rf mcp-switchboard-ui/dist/ || true
    rm -rf mcp-switchboard-ui/.svelte-kit/ || true
    rm -rf mcp-switchboard-ui/src/bindings.ts || true
    # Clean Rust modules
    cd binding-generator && cargo clean
    cd mcp-core && cargo clean
    rm -rf target/
    # CRITICAL: Purge all version files to prevent stale downstream dependencies
    rm -f /tmp/build-*.json
    rm -f /tmp/build-*.properties
    # Clean build runtime directory
    rm -rf build-runtime/
    @echo "✅ All modules cleaned and version files purged"

# Build mcp-core library
build-core:
    @echo "📦 Building mcp-core..."
    @mkdir -p build-runtime
    @echo $$ > build-runtime/build-core.pid
    cd mcp-core && cargo build --release > ../build-runtime/build-core.log 2>&1
    @rm -f build-runtime/build-core.pid
    @echo "✅ mcp-core built"
    @[ -f /tmp/build-mcp-core.properties ] && grep -E "^(MODULE|FINGERPRINT|GIT_SHA|GIT_HEADLINE|BUILD_TIME)" /tmp/build-mcp-core.properties | sed 's/^/   /' || true

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
    @[ -f /tmp/build-binding-generator.properties ] && grep -E "^(MODULE|FINGERPRINT|GIT_SHA|GIT_HEADLINE|BUILD_TIME)" /tmp/build-binding-generator.properties | sed 's/^/   /' || true

# Generate TypeScript bindings
generate-bindings: build-generator
    @echo "📝 Generating TypeScript bindings..."
    cd binding-generator && cargo run --release
    @echo "✅ TypeScript bindings generated"
    @[ -f /tmp/build-binding-generator.properties ] && echo "   Bindings built with:" && grep -E "^(FINGERPRINT|GIT_SHA|GIT_HEADLINE)" /tmp/build-binding-generator.properties | sed 's/^/     /' || true

# Build UI (depends on bindings)
build-ui: generate-bindings
    @echo "🖥️ Building UI..."
    cd mcp-switchboard-ui && npm install && npm run build
    @echo "✅ UI built"
    @[ -f /tmp/build-mcp-switchboard-ui.properties ] && grep -E "^(MODULE|FINGERPRINT|GIT_SHA|GIT_HEADLINE|BUILD_TIME)" /tmp/build-mcp-switchboard-ui.properties | sed 's/^/   /' || true

# Test UI
test-ui: build-ui
    @echo "🧪 Testing UI..."
    cd mcp-switchboard-ui && npm test
    @echo "✅ UI tests passed"

# Full build pipeline
build: build-ui
    @echo "🚀 Full build complete"
    @echo "📋 Build Summary:"
    @for module in mcp-core binding-generator mcp-switchboard-ui; do \
        if [ -f /tmp/build-$$module.properties ]; then \
            echo "   $$module:"; \
            grep -E "^(FINGERPRINT|GIT_SHA|GIT_HEADLINE)" /tmp/build-$$module.properties | sed 's/^/     /'; \
        fi; \
    done

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

# Install just via npm (for team consistency)
setup-just:
    npm install --save-dev just-install
    npx just-install
    @echo "✅ just installed locally via npm"

# Run tests with coverage
test-coverage:
    cd mcp-core && cargo test
    cd mcp-switchboard-ui && npm run test:coverage
    @echo "✅ Coverage reports generated"

# Check all module statuses
status:
    @echo "📊 Module Status:"
    @echo "  mcp-core: $(ls -la mcp-core/target/release/libmcp_core*.rlib 2>/dev/null | wc -l) artifacts"
    @echo "  binding-generator: $(ls -la binding-generator/target/release/binding-generator 2>/dev/null | wc -l) artifacts"
    @echo "  TypeScript bindings: $([ -f mcp-switchboard-ui/src/bindings.ts ] && echo 'present' || echo 'missing')"
    @echo "  Build info files: $(ls -la /tmp/build-info-*.json 2>/dev/null | wc -l) files"
    @echo "📋 Version Info:"
    @for module in mcp-core binding-generator mcp-switchboard-ui; do \
        if [ -f /tmp/build-$$module.properties ]; then \
            echo "   $$module:"; \
            grep -E "^(FINGERPRINT|GIT_SHA|GIT_HEADLINE|BUILD_TIME)" /tmp/build-$$module.properties | sed 's/^/     /'; \
        else \
            echo "   $$module: no build info"; \
        fi; \
    done

# Watch mode for development
watch:
    @echo "👀 Starting watch mode..."
    watchexec -w mcp-core/src -w binding-generator/src -w mcp-switchboard-ui/src -- just build

# Clean and rebuild everything
rebuild: clean build validate
    @echo "🔄 Complete rebuild finished"

# Show all module versions (Maven-like version management)
versions:
    @./scripts/show-versions.sh

# Run with approval wrapper
approve RECIPE:
    ./run_with_approval.sh {{RECIPE}}