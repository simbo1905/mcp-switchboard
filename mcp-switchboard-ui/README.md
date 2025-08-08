# MCP Switchboard UI

A Tauri desktop application with SvelteKit frontend that provides a chat interface for streaming conversations with AI models via the Together.ai API.

## Features

### ✅ Completed Features
- [x] Secure API key management with AES-256-GCM encryption
- [x] Platform-appropriate config storage (macOS: `~/Library/Application Support/mcp-switchboard/`)
- [x] Environment variable support for development (`TOGETHERAI_API_KEY`)
- [x] Real-time AI chat streaming with Together.ai API
- [x] Persistent configuration - no re-entry of API key on restart
- [x] Comprehensive logging system with tauri-plugin-log
- [x] Development workflow automation scripts
- [x] SSR-disabled Tauri desktop compatibility

### 🚧 Planned Features
- [ ] Model selection and management (inspired by Aider Chat)
  - [ ] `/models` command to list available models
  - [ ] `/model xxx` command to select model
  - [ ] Persistent model preference in config
- [ ] Screenshot capabilities for UI development and user features
  - [ ] Built-in screenshot capture using cross-platform Rust crate (xcap/scap)
  - [ ] Keyboard shortcut for users to capture screenshots
  - [ ] Automated screenshot capture for LLM-assisted UI development
  - [ ] Screenshot-based testing and visual feedback loops
- [ ] Enhanced chat features
- [ ] Export conversation history

## Development

### Quick Start
```sh
# Install dependencies and build
just install
just build

# Run native Tauri desktop application
just app

# Development mode (web frontend only)
just dev
```

### Manual Commands
```sh
just build           # Full build pipeline
just app            # Run native Tauri desktop application
just dev            # Development mode (web frontend only)
just test           # Run all tests
just clean          # Clean all artifacts
```

## Testing

This project follows a Maven-style test architecture with fast local tests and slower integration tests.

### Quick Start - Single Command Does Everything

```bash
# Complete test suite - handles ALL setup automatically
./test-everything.sh

# This ONE script will:
# 1. Check dependencies
# 2. Run unit tests
# 3. Run browser E2E tests  
# 4. Give clear success/failure messages
```

### Development Testing

```bash
# Fast unit tests only
npm test

# Browser E2E tests with mocked backend
just test-browser

# Full test suite (unit + browser E2E)
just test
```

### Test Architecture

#### Unit Tests (`npm test`)
- Frontend unit tests (Vitest)
- Backend unit tests (Cargo) 
- Runs in < 30 seconds
- No external dependencies
- Run this during development

#### Browser E2E Tests (`just test-browser`)
- Puppeteer with mocked Tauri backend
- Screenshot-based validation
- UI interaction testing
- Takes 1-2 minutes
- Run before commits/PRs

### Configuration
- **Development**: Set `TOGETHERAI_API_KEY` environment variable
- **Production**: API key stored encrypted in platform config directory
- **Logging**: Uses tauri-plugin-log with INFO/FINE/FINER levels

## Debug Interface

When running the application, a debug interface is available in the browser DevTools console:

### Core Commands

- `window.mcps.help()` - Show all available commands with documentation
- `window.mcps.info()` - Display build and runtime information

### Logging Control

- `window.mcps.logging.status()` - Show current logging levels
- `window.mcps.logging.disable(category)` - Disable logging for category ('all', 'streaming', 'userInput', 'response', 'models', 'startup')
- `window.mcps.logging.enable(category)` - Enable logging for category

### Help System Features

The debug interface uses a self-documenting help system that:

- **Automatically discovers** all functions and nested objects
- **Validates** that every registered function has help documentation
- **Provides usage examples** for complex functions
- **Groups commands** logically (core, logging, etc.)
- **Validates at runtime** that help text exists for all registered functions

Example usage:

```javascript
// Get help for everything
window.mcps.help()

// Get help for specific category
window.mcps.help('logging')

// Disable streaming log spam
window.mcps.logging.disable('streaming')

// Check what's still enabled
window.mcps.logging.status()
```

### Help System Requirements

Every function registered in `window.mcps` must include:

1. **helpText**: String describing what the function does
2. **usage**: String showing how to call it (optional)
3. **examples**: Array of example usage strings (optional)
4. **category**: String for grouping related functions (optional, defaults to 'core')

The help system will fail fast during development if any registered function lacks proper documentation.

## Architecture

**Frontend**: SvelteKit 2.x + Svelte 5.x + TypeScript  
**Backend**: Tauri 2.x + Rust  
**AI API**: Together.ai via async-openai client  
**Security**: AES-256-GCM encrypted config storage  
**Communication**: Event-driven Tauri commands and streaming

## Type-Safe Tauri Integration

### Overview

This project implements a fully type-safe integration between the Rust Tauri backend and TypeScript frontend. **The core principle is that if TypeScript compiles and tests pass, the native app MUST work** - no guessing, no debugging needed.

### What Was Implemented

#### 1. Type-Safe Command Layer
- **Manual TypeScript bindings** in `src/lib/bindings.ts` that exactly match Rust command signatures
- **Typed command wrapper** in `src/lib/tauri.ts` that provides `commands.getAvailableModels()` instead of raw `invoke()`
- **Reactive store pattern** - commands update shared state that multiple components observe

#### 2. Complete Mock System  
- **Production-identical mocks** in `src/lib/testing/mockTauri.ts`
- **Same API surface** - tests use `commands.getAvailableModels()`, native app uses `commands.getAvailableModels()`
- **Typed event system** - `ChatStreamPayload`, `ChatErrorPayload` with proper structure

#### 3. Bulletproof Build Process

The build process ensures **tests and native app use identical code**:

```bash
# The ONLY valid build process:
npm run clean          # Delete ALL generated files
npm run generate-bindings  # Create src/lib/bindings.ts 
npm run test:types     # Test against generated bindings
npm run tauri:build    # Build using SAME bindings
```

### Architecture Benefits

#### Before (Raw Tauri API):
```javascript
// ❌ Untyped, error-prone, no compile-time safety
await invoke('get_available_models')
await invoke('set_preferred_model', { model: id })
```

#### After (Type-Safe Reactive):
```javascript
// ✅ Fully typed, reactive, compile-time guaranteed
await commands.getAvailableModels()      // Returns ModelInfo[]
await commands.setPreferredModel({ model: id })  // Updates all observers
```

### Key Guarantees

1. **Type Safety**: `commands.setPreferredModel({ model: string })` is compile-time validated
2. **Reactive Updates**: Model changes notify all subscribers automatically
3. **Test Parity**: Mocks implement identical interfaces to real Tauri commands  
4. **Build Consistency**: Tests and native app use the exact same `src/lib/bindings.ts`

### Critical Build Requirements

**⚠️ NEVER run native app without running tests first**

The type system guarantees that:
- ✅ TypeScript compiles → API contracts match
- ✅ All tests pass → Logic is correct
- ✅ Native app works → Guaranteed by types

If tests pass but native app fails, the build process is broken - not the code.

### Testing Architecture

#### Web Tests (npm test)
- Use `src/lib/testing/mockTauri.ts` mocks
- Call `commands.getAvailableModels()` (same as native)
- Validate typed responses: `expect(models[0].id).toBe('string')`

#### Native App  
- Uses `src/lib/tauri.ts` wrapper  
- Calls `commands.getAvailableModels()` (same as tests)
- Gets typed responses from Rust backend

**Same code path, different data source. Types guarantee compatibility.**

### File Structure

```
src/lib/
├── bindings.ts              # Generated TypeScript interfaces
├── tauri.ts                 # Type-safe command wrapper
├── testing/
│   ├── mockTauri.ts         # Production-identical mocks
│   └── typedCommands.test.ts # Type safety validation
└── test-utils.ts            # Legacy compatibility
```

### Migration Summary

Successfully migrated from:
- **Raw `invoke()` calls** → **Type-safe `commands.*()` pattern**
- **String-based APIs** → **Strongly typed interfaces**  
- **Manual error handling** → **Consistent Result<T, E> pattern**
- **One-shot commands** → **Reactive store architecture**

## Build Process Status

### Current Implementation: ts-rs TypeScript Generation

The build process now uses **ts-rs 10.1** for stable TypeScript generation, replacing the previous specta-based approach.

**What Works:**
- TypeScript bindings automatically generated from Rust types using `#[derive(TS)]` and `#[ts(export)]`
- Build pipeline: `just build` handles all dependencies and type generation
- Contract verification ensures TypeScript matches Rust type structures
- Full integration between Rust backend and TypeScript frontend

**Build Process:**
```bash
just clean             # Delete all generated files  
just build             # Full build pipeline with type generation
just verify-bindings   # Verify TypeScript matches Rust types
just app              # Run native Tauri desktop application
```

### Architecture Complete

**TypeScript Generation:**
- Uses ts-rs 10.1 for production-ready type generation
- All types in mcp-core marked with `#[derive(TS), #[ts(export)]`
- Generated bindings.ts contains real extracted types, not hardcoded strings
- Contract verification prevents type drift between Rust and TypeScript

**Build System:**
- Just-based orchestration with dependency management
- Fingerprint verification ensures consistency
- Native app launch with `just app` command
- Full integration testing and validation
