/**
 * Mock State for startup.test.js
 * 
 * Provides specific Tauri command responses for startup health testing
 */

const MOCK_MODELS = [
  { id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", display_name: "Meta Llama 3.1 8B", organization: "Meta" },
  { id: "deepseek-ai/deepseek-chat", display_name: "DeepSeek Chat", organization: "DeepSeek" }
];

// Startup test state - API key configured for basic health checks
let mockHasApiKey = true;
let mockCurrentModel = MOCK_MODELS[0].id;

function createStartupMockInvoke() {
  return async function invoke(command, args = {}) {
    console.log(`[STARTUP MOCK] ${command}:`, args);
    switch (command) {
      case 'has_api_config': return mockHasApiKey;
      case 'save_api_config': mockHasApiKey = true; return;
      case 'get_available_models': return MOCK_MODELS;
      case 'get_current_model': return mockCurrentModel;
      case 'set_preferred_model': mockCurrentModel = args.model; return;
      case 'log_info': return;
      case 'get_build_info': return {
        version: "0.1.0-startup-test",
        build_time: new Date().toISOString(),
        git_sha: "startup-test-sha",
        fingerprint: "startup-test-fingerprint"
      };
      default: throw new Error(`Unknown command: ${command}`);
    }
  };
}

function createStartupMockEvent() {
  return {
    async listen(eventName, callback) {
      console.log(`[STARTUP MOCK] listen(${eventName})`);
      return () => {};
    }
  };
}

function installStartupMock() {
  if (typeof window !== 'undefined' && !window.__TAURI__) {
    window.__TAURI__ = {
      core: { invoke: createStartupMockInvoke() },
      event: createStartupMockEvent()
    };
    console.log('[STARTUP MOCK] Mock bridge installed');
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    installStartupMock,
    mockHasApiKey: () => mockHasApiKey,
    setMockHasApiKey: (value) => { mockHasApiKey = value; }
  };
}