/**
 * Mock State for spotlight.test.js
 * 
 * Provides specific Tauri command responses for spotlight search testing
 * with comprehensive model data for filtering scenarios
 */

const SPOTLIGHT_MOCK_MODELS = [
  { id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", display_name: "Meta Llama 3.1 8B", organization: "Meta" },
  { id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", display_name: "Meta Llama 3.1 70B", organization: "Meta" },
  { id: "deepseek-ai/deepseek-chat", display_name: "DeepSeek Chat", organization: "DeepSeek" },
  { id: "deepseek-ai/deepseek-coder", display_name: "DeepSeek Coder", organization: "DeepSeek" },
  { id: "Qwen/Qwen2.5-7B-Instruct-Turbo", display_name: "Qwen 2.5 7B", organization: "Qwen" },
  { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", display_name: "Qwen 2.5 72B", organization: "Qwen" },
  { id: "mistralai/Mistral-7B-Instruct-v0.3", display_name: "Mistral 7B", organization: "Mistral AI" },
  { id: "anthropic/claude-3-haiku-20240307", display_name: "Claude 3 Haiku", organization: "Anthropic" },
  { id: "openai/gpt-4-turbo-preview", display_name: "GPT-4 Turbo", organization: "OpenAI" },
  { id: "google/gemini-pro", display_name: "Gemini Pro", organization: "Google" }
];

// Spotlight test state - API key configured, focus on model selection
let mockHasApiKey = true;
let mockCurrentModel = SPOTLIGHT_MOCK_MODELS[0].id;

function createSpotlightMockInvoke() {
  return async function invoke(command, args = {}) {
    console.log(`[SPOTLIGHT MOCK] ${command}:`, args);
    switch (command) {
      case 'has_api_config': return mockHasApiKey;
      case 'save_api_config': mockHasApiKey = true; return;
      case 'get_available_models': 
        console.log(`[SPOTLIGHT MOCK] Returning ${SPOTLIGHT_MOCK_MODELS.length} models for testing`);
        return SPOTLIGHT_MOCK_MODELS;
      case 'get_current_model': return mockCurrentModel;
      case 'set_preferred_model': 
        console.log(`[SPOTLIGHT MOCK] Setting preferred model: ${args.model}`);
        mockCurrentModel = args.model; 
        return;
      case 'send_streaming_message':
        console.log(`[SPOTLIGHT MOCK] Mock streaming for: "${args.message?.substring(0, 30)}..."`);
        // Simulate quick streaming response for spotlight tests
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('tauri://chat-stream', {
            detail: 'Mock spotlight response: Model selection working correctly.'
          }));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tauri://chat-complete', {
              detail: null
            }));
          }, 100);
        }, 50);
        return;
      case 'log_info': return;
      default: throw new Error(`Unknown command: ${command}`);
    }
  };
}

function createSpotlightMockEvent() {
  return {
    async listen(eventName, callback) {
      console.log(`[SPOTLIGHT MOCK] listen(${eventName})`);
      const domEventName = `tauri://${eventName}`;
      const handler = (event) => {
        console.log(`[SPOTLIGHT MOCK] event ${eventName}:`, event.detail);
        callback({ payload: event.detail });
      };
      window.addEventListener(domEventName, handler);
      return () => window.removeEventListener(domEventName, handler);
    }
  };
}

function installSpotlightMock() {
  if (typeof window !== 'undefined' && !window.__TAURI__) {
    window.__TAURI__ = {
      core: { invoke: createSpotlightMockInvoke() },
      event: createSpotlightMockEvent()
    };
    console.log('[SPOTLIGHT MOCK] Mock bridge installed with comprehensive model data');
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    installSpotlightMock,
    SPOTLIGHT_MOCK_MODELS,
    getCurrentModel: () => mockCurrentModel,
    setCurrentModel: (model) => { mockCurrentModel = model; }
  };
}