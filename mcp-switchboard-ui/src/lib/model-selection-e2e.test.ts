import { vi, beforeEach, describe, it, expect } from 'vitest';
import { createMockTauriBackend, mockModels } from './test-utils';

// Simulate the model selection workflow
class ModelSelectionController {
  private mockInvoke: any;
  private mockListen: any;
  private messages: Array<{ type: 'user' | 'assistant'; content: string }> = [];
  private currentModel = 'Loading...';
  private models: any[] = [];

  constructor(mockInvoke: any, mockListen: any) {
    this.mockInvoke = mockInvoke;
    this.mockListen = mockListen;
  }

  async initialize() {
    const hasApiKey = await this.mockInvoke('has_api_config');
    if (hasApiKey) {
      this.currentModel = await this.mockInvoke('get_current_model');
      this.models = await this.mockInvoke('get_available_models');
    }
    return { hasApiKey, currentModel: this.currentModel, models: this.models };
  }

  async executeModelsCommand() {
    const models = await this.mockInvoke('get_available_models');
    const currentModel = await this.mockInvoke('get_current_model');
    
    let modelList = `📋 **Available Models:**\n\n`;
    modelList += `🎯 **Current:** ${currentModel}\n\n`;
    
    for (const model of models) {
      const current = model.id === currentModel ? ' 👈 *current*' : '';
      modelList += `• **${model.display_name}** (${model.organization})\n`;
      modelList += `  ID: \`${model.id}\`${current}\n\n`;
    }
    modelList += `💡 Use \`/model <model-id>\` to switch models`;
    
    this.messages.push({ type: 'assistant', content: modelList });
    return modelList;
  }

  async executeModelSwitchCommand(modelId: string) {
    try {
      await this.mockInvoke('set_preferred_model', { model: modelId });
      this.currentModel = await this.mockInvoke('get_current_model');
      const successMessage = `✅ **Model switched successfully!**\n\nNow using: \`${modelId}\``;
      this.messages.push({ type: 'assistant', content: successMessage });
      return successMessage;
    } catch (error) {
      const errorMessage = `❌ **Failed to switch model:** ${error}\n\nUse \`/models\` to see valid model IDs.`;
      this.messages.push({ type: 'assistant', content: errorMessage });
      throw new Error(errorMessage);
    }
  }

  getMessages() {
    return this.messages;
  }

  getCurrentModel() {
    return this.currentModel;
  }
}

describe('Model Selection E2E Workflow', () => {
  let mockInvoke: ReturnType<typeof vi.fn>;
  let mockListen: ReturnType<typeof vi.fn>;
  let controller: ModelSelectionController;

  beforeEach(() => {
    const backend = createMockTauriBackend();
    mockInvoke = backend.mockInvoke;
    mockListen = backend.mockListen;
    controller = new ModelSelectionController(mockInvoke, mockListen);
  });

  it('should complete full model selection workflow', async () => {
    // 1. Initialize the application
    const initResult = await controller.initialize();
    
    expect(initResult.hasApiKey).toBe(true);
    expect(initResult.currentModel).toBe('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo');
    expect(initResult.models).toHaveLength(3);

    // Verify initialization API calls
    expect(mockInvoke).toHaveBeenCalledWith('has_api_config');
    expect(mockInvoke).toHaveBeenCalledWith('get_current_model');
    expect(mockInvoke).toHaveBeenCalledWith('get_available_models');

    // 2. Execute /models command
    const modelsResponse = await controller.executeModelsCommand();
    
    expect(modelsResponse).toContain('📋 **Available Models:**');
    expect(modelsResponse).toContain('Meta Llama 3.1 8B Instruct Turbo');
    expect(modelsResponse).toContain('Meta Llama 3.1 70B Instruct Turbo');
    expect(modelsResponse).toContain('Mixtral 8x7B Instruct');
    expect(modelsResponse).toContain('👈 *current*');
    
    // Verify messages were added
    expect(controller.getMessages()).toHaveLength(1);
    expect(controller.getMessages()[0].type).toBe('assistant');

    // 3. Execute model switch command
    const newModelId = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
    const switchResponse = await controller.executeModelSwitchCommand(newModelId);
    
    expect(switchResponse).toContain('Model switched successfully!');
    expect(switchResponse).toContain(newModelId);
    
    // Verify switch API call
    expect(mockInvoke).toHaveBeenCalledWith('set_preferred_model', { model: newModelId });
    
    // Verify current model updated
    expect(controller.getCurrentModel()).toBe(newModelId);
    
    // Verify messages updated
    expect(controller.getMessages()).toHaveLength(2);
    expect(controller.getMessages()[1].type).toBe('assistant');
    expect(controller.getMessages()[1].content).toContain('Model switched successfully!');
  });

  it('should handle model switch errors gracefully', async () => {
    // Initialize with error-prone mock
    const errorMockInvoke = vi.fn().mockImplementation(async (command: string, args?: any) => {
      if (command === 'set_preferred_model') {
        throw new Error('Model not found');
      }
      return createMockTauriBackend().mockInvoke(command, args);
    });

    const errorController = new ModelSelectionController(errorMockInvoke, mockListen);
    
    // Initialize normally
    await errorController.initialize();
    
    // Attempt to switch to invalid model
    await expect(errorController.executeModelSwitchCommand('invalid-model'))
      .rejects
      .toThrow('Failed to switch model');
    
    // Verify error message was added
    const messages = errorController.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('Failed to switch model');
    expect(messages[0].content).toContain('Model not found');
  });

  it('should track user interaction flow', async () => {
    // Simulate user typing /models
    await controller.initialize();
    
    // User triggers models list
    const modelsOutput = await controller.executeModelsCommand();
    expect(modelsOutput).toContain('📋 **Available Models:**');
    
    // User sees available models including:
    expect(modelsOutput).toContain('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo');
    expect(modelsOutput).toContain('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
    expect(modelsOutput).toContain('mistralai/Mixtral-8x7B-Instruct-v0.1');
    
    // User selects a different model
    await controller.executeModelSwitchCommand('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
    
    // Verify the complete flow worked
    expect(controller.getCurrentModel()).toBe('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
    expect(controller.getMessages()).toHaveLength(2);
    
    // Verify all expected API calls were made in order
    const invokeCalls = mockInvoke.mock.calls.map(call => call[0]);
    expect(invokeCalls).toContain('has_api_config');
    expect(invokeCalls).toContain('get_current_model');
    expect(invokeCalls).toContain('get_available_models');
    expect(invokeCalls).toContain('set_preferred_model');
  });

  it('should handle spotlight-style command suggestions', () => {
    // Simulate spotlight command filtering
    const allCommands = ['/models', '/model <id>', '/help'];
    
    // User types "/mod"
    const userInput = '/mod';
    const filteredCommands = allCommands.filter(cmd => 
      cmd.toLowerCase().includes(userInput.toLowerCase().substring(1))
    );
    
    expect(filteredCommands).toContain('/models');
    expect(filteredCommands).toContain('/model <id>');
    expect(filteredCommands).not.toContain('/help');
    expect(filteredCommands).toHaveLength(2);
    
    // User types "/model" (exact match)
    const specificInput = '/model';
    const specificFiltered = allCommands.filter(cmd => 
      cmd.toLowerCase().startsWith(specificInput.toLowerCase())
    );
    
    expect(specificFiltered).toContain('/model <id>');
    // Both "/models" and "/model <id>" start with "/model"
    expect(specificFiltered).toContain('/models'); 
    expect(specificFiltered).toHaveLength(2);
    
    // User types "/models" (more specific)
    const exactInput = '/models';
    const exactFiltered = allCommands.filter(cmd => 
      cmd.toLowerCase().startsWith(exactInput.toLowerCase())
    );
    
    expect(exactFiltered).toContain('/models');
    expect(exactFiltered).not.toContain('/model <id>');
    expect(exactFiltered).toHaveLength(1);
  });
});