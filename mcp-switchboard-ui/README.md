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

### Testing
```sh
./test-models.sh     # Run model management unit tests (background)
tail -f ./test.log   # Monitor test progress
kill $(cat test.pid) # Stop tests if needed
```

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
