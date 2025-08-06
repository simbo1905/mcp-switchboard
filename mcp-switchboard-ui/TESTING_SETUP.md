# Testing Setup for MCP Switchboard UI

This document outlines the testing infrastructure setup for the MCP Switchboard Tauri application with Svelte frontend.

## Testing Stack

- **Vitest**: Test runner and assertion library
- **@testing-library/svelte**: Svelte component testing utilities
- **jsdom**: Browser environment simulation for tests
- **Mock Tauri Backend**: Custom mock implementation for Rust backend

## Test Structure

### 1. Unit Tests (`src/lib/*.test.ts`)

#### `model-api.test.ts`
Tests the core API integration functionality:
- Model fetching and listing
- Current model retrieval
- API configuration checks
- Model switching functionality
- Error handling for invalid models
- Response formatting

#### `model-selection-e2e.test.ts`
End-to-end workflow tests for model selection:
- Complete user workflow simulation
- Model listing and selection flow
- Error handling scenarios
- Spotlight-style command filtering
- API call verification

#### `spotlight.test.ts` (existing)
Tests the spotlight search functionality

#### `help-system.test.ts` (existing)
Tests the debug interface help system

### 2. Test Utilities (`src/lib/test-utils.ts`)

Provides:
- Mock model data matching the Together.ai API format
- `createMockTauriBackend()` function for simulating Rust backend
- Stateful mock that properly handles model switching
- Event simulation for streaming responses

### 3. Test Configuration

#### `vitest.config.ts`
- Configured for jsdom environment
- SvelteKit integration
- Test setup file registration
- Path aliases for imports

#### `src/test-setup.ts`
- Jest-DOM assertions
- Global environment setup
- Console mocking for cleaner test output

## Mock Backend Implementation

The mock Tauri backend simulates all the key functionality:

```typescript
// Available commands:
- 'has_api_config' -> boolean
- 'get_current_model' -> string
- 'get_available_models' -> ModelInfo[]
- 'set_preferred_model' -> boolean (with state update)
- 'send_streaming_message' -> Promise (with event simulation)
```

### Mock Data

```typescript
const mockModels = [
  {
    id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    display_name: "Meta Llama 3.1 8B Instruct Turbo",
    organization: "Meta"
  },
  {
    id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", 
    display_name: "Meta Llama 3.1 70B Instruct Turbo",
    organization: "Meta"
  },
  {
    id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    display_name: "Mixtral 8x7B Instruct",
    organization: "Mistral AI"
  }
];
```

## Test Coverage

The E2E tests cover the complete model selection workflow:

1. **Application Initialization**
   - API configuration check
   - Current model loading
   - Available models fetching

2. **Model Listing**
   - `/models` command execution
   - Response formatting verification
   - Current model highlighting

3. **Model Switching**
   - Valid model selection
   - State updates verification
   - Success message confirmation

4. **Error Handling**
   - Invalid model IDs
   - API error simulation
   - Error message display

5. **Command Interface**
   - Spotlight-style filtering
   - Command suggestion logic
   - User interaction patterns

## Running Tests

```bash
# Run all tests
npm run test:run

# Run tests in watch mode  
npm run test:watch

# Run specific test file
npm run test:run src/lib/model-api.test.ts

# Run with verbose output
npm run test:run -- --reporter=verbose
```

## Notes

- Svelte 5 component testing has SSR issues with lifecycle functions, so we use TypeScript-based workflow tests instead
- The mock backend maintains state across calls within a test to simulate realistic behavior
- All tests run in parallel and are isolated from each other
- Console outputs are mocked to reduce test noise while preserving error visibility