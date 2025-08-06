import type { ModelInfo } from './spotlight';

// Mock models data for testing
export const mockModels: ModelInfo[] = [
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

// Mock Tauri backend functions
export const createMockTauriBackend = () => {
  let currentModel = "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";
  
  const mockInvoke = vi.fn();
  const mockListen = vi.fn();

  // Mock implementations
  mockInvoke.mockImplementation(async (command: string, args?: any) => {
    switch (command) {
      case 'has_api_config':
        return true;
      case 'get_current_model':
        return currentModel;
      case 'get_available_models':
        return mockModels;
      case 'set_preferred_model':
        // Update the current model when switching
        if (args?.model) {
          const validModel = mockModels.find(m => m.id === args.model);
          if (!validModel) {
            throw new Error(`Model not found: ${args.model}`);
          }
          currentModel = args.model;
        }
        return true;
      case 'send_streaming_message':
        // Simulate streaming by triggering events
        setTimeout(() => {
          const listeners = mockListen.mock.calls
            .filter(call => call[0] === 'chat-stream')
            .map(call => call[1]);
          listeners.forEach(listener => {
            listener({ payload: 'Test response chunk 1 ' });
            listener({ payload: 'Test response chunk 2' });
          });
        }, 10);
        
        setTimeout(() => {
          const listeners = mockListen.mock.calls
            .filter(call => call[0] === 'chat-complete')
            .map(call => call[1]);
          listeners.forEach(listener => listener({}));
        }, 20);
        
        return Promise.resolve();
      default:
        throw new Error(`Unhandled mock command: ${command}`);
    }
  });

  mockListen.mockImplementation((event: string, handler: (event: any) => void) => {
    // Store the handler for later use in streaming simulation
    return Promise.resolve();
  });

  return { mockInvoke, mockListen };
};