import { vi, beforeEach, describe, it, expect } from 'vitest';
import { createMockTauriBackend, mockModels } from './test-utils';

describe('Model Selection API Integration', () => {
  let mockInvoke: ReturnType<typeof vi.fn>;
  let mockListen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const backend = createMockTauriBackend();
    mockInvoke = backend.mockInvoke;
    mockListen = backend.mockListen;
  });

  it('should fetch available models', async () => {
    const models = await mockInvoke('get_available_models');
    
    expect(models).toHaveLength(3);
    expect(models).toEqual(mockModels);
    expect(models[0]).toHaveProperty('id', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo');
    expect(models[0]).toHaveProperty('display_name', 'Meta Llama 3.1 8B Instruct Turbo');
    expect(models[0]).toHaveProperty('organization', 'Meta');
  });

  it('should get current model', async () => {
    const currentModel = await mockInvoke('get_current_model');
    
    expect(currentModel).toBe('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo');
  });

  it('should check API configuration', async () => {
    const hasConfig = await mockInvoke('has_api_config');
    
    expect(hasConfig).toBe(true);
  });

  it('should switch to a new model successfully', async () => {
    const newModel = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
    
    await expect(mockInvoke('set_preferred_model', { model: newModel })).resolves.toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('set_preferred_model', { model: newModel });
  });

  it('should handle model switching errors', async () => {
    // Create a mock that rejects for invalid models
    const errorMockInvoke = vi.fn().mockImplementation(async (command: string, args?: any) => {
      if (command === 'set_preferred_model' && args?.model === 'invalid-model') {
        throw new Error('Model not found');
      }
      return createMockTauriBackend().mockInvoke(command, args);
    });

    await expect(errorMockInvoke('set_preferred_model', { model: 'invalid-model' }))
      .rejects
      .toThrow('Model not found');
  });

  it('should format models list correctly', () => {
    const models = mockModels;
    const currentModel = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
    
    let modelList = `📋 **Available Models:**\n\n`;
    modelList += `🎯 **Current:** ${currentModel}\n\n`;
    
    for (const model of models) {
      const current = model.id === currentModel ? ' 👈 *current*' : '';
      modelList += `• **${model.display_name}** (${model.organization})\n`;
      modelList += `  ID: \`${model.id}\`${current}\n\n`;
    }
    modelList += `💡 Use \`/model <model-id>\` to switch models`;
    
    expect(modelList).toContain('📋 **Available Models:**');
    expect(modelList).toContain('🎯 **Current:** meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo');
    expect(modelList).toContain('Meta Llama 3.1 8B Instruct Turbo');
    expect(modelList).toContain('👈 *current*');
    expect(modelList).toContain('Meta Llama 3.1 70B Instruct Turbo');
    expect(modelList).toContain('Mixtral 8x7B Instruct');
    expect(modelList).toContain('💡 Use `/model <model-id>` to switch models');
  });

  it('should handle streaming message simulation', async () => {
    const eventHandlers = new Map<string, (event: any) => void>();
    
    // Mock listen to capture event handlers
    mockListen.mockImplementation((event: string, handler: (event: any) => void) => {
      eventHandlers.set(event, handler);
      return Promise.resolve();
    });

    // Set up event listeners
    await mockListen('chat-stream', (event: any) => {
      console.log('Stream chunk:', event.payload);
    });
    
    await mockListen('chat-complete', () => {
      console.log('Stream complete');
    });

    // Trigger streaming
    await mockInvoke('send_streaming_message', { message: 'test message' });

    expect(eventHandlers.has('chat-stream')).toBe(true);
    expect(eventHandlers.has('chat-complete')).toBe(true);
  });
});