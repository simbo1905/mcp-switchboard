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
- Lima (for cross-platform testing): `brew install lima lima-additional-guestagents`

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

### Lima Testing Troubleshooting

**Prerequisites Check:**
```bash
./lima-manager.sh status    # Check Lima installation and instance status
limactl list               # View all Lima instances
```

**Common Issues:**
- **Setup hangs**: Fixed in current version - uses reliable step-by-step installation
- **Architecture mismatch**: Script auto-detects VZ/aarch64 on Apple Silicon, QEMU/x86_64 on Intel
- **Dependency failures**: Each dependency installed separately with error handling
- **Instance conflicts**: Use `./lima-manager.sh destroy` then `./lima-manager.sh setup` to start fresh

**Manual Recovery:**
```bash
./lima-manager.sh destroy   # Remove broken instance
./lima-manager.sh setup     # Clean setup with architecture detection
./lima-manager.sh verify    # Confirm all dependencies installed
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

**CURRENT WORK**: Fixing Rust macro conflicts (E0255 duplicate `#[tauri::command]` errors) preventing mcp-core compilation. The Issue #4 build version tracking system generates proper fingerprints and version properties, but duplicate command definitions between `/mcp-core/src/lib.rs` and `/mcp-switchboard-ui/src-tauri/src/bin/generate-bindings.rs` prevent compilation completion.

**CRITICAL**: You must always only run the `just` commands to do any steps that should run the full process in an idempotent and repeatable manner.

**Primary Build Commands:**
```bash
just           # Show all available recipes
just clean     # Clean all modules in reverse dependency order
just build     # Full build pipeline with proper dependency order
just test      # Run all tests (Rust + TypeScript)
just dev       # Development mode with file watching
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
- **Testing**: Lima VM with architecture auto-detection (VZ on Apple Silicon, QEMU on Intel)
  - **Setup Process**: Automatically detects existing Lima default instance configuration
  - **Dependencies**: Installs Node.js 20.x, Rust 1.88+, tauri-driver in isolated Linux environment
  - **Performance**: ~3-5 minutes setup time, reliable unattended installation

## README-Driven Development (RDD) Roadmap

### Current Development (GitHub Issues)

**Issue #4: Comprehensive Build Version Tracking and E2E Display System** 
- [ ] **Phase 1: Version Generation**
  - [ ] Update all `build.rs` scripts to generate comprehensive version properties 
  - [ ] Create `/tmp/build-{module}.properties` with commit hash, timestamp, headline, fingerprint
  - [ ] Update justfile recipes to log version info during builds
- [ ] **Phase 2: Rust Integration**
  - [ ] Add `build_info` module to mcp-core with embedded build constants
  - [ ] Expose version info through Tauri commands  
  - [ ] Add Rust tests for build info availability
- [ ] **Phase 3: TypeScript Integration**
  - [ ] Generate `src/lib/build-info.ts` with embedded version constants
  - [ ] Inject build info into generated TypeScript bindings
  - [ ] Create frontend utility to access all module versions
- [ ] **Phase 4: E2E Access**
  - [ ] Expose `window.__BUILD_INFO__()` function in Tauri app
  - [ ] Add build info to development server
  - [ ] Create comprehensive E2E test validating version propagation  
- [ ] **Phase 5: Just Build System Integration**
  - [ ] Update all just recipes to display version info
  - [ ] Add `just versions` recipe to show all module versions
  - [ ] Ensure build logs include complete version audit trail

**Target: Maven-like version management with Spring Boot Actuator-style accessibility**

### Completed Architecture ✅

**Shared Library Architecture & Build System:**
- Multi-module workspace: mcp-core → binding-generator → mcp-switchboard-ui
- Build fingerprinting system embedded in cargo build.rs scripts
- Type-safe integration with manual TypeScript bindings
- Just-based build orchestration with Maven-like dependency management
- Water-tight system with dependency verification that cannot be bypassed

**Security Foundation:**
- Environment variable support for development
- Encrypted config file storage with AES-256-GCM
- Platform-appropriate config directories with machine-specific keys
- Tauri filesystem permissions and config management API endpoints

### Future Roadmap

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

## Contributing

1. Security changes require security review
2. All config-related changes must update this README
3. Test both development and production credential flows
4. Document any new security implications

## License

[License details to be added]