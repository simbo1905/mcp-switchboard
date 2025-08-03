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
npm install

# Development with environment variable
TOGETHERAI_API_KEY=your_key_here npm run tauri dev

# Or configure via UI (production-like)
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
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

## Architecture

- **Frontend**: SvelteKit 2.x with TypeScript
- **Backend**: Tauri 2.x with Rust
- **AI Integration**: Together.ai API via OpenAI-compatible client
- **Config**: Encrypted JSON with AES-256-GCM

## README-Driven Development (RDD) Roadmap

### Phase 1: Secure Foundation ✅
- [x] Environment variable support for development
- [x] Encrypted config file storage
- [x] Platform-appropriate config directories
- [x] AES-256-GCM encryption implementation
- [x] Machine-specific key derivation
- [x] Tauri filesystem permissions
- [x] Config management API endpoints
- [ ] Frontend config integration
- [ ] Setup modal for initial configuration
- [ ] Settings UI for key management

### Phase 2: Enhanced Security 🔲
- [ ] System keychain integration (tauri-plugin-keyring)
- [ ] Automatic migration from config files to keychain
- [ ] Stronghold integration for additional secrets
- [ ] Key rotation mechanism
- [ ] Audit logging system
- [ ] Security compliance documentation

### Phase 3: Advanced Features 🔲
- [ ] Multi-provider API key support
- [ ] Team/organization config sharing
- [ ] Cloud config synchronization
- [ ] Hardware security module (HSM) support
- [ ] Zero-knowledge architecture option

### Phase 4: Enterprise Features 🔲
- [ ] Active Directory integration
- [ ] SAML/SSO authentication
- [ ] Compliance reporting (SOC2, GDPR)
- [ ] Centralized policy management
- [ ] Advanced threat detection

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