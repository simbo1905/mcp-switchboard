/**
 * Mock Tauri Bridge for Browser Testing
 * 
 * Provides fake window.__TAURI__ implementation to test frontend
 * without needing the native Tauri app or external API server.
 */

// Mock model data for testing
const MOCK_MODELS = [
  {
    id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    display_name: "Meta Llama 3.1 8B",
    organization: "Meta"
  },
  {
    id: "deepseek-ai/deepseek-chat",
    display_name: "DeepSeek Chat", 
    organization: "DeepSeek"
  },
  {
    id: "deepseek-ai/deepseek-coder",
    display_name: "DeepSeek Coder",
    organization: "DeepSeek"
  },
  {
    id: "Qwen/Qwen2.5-7B-Instruct-Turbo",
    display_name: "Qwen 2.5 7B",
    organization: "Qwen"
  },
  {
    id: "mistralai/Mistral-7B-Instruct-v0.3",
    display_name: "Mistral 7B",
    organization: "Mistral AI"
  }
];

// Mock API key state
let mockHasApiKey = false;
let mockCurrentModel = MOCK_MODELS[0].id;

/**
 * Create mock Tauri invoke function
 */
function createMockInvoke() {
  return async function invoke(command, args = {}) {
    console.log(`[MOCK TAURI] invoke("${command}"):`, args);
    
    switch (command) {
      case 'has_api_config':
        console.log(`[MOCK TAURI] has_api_config -> ${mockHasApiKey}`);
        return mockHasApiKey;
        
      case 'save_api_config':
        console.log(`[MOCK TAURI] save_api_config: ${args.apiKey?.substring(0, 8)}...`);
        mockHasApiKey = true;
        return;
        
      case 'get_available_models':
        console.log(`[MOCK TAURI] get_available_models -> ${MOCK_MODELS.length} models`);
        return MOCK_MODELS;
        
      case 'get_current_model':
        console.log(`[MOCK TAURI] get_current_model -> ${mockCurrentModel}`);
        return mockCurrentModel;
        
      case 'set_preferred_model':
        console.log(`[MOCK TAURI] set_preferred_model: ${args.model}`);
        mockCurrentModel = args.model;
        return;
        
      case 'send_streaming_message':
        console.log(`[MOCK TAURI] send_streaming_message: "${args.message?.substring(0, 50)}..."`);
        // Simulate streaming response
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('tauri://chat-stream', {
            detail: 'Mock response: I am a test AI assistant. '
          }));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tauri://chat-stream', {
              detail: 'This response is coming from the mock Tauri bridge for browser testing.'
            }));
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('tauri://chat-complete', {
                detail: null
              }));
            }, 200);
          }, 200);
        }, 100);
        return;
        
      case 'log_info':
        console.log(`[MOCK TAURI] log_info: ${args.message}`);
        return;
        
      case 'get_build_info':
        console.log(`[MOCK TAURI] get_build_info`);
        return {
          version: "0.1.0-test",
          build_time: new Date().toISOString(),
          git_sha: "test-sha",
          fingerprint: "test-fingerprint"
        };
        
      default:
        console.warn(`[MOCK TAURI] Unknown command: ${command}`);
        throw new Error(`Unknown Tauri command: ${command}`);
    }
  };
}

/**
 * Create mock event listening functions
 */
function createMockEvent() {
  return {
    async listen(eventName, callback) {
      console.log(`[MOCK TAURI] listen("${eventName}")`);
      
      // Convert Tauri event names to DOM events
      const domEventName = `tauri://${eventName}`;
      
      const handler = (event) => {
        console.log(`[MOCK TAURI] event ${eventName}:`, event.detail);
        callback({ payload: event.detail });
      };
      
      window.addEventListener(domEventName, handler);
      
      // Return unlisten function
      return () => {
        window.removeEventListener(domEventName, handler);
      };
    }
  };
}

/**
 * Install mock Tauri bridge
 */
function installMockTauri() {
  if (typeof window === 'undefined') {
    console.warn('[MOCK TAURI] No window object, skipping mock installation');
    return;
  }
  
  if (window.__TAURI__) {
    console.log('[MOCK TAURI] Real Tauri detected, skipping mock installation');
    return;
  }
  
  console.log('[MOCK TAURI] Installing mock Tauri bridge...');
  
  // Install mock Tauri API
  window.__TAURI__ = {
    core: {
      invoke: createMockInvoke()
    },
    event: createMockEvent()
  };
  
  // Mock some globals that Tauri apps expect
  window.__TAURI_METADATA__ = {
    __currentWindow: {
      label: 'test-window'
    }
  };
  
  console.log('[MOCK TAURI] Mock Tauri bridge installed successfully');
  
  // Dispatch ready event
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('DOMContentLoaded'));
  }, 10);
}

/**
 * Reset mock state for testing
 */
function resetMockState() {
  mockHasApiKey = false;
  mockCurrentModel = MOCK_MODELS[0].id;
  console.log('[MOCK TAURI] Mock state reset');
}

// Auto-install if in browser context without real Tauri
if (typeof window !== 'undefined' && !window.__TAURI__) {
  installMockTauri();
}

// Export for manual control if needed
if (typeof module !== 'undefined') {
  module.exports = {
    installMockTauri,
    resetMockState,
    MOCK_MODELS
  };
}