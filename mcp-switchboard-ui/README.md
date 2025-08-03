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
# Install dependencies
npm install

# Start development mode
./dev-restart.sh

# Stop development servers
./dev-shutdown.sh

# Run unit tests
./test-models.sh
```

### Manual Commands
```sh
npm run dev          # Frontend development server
npm run tauri dev    # Full Tauri development mode
npm run build        # Production build
npm run tauri build  # Tauri desktop build
```

## Testing

This project follows a Maven-style test architecture with fast local tests and slower integration tests.

### Quick Start - Single Command Does Everything

```bash
# Complete test suite - handles ALL setup automatically
./test-everything.sh

# This ONE script will:
# 1. Check macOS compatibility
# 2. Install Lima + guest agents if missing
# 3. Clean up any broken Lima instances
# 4. Run fast local tests
# 5. Setup Lima environment
# 6. Run full Linux E2E tests
# 7. Give clear success/failure messages
```

### Development Testing

```bash
# Fast local tests only (no Lima required)
npm test

# Full test suite (local + Linux E2E)
npm run verify
```

### Test Architecture

#### Fast Tests (`npm test`)
- Frontend unit tests (Vitest)
- Backend unit tests (Cargo)
- Runs in < 30 seconds
- No external dependencies
- Run this during development

#### Integration Tests (`npm run verify`)
- Includes all fast tests
- Linux E2E tests via Lima VM
- WebDriver UI tests
- Takes 2-5 minutes
- Run before commits/PRs

### Lima Management

Lima is used to test Linux builds on macOS:

```bash
# One-time setup
npm run lima:setup

# Verify Lima is working
npm run lima:verify  

# Remove Lima instance
npm run lima:destroy
```

### Troubleshooting

If `npm run verify` fails with Lima errors:

1. Check Lima status: `npm run lima:verify`
2. If not setup: `npm run lima:setup`
3. Check logs: `cat .lima-state/lima-manager.log`
4. Force restart: `npm run lima:destroy && npm run lima:setup`

### CI/CD

GitHub Actions runs `npm run verify` on all PRs. The CI environment handles Lima setup automatically.

### Configuration
- **Development**: Set `TOGETHERAI_API_KEY` environment variable
- **Production**: API key stored encrypted in platform config directory
- **Logging**: Uses tauri-plugin-log with INFO/FINE/FINER levels

## Architecture

**Frontend**: SvelteKit 2.x + Svelte 5.x + TypeScript  
**Backend**: Tauri 2.x + Rust  
**AI API**: Together.ai via async-openai client  
**Security**: AES-256-GCM encrypted config storage  
**Communication**: Event-driven Tauri commands and streaming
