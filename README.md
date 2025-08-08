# MCP Switchboard

A secure Tauri desktop application providing a chat interface for streaming AI conversations via the Together.ai API.

## Features

- **Desktop Chat Interface**: Clean, responsive chat UI with real-time streaming
- **Secure API Key Management**: Encrypted storage with multiple fallback layers
- **Cross-Platform**: Runs on Windows, macOS, and Linux
- **Development-Friendly**: Environment variable support for rapid iteration

## Security Architecture

### Current Implementation (Phase 1)

**API Key Storage Hierarchy:**
1. **Environment Variable**: `TOGETHERAI_API_KEY` (development only)
2. **Encrypted Config File**: `~/.config/mcp-switchboard/config.json` (production)

**Security Features:**
- ✅ **AES-256-GCM Encryption**: All config files encrypted with machine-specific keys
- ✅ **Platform-Appropriate Storage**: Uses OS-standard config directories (`$APPCONFIG`)
- ✅ **No Plaintext Storage**: API keys never stored in plaintext
- ✅ **Secure Key Derivation**: Machine-specific encryption keys using SHA-256
- ✅ **Development Isolation**: Environment variables only checked in development
- ✅ **Tauri Filesystem Scope**: Restricted file access permissions

**Config File Locations:**
- **Windows**: `%APPDATA%/mcp-switchboard/config.json`
- **macOS**: `~/Library/Application Support/mcp-switchboard/config.json`
- **Linux**: `~/.config/mcp-switchboard/config.json`

### Future Implementation (Phase 2)

**Enhanced Security Stack:**
- 🔲 **System Keychain Integration**: Native credential storage (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- 🔲 **Tauri Stronghold**: Hardware-encrypted secure database for additional secrets
- 🔲 **Key Rotation**: Automatic API key refresh capabilities
- 🔲 **Audit Logging**: Secure access logging for compliance
- 🔲 **Multi-Key Support**: Support for multiple AI provider credentials

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Rust 1.77.2+
- Tauri CLI: `npm install -g @tauri-apps/cli`

### Quick Start

```bash
# Clone and setup
git clone <repository>
cd mcp-switchboard/mcp-switchboard-ui
npm install  # This automatically installs just via postinstall hook

# Verify just is available
just --version

# Build Commands (all orchestrated by just)
just build     # Full build pipeline
just test      # Run all tests
just clean     # Clean all artifacts
just dev       # Development mode
just validate  # Validate build integrity

# Development with environment variable
TOGETHERAI_API_KEY=your_key_here just dev

# Or configure via UI (production-like)
just dev
```

#### Team Setup (Automatic just Installation)
If you're on a team and want just installed automatically:
```bash
npm install  # This will install just via postinstall hook
just --version  # Verify just is available
```

#### Build Commands
All build orchestration is handled by `just`, not npm:
```bash
just build     # Full build pipeline
just test      # Run all tests
just clean     # Clean all artifacts
just dev       # Development mode
just validate  # Validate build integrity
```

Frontend-only npm scripts (for IDE integration):
```bash
npm run dev    # Vite dev server only
npm test       # Vitest only
npm run check  # TypeScript checking only
```

### Build for Production

```bash
just build     # Complete build pipeline with validation
```


## Debugging and Logging

### Accessing Developer Tools

Tauri provides access to web inspector tools similar to Chrome/Firefox dev tools:

**Keyboard Shortcuts:**
- **Windows/Linux**: `Ctrl + Shift + I`
- **macOS**: `Cmd + Option + I`

**Right-click Method:**
- Right-click in the WebView and choose "Inspect Element"

**Platform-Specific Inspectors:**
- **Linux**: webkit2gtk WebInspector
- **macOS**: Safari's Web Inspector
- **Windows**: Microsoft Edge DevTools

### Logging Architecture

#### Frontend (Svelte/JavaScript) Logging

- **Console API**: Standard `console.log()`, `console.error()`, etc.
- **Tauri Plugin Integration**: Use `tauri-plugin-log-api` for unified logging
- **WebView Console**: Logs appear in the developer tools console

```javascript
import { attachConsole } from "tauri-plugin-log-api";

// Enable webview console logging (call early in app lifecycle)
await attachConsole();

console.log("Frontend log message");
```

#### Backend (Rust) Logging

- **Log Crate**: Uses standard Rust `log` crate with levels (error, warn, info, debug, trace)
- **Multiple Targets**: Console output, webview console, and file logging
- **Production Logging**: Writes to OS-standard log directories

```rust
use log::{info, warn, error};

info!("Config loaded successfully");
warn!("API key not found, showing setup");
error!("Failed to encrypt config: {}", error);
```

#### Log Targets Configuration

The application supports multiple logging destinations:

1. **Console Output**: Terminal/stdout during development
2. **WebView Console**: Browser dev tools (enable with LogTarget::Webview)
3. **File Logging**: Production logs in OS-standard locations:
   - **Windows**: `%APPDATA%/com.tauri.dev/logs/`
   - **macOS**: `~/Library/Logs/com.tauri.dev/`
   - **Linux**: `~/.local/share/com.tauri.dev/logs/`

#### Development vs Production Logging

**Development:**
- WebView console enabled for real-time debugging
- Verbose logging levels (debug/trace)
- Console output for immediate feedback

**Production:**
- File-based logging for user-reported issues
- Info/warn/error levels only
- No console output to reduce overhead

### Debugging Best Practices

1. **Use Developer Tools**: Access via keyboard shortcuts or right-click
2. **Check Both Frontend and Backend Logs**: Use unified logging approach
3. **Enable WebView Console**: Call `attachConsole()` early in development
4. **Use Appropriate Log Levels**: trace/debug for development, info/warn/error for production
5. **Monitor Config Operations**: Check logs when API key operations occur

## Architecture: Shared Library Solution

### The Problem
We have a circular dependency: the Tauri app needs TypeScript bindings to compile, but we need to run the app to generate those bindings. This is impossible.

### The Solution: Three-Crate Workspace

**Project Structure:**
```
mcp-switchboard/
├── mcp-core/              # Shared library with all commands
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs         # All Tauri commands as library functions
├── binding-generator/      # Minimal binary just for TypeScript generation
│   ├── Cargo.toml
│   └── src/
│       └── main.rs        # Uses mcp-core, exports bindings, exits
├── mcp-switchboard-ui/    # Main Tauri application
│   ├── src-tauri/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       └── main.rs    # Uses mcp-core, runs full Tauri app
│   ├── src/               # Frontend that uses generated bindings
│   └── package.json
└── Cargo.toml             # Workspace root
```

**How It Works:**
1. **mcp-core** contains all Tauri commands as a library - no Tauri app, just functions
2. **binding-generator** imports mcp-core, uses tauri-specta to generate TypeScript from those commands, writes to file, exits
3. **mcp-switchboard-ui** imports mcp-core AND the generated TypeScript bindings - full Tauri app

## Testing Framework

### Overview

This project implements a layered testing approach designed to validate both functionality and user experience across multiple environments and contexts.

### Layered Testing Architecture

#### Layer 1: Unit Tests
- **Rust Backend**: Cargo test framework for mcp-core business logic
- **Frontend**: Vitest for component and utility function testing
- **Coverage**: Individual function and component behavior validation

#### Layer 2: Integration Tests  
- **API Integration**: Mock backend responses for AI model endpoints
- **TypeScript Contract**: Verification that generated bindings match Rust types
- **Configuration**: Encrypted config loading and API key management flows

#### Layer 3: Browser Testing (Planned)
- **Framework**: Puppeteer for automated browser interaction
- **Mock Backend**: Simulated Together.ai API responses for `/models` endpoint testing
- **UI Validation**: Screenshot-based regression testing for visual components

#### Layer 4: Manual Testing
- **Native Development App**: Real Tauri backend with WebView frontend (`just app`)
- **Cross-Platform Validation**: Manual testing across Windows/macOS/Linux
- **End-to-End Workflows**: Complete user workflows from startup to API interaction

### Browser Testing Strategy (Interactive UI Testing)

**CRITICAL ISSUE**: The spotlight search feature has cursor jumping problems that make typing jittery and unusable. This requires comprehensive browser testing to identify, fix, and prevent regressions.

**Testing Infrastructure:**
- **Framework**: Puppeteer for automated browser interaction with realistic timing
- **Mock Backend**: Express.js server serving Together.ai API endpoints for isolated testing  
- **Screenshot Testing**: Visual regression detection with baseline comparison
- **Folder Structure**: Organized testing assets under version control

**Implementation Architecture:**
```
mcp-switchboard-ui/
├── src/lib/testing/
│   └── browser/               # Puppeteer test suites
│       ├── mock-tauri.js      # Tauri command mocking layer
│       ├── spotlight.test.js  # Spotlight behavior testing
│       ├── startup.test.js    # App health verification
│       └── utils/             # Testing utilities and helpers
└── target/
    └── test-screenshots/      # Screenshot storage (cleaned by just)
        ├── baselines/         # Expected UI states
        └── current/           # Latest test captures
```

**Tauri Command Mocking:**
- Direct `window.__TAURI__` function mocking in browser context
- Mock implementations for `get_available_models`, `has_api_config`, `set_preferred_model`
- Simulated streaming responses using DOM events
- No external HTTP server required

**Mock State Management:**
- Each test file has corresponding mock state file: `test-name.mock.js`
- Mock files define specific Tauri command responses for that test scenario
- Test-specific mocks injected via `page.evaluateOnNewDocument()`
- Naming convention: `startup.test.js` → `startup.mock.js`, `spotlight.test.js` → `spotlight.mock.js`

**Critical Test Scenarios:**
1. **Cursor Stability**: Verify typing doesn't cause cursor jumping
2. **Spotlight Activation**: `/` key opens spotlight smoothly
3. **Navigation Flow**: Up/Down/ESC/ENTER keyboard handling
4. **Model Filtering**: Real-time search with typing delays
5. **Visual States**: Screenshot capture of all UI interactions

**Browser Test Commands:**
- `just test-browser` - Full browser test suite with Tauri mocking
- `just test-browser-mock` - Browser tests with built frontend (same as test-browser)
- `just test-screenshots` - Capture/compare visual states
- `just test-spotlight` - Specific spotlight behavior testing

**Testing Methodology - Sanity and Proof-of-Life:**
1. **Always Boot Test**: Every test must boot the app and verify "proof of life" via console logs
2. **Screenshot Bookends**: Take screenshot at start and end of every test
3. **Visual Verification**: After test passes, manually inspect both screenshots to confirm not false positive
4. **Console Log Validation**: Check for expected startup messages and absence of errors
5. **Only Use `just` Commands**: Never run bare node/npm/cargo - always use `just` for repeatability

## Build System Architecture: Maven-Like Multi-Module Project

This project implements a **water-tight build system** similar to Apache Maven with multi-module projects, generate-sources phases, and dependency-ordered lifecycle goals.

### Build Orchestration with Just

This project uses `just` as its build orchestrator, providing Maven-like dependency management and lifecycle phases without the complexity of enterprise build systems like Bazel.

#### Why Just?
- **Simple and Explicit**: All build commands are visible in the `justfile`, no hidden magic
- **Dependency Management**: Recipes can depend on other recipes, ensuring proper build order  
- **Cross-Platform**: Works identically across macOS, Linux, and Windows
- **Language Agnostic**: Orchestrates cargo, npm, and any other tool without bias
- **Idempotent**: Running commands multiple times produces the same result
- **LLM-Friendly**: Clear syntax reduces errors when AI assistants modify build scripts

#### Installation
```bash
cargo install just
```

#### Common Commands
```bash
just           # Show all available recipes
just clean     # Clean all modules in reverse dependency order
just build     # Full build pipeline with proper dependency order
just test      # Run all tests
just validate  # Validate build integrity and fingerprints
```

#### Build Pipeline
1. `clean` - Removes all artifacts (reverse dependency order)
2. `build-core` - Builds mcp-core library
3. `generate-bindings` - Generates TypeScript bindings from Rust
4. `build-ui` - Builds the UI with generated bindings
5. `validate` - Ensures fingerprints and versions are correct

### Design Principles

**1. Module Autonomy**: Each module has its own top-level build commands
- `mcp-core`: `cargo build`, `cargo test`, `cargo clean`
- `binding-generator`: `cargo build`, `cargo run`, `cargo clean`  
- `mcp-switchboard-ui`: `npm install`, `npm run build`, `npm run clean`, `npm test`

**2. Driver Script Delegation**: Driver scripts NEVER duplicate module logic
- Scripts delegate to each module's own build commands
- Scripts coordinate between modules and verify outcomes
- NO critical logic bypassed if running module commands directly

**3. Dependency-Ordered Execution**: Like Maven's reactor
- **Build Order**: mcp-core → binding-generator → mcp-switchboard-ui
- **Clean Order**: mcp-switchboard-ui → binding-generator → mcp-core (reverse)
- Dependencies verified at build time, not just in driver scripts

**4. Generate-Sources Phase**: Automatic artifact generation
- binding-generator creates TypeScript from Rust (like Maven codegen)
- Build fingerprints embedded in cargo build.rs (cannot be bypassed)
- Generated artifacts include build metadata for verification

**Build Process:**
```bash
just clean                 # Clean all modules in reverse dependency order
just generate-bindings     # Run binding-generator binary → outputs bindings.ts  
just test                  # Test all modules (frontend + backend)
just build                 # Build full app using generated bindings
```

### Module Commands (Direct Usage)

**Each module can be built independently:**
```bash
# mcp-core (library)
cd mcp-core && cargo build --release

# binding-generator (codegen)  
cd binding-generator && cargo build --release && cargo run --release

# mcp-switchboard-ui (main app)
cd mcp-switchboard-ui && npm install && npm run build
```

**Driver scripts coordinate but never replace module logic.**

## Development Commands

**CRITICAL**: You must always only run the `just` commands to do any steps that should run the full process in an idempotent and repeatable manner.

## Module Architecture

The application follows a three-module pattern for clean separation of concerns:

```
   mcp-core                binding-generator         mcp-switchboard-ui
   [Pure Logic]            [Type Extractor]          [Tauri App]
        |                         |                         |
   - Pure Rust            - Imports types           - ONLY place with
   - NO Tauri deps          from mcp-core             #[tauri::command]
   - Business logic       - Exports to .ts          - Thin wrappers calling
   - Public functions     - NO mock functions         mcp-core functions
```

### Implementation Requirements

**mcp-core Module:**
- ✅ Pure Rust library with no Tauri dependencies
- ✅ Public functions without `#[tauri::command]` macros  
- ✅ Streaming functions return `Stream<StreamMessage>` not `tauri::Window`
- ✅ All business logic contained here

**binding-generator Module:**
- ✅ Imports types directly from mcp-core via `use mcp_core::{...}`
- ✅ Generates TypeScript interfaces from Rust types using ts-rs 10.1
- ✅ NO duplicate function implementations or mock functions
- ✅ Uses ts-rs for stable, automatic type generation
- ✅ Contract verification ensures TypeScript matches Rust types

**mcp-switchboard-ui Module:**
- ✅ ONLY module with `#[tauri::command]` macros
- ✅ Thin wrapper functions that call mcp-core business logic
- ✅ Handles Tauri-specific concerns (window events, UI integration)
- ✅ Uses generated TypeScript bindings

### Build Dependencies

The modules must build in strict dependency order:
1. `mcp-core` (pure Rust, no dependencies)
2. `binding-generator` (depends on mcp-core types)  
3. `mcp-switchboard-ui` (depends on generated bindings + mcp-core logic)

### Implementation Guide

**STEP 1: Make mcp-core Pure**
```toml
# mcp-core/Cargo.toml - NO tauri dependency
[dependencies]
serde = { version = "1.0", features = ["derive"] }
# ... other dependencies BUT NOT tauri
```

```rust
// mcp-core/src/lib.rs - Plain public functions
pub async fn get_api_config() -> Result<Option<String>, String> {
    // Business logic implementation
}
```

**STEP 2: Fix binding-generator**
```rust
// binding-generator/src/main.rs - Import types, export to TypeScript
use mcp_core::{ModelInfo, ApiError, BuildInfo};

fn main() {
    // Generate TypeScript interfaces from Rust types
    // NO mock functions - just export type definitions
}
```

**STEP 3: Add Tauri Wrappers** 
```rust
// mcp-switchboard-ui/src-tauri/src/main.rs - ONLY place with commands
#[tauri::command]
async fn get_api_config() -> Result<Option<String>, String> {
    mcp_core::get_api_config().await  // Call pure function
}
```

**STEP 4: Add Contract Verification (Safety Feature)** ✅ **IMPLEMENTED**

The generated `bindings.ts` file is critical - if it's broken/empty/wrong, the main app will explode in mysterious ways. Contract verification ensures TypeScript types match what Rust exposes.

**IMPLEMENTATION APPROACH:**
```bash
# Added verification dependencies to binding-generator
cd binding-generator && npm install
# typescript@^5.0.0, tsx@^4.0.0, @types/node@^20.0.0
```

**CONTRACT VERIFICATION IMPLEMENTATION:**
```typescript
// binding-generator/verify-contract.ts (IMPLEMENTED)
import { readFileSync } from 'fs';
import * as ts from 'typescript';

interface TypeContract {
  structs: Map<string, Set<string>>;  // struct_name -> field_names
  enums: Map<string, Set<string>>;    // enum_name -> variant_names
  types: Set<string>;                  // all type names
}

function extractRustTypes(): TypeContract {
  // Parse Rust source files directly (stable approach - no nightly required)
  // Extract structs/enums with #[derive(TS)] and #[ts(export)]
}

function extractTypeScriptTypes(): TypeContract {
  // Parse TypeScript AST using TypeScript compiler API
  // Extract exported types, interfaces, and type aliases
}

function compareContracts(rust, typescript): boolean {
  // Compare contracts and fail if mismatched
}
```

**JUSTFILE INTEGRATION:**
```bash
# Verify the generated TypeScript matches Rust types (IMPLEMENTED)
verify-bindings: smoke-test-bindings
    @echo "🔍 Verifying type contract..."
    @echo "   Installing verification dependencies..."
    cd binding-generator && npm install
    @echo "   Running enhanced contract verification..."
    cd binding-generator && npx tsx verify-contract.ts
```

**BUILD PIPELINE:**
```bash
# Current build uses both smoke test AND contract verification
build-ui: generate-bindings smoke-test-bindings
    @echo "🖥️ Building UI with verified bindings..."
    cd mcp-switchboard-ui && npm install && npm run build

# Full verification available via just verify-bindings
verify-bindings: smoke-test-bindings
    # Runs comprehensive contract verification
```

**CONTRACT VERIFICATION BENEFITS:**
- ✅ Catches empty/corrupted bindings.ts files (smoke test does this)
- ✅ Detects missing types lost in translation  
- ✅ Identifies field-level mismatches between Rust and TypeScript
- ✅ Verifies complete contract between Rust exports and TypeScript imports
- ✅ Prevents subtle type drift over time
- ✅ Uses stable Rust (no nightly required)
- ✅ TypeScript compiler API for accurate parsing
- ✅ Clear error reporting with actionable messages

**VERIFICATION RESULTS:**
```
📊 Contract Verification Report:
   Rust types: 7
   TypeScript types: 8
   Rust structs: 6  
   TypeScript structs: 6
   Rust enums: 1
   TypeScript enums: 2

✅ Contract verification passed! Types match.
```

**Build Order:**
```bash
just build-core        # Pure Rust library
just build-generator   # Type extraction
just generate-bindings # Create .ts interfaces  
just build-ui          # Tauri app with bindings
```

**Primary Build Commands:**
```bash
just           # Show all available recipes
just clean     # Clean all modules in reverse dependency order
just build     # Full build pipeline with proper dependency order
just test      # Run all tests (Rust + TypeScript)
just dev       # Development mode with file watching (web frontend only)
just app       # Run native Tauri desktop application
just validate  # Validate build integrity and fingerprints
```

**Module-Specific Commands:**
```bash
just build-core        # Build mcp-core library only
just generate-bindings # Generate TypeScript bindings from Rust
just build-ui          # Build UI with generated bindings
just test-core         # Test mcp-core only
just test-ui           # Test UI only
```

**Development Utilities:**
```bash
just status      # Check all module build status
just deps        # Show module dependency graph
just rebuild     # Clean and rebuild everything
just watch       # Watch mode for continuous builds
just approve RECIPE  # Run any recipe with approval wrapper
```

### **Build Process Monitoring**

**Problem**: Long build times require monitoring and status visibility  
**Solution**: Comprehensive build process tracking with persistent state

**Implementation:**
- **PID Files**: `build-runtime/{command}.pid` for process tracking
- **Log Files**: `build-runtime/{command}.log` for output capture  
- **Status Script**: `scripts/check-build.sh` for unified monitoring
- **Conventions**: Predictable naming enables reliable automation

**Usage:**
```bash
./scripts/check-build.sh    # Check all build processes
tail -f build-runtime/build-core.log  # Follow specific build
```

**Why In-Project Storage:**
- **Persistence**: Survives terminal sessions and system reboots
- **Portability**: Works across different development environments  
- **Git Integration**: `.gitignore`d but tracked in repository structure
- **Team Collaboration**: Consistent paths for all developers

**npm vs just Separation:**
- **`just`**: Build orchestration, multi-module coordination, dependency management
- **`npm`**: Frontend package management only (Vite, Vitest, SvelteKit tools)

```bash
# ✅ Correct: Use just for build orchestration
just build     # Coordinates all modules
just test      # Runs both Rust and TypeScript tests
just dev       # Manages development workflow

# ✅ Also correct: Direct frontend tools (IDE integration)
npm run dev    # Vite dev server only
npm test       # Vitest only  
npm run check  # TypeScript checking only
```

**Build Fingerprinting System:**
- **Embedded in cargo build**: Uses build.rs scripts to generate fingerprints during cargo build
- **Embedded in npm build**: npm scripts clean and regenerate all fingerprints before builds
- Each module generates a unique SHA256 fingerprint from its source files (.rs, .toml)
- Build metadata (fingerprint, timestamp, git commit) written to `/tmp/build-info-{module}.json`
- Downstream modules verify upstream fingerprints during their build process (not just driver scripts)
- Generated TypeScript bindings include build fingerprint comments  
- `get_build_info()` API endpoint exposes build metadata to frontend for verification
- Production startup logs display all build fingerprints for debugging and verification
- **Cannot be bypassed**: Works even if someone skips driver scripts and runs cargo/npm directly

**Why This Works:**
- No circular dependency: binding-generator doesn't need TypeScript to compile, it only generates it
- Single source of truth: Commands defined once in mcp-core
- Idempotent: Can run npm commands repeatedly, always same result
- Testable: Frontend tests use exact same bindings as production build

### Technology Stack
- **Frontend**: SvelteKit 2.x with TypeScript
- **Backend**: Tauri 2.x with Rust (three-crate workspace)
- **AI Integration**: Together.ai API via OpenAI-compatible client
- **Config**: Encrypted JSON with AES-256-GCM
- **Testing**: Multi-layer approach from unit tests to browser E2E tests
  - **Browser E2E**: Puppeteer with mocked Tauri backend for automated UI testing
  - **Manual Testing**: Native development app for real-world validation
  - **Screenshot Testing**: Visual regression detection with baseline comparison

## Future Roadmap

**Security Enhancements:**
- [ ] System keychain integration (tauri-plugin-keyring)
- [ ] Frontend config integration with setup modal
- [ ] Key rotation mechanism and audit logging

**Advanced Features:**
- [ ] Multi-provider API key support
- [ ] Team/organization config sharing
- [ ] Cloud config synchronization

## Security Best Practices Implemented

1. **Principle of Least Privilege**: Minimal filesystem permissions
2. **Defense in Depth**: Multiple security layers (encryption + scoped access)
3. **Secure by Default**: No plaintext storage, secure fallbacks
4. **Platform Integration**: Native OS security features
5. **Development Security**: Separate dev/prod credential handling

## RDD and TDD Development Process

**Readme-Driven Development (RDD):** The README documents the intended solution and serves as the living project specification. Implementation follows the documented specification exactly.

**Working Process:**
- README documents what the system *should* do, not what it currently does
- Checklists track work-in-progress and provide durable state across sessions
- When regressions occur, tasks are simply unchecked and reworked
- Completed checklists are pruned before merge - GitHub issues/PRs/commits are the system of record
- Eventually specification and implementation converge, then move to GitHub issues for ongoing work

**Quality Gates:** Features are only complete when specification matches implementation and all tests pass.

## Contributing

1. Security changes require security review
2. All config-related changes must update this README
3. Test both development and production credential flows
4. Document any new security implications

## Interactive Browser Testing Implementation Checklist

**RDD COMPLIANCE**: These tasks document the exact intended implementation. Each item must be completed before claiming the feature works. This checklist serves as the living specification.

### Phase 1: Foundation Setup ✅ **CRITICAL PATH**
- [ ] **Install Puppeteer framework**: `npm install --save-dev puppeteer express`
- [ ] **Create testing folder structure**: `src/lib/testing/{browser,mock-api}/{test-files}`
- [ ] **Set up screenshot storage**: `target/test-screenshots/{baselines,current}/`
- [ ] **Configure headless/headed modes**: Environment-based browser launching

### Phase 2: Tauri Command Mocking ✅ **CRITICAL PATH**  
- [x] **Create mock Tauri bridge**: `mock-tauri.js` with `window.__TAURI__` implementation
- [x] **Mock core commands**: `get_available_models`, `has_api_config`, `set_preferred_model`
- [x] **Mock streaming responses**: Simulate chat streaming using DOM events
- [ ] **Mock error conditions**: API failures, invalid responses, timeout scenarios
- [ ] **Create test data**: Various model scenarios (empty, large, filtered)

### Phase 3: App Health Verification ✅ **CRITICAL PATH**
- [ ] **Startup health check**: Launch app, verify clean console logs
- [ ] **API key flow testing**: Configure mock API key, verify UI updates
- [ ] **Baseline screenshot capture**: Initial healthy app state documentation
- [ ] **Console error detection**: Fail tests on TypeScript/runtime errors

### Phase 4: Spotlight Search Core Testing ✅ **CRITICAL PATH**
- [ ] **`/` key activation**: Verify smooth spotlight opening without glitches
- [ ] **Cursor stability testing**: Type with delays, confirm no cursor jumping
- [ ] **Up/Down navigation**: Arrow key suggestion traversal
- [ ] **ESC exit behavior**: Close spotlight and clear input state
- [ ] **ENTER selection**: Execute selected command properly
- [ ] **Backspace editing**: Text modification without cursor issues

### Phase 5: Model Search and Selection ✅ **CRITICAL PATH**
- [ ] **Real-time filtering**: Type model names, verify suggestion updates
- [ ] **Model selection flow**: Choose model via keyboard/mouse, confirm activation  
- [ ] **Search performance**: Test with 100+ model fixture for responsiveness
- [ ] **Filter edge cases**: Empty results, special characters, case sensitivity
- [ ] **Visual feedback**: Highlight selected items, loading states

### Phase 6: Just Command Integration ✅ **CRITICAL PATH**
- [x] **`just test-browser`**: Run complete Puppeteer test suite with Tauri mocking
- [x] **`just test-browser-mock`**: Browser tests with built frontend (same as above)
- [ ] **`just test-screenshots`**: Capture and compare visual baselines
- [ ] **`just test-spotlight`**: Focused spotlight behavior testing
- [x] **Update `just clean`**: Remove `target/test-screenshots/` artifacts
- [x] **Update `just test`**: Include browser tests in full test suite

### Phase 7: Native App Verification ✅ **INTEGRATION REQUIREMENT**
- [ ] **Background app launch**: `just app &` with PID tracking
- [ ] **Info API call verification**: Monitor logs for expected backend calls
- [ ] **UI behavior parity**: Confirm native app matches browser testing
- [ ] **Startup logging**: Verify app health indicators in native mode

### Phase 8: Issue Resolution ✅ **QUALITY GATE**
- [ ] **Cursor jumping fix**: Identify and resolve Svelte reactivity issues
- [ ] **Typing stability**: Implement proper input handling without cursor movement
- [ ] **Performance optimization**: Ensure smooth typing with minimal delays
- [ ] **Regression prevention**: Add specific tests for fixed cursor behavior

### Phase 9: Final Validation ✅ **ACCEPTANCE CRITERIA**
- [ ] **Clean build test**: `just clean && just build && just test-browser`
- [ ] **Screenshot baseline validation**: Verify all captured states are correct
- [ ] **Documentation updates**: Complete testing procedures and troubleshooting
- [ ] **Repeatability verification**: Multiple clean test runs succeed consistently

### Phase 10: Completion ✅ **DELIVERY**
- [ ] **All tests passing**: Browser, native app, and integration tests
- [ ] **Zero cursor jumping**: Smooth typing experience verified
- [ ] **Full just integration**: All commands working and documented
- [ ] **Remove this checklist**: Only when all functionality is proven working

**QUALITY GATES**: 
- No phase marked complete unless all items in that phase work
- Cursor jumping must be completely resolved before Phase 8 completion
- Native app must demonstrate same behavior as browser tests
- All `just` commands must be reliable and repeatable

## License

[License details to be added]