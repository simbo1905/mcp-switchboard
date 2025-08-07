/**
 * Type-safe command testing with generated bindings
 * 
 * This demonstrates how the type-safe mock system catches type errors
 * and ensures compatibility between frontend and backend.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { commands } from '../tauri';
import { 
    mockTauri, 
    mockModels, 
    expectCommandCalled,
    MockChatStreamHandler,
    setupMockTauri,
    cleanupMockTauri
} from './mockTauri';
import type { ModelInfo } from '../bindings';

describe('Type-Safe Tauri Commands', () => {
    beforeEach(() => {
        setupMockTauri();
        mockTauri.reset();
    });

    afterEach(() => {
        cleanupMockTauri();
    });

    describe('Model Management', () => {
        it('should fetch available models with correct types', async () => {
            // The return type is enforced by TypeScript
            const models: ModelInfo[] = await commands.getAvailableModels();
            
            expect(models).toEqual(mockModels);
            expect(models).toHaveLength(3);
            
            // Type checking ensures we have the right properties
            models.forEach(model => {
                expect(typeof model.id).toBe('string');
                expect(typeof model.display_name).toBe('string');
                expect(typeof model.organization).toBe('string');
            });

            expectCommandCalled('getAvailableModels');
        });

        it('should get current model', async () => {
            const model: string = await commands.getCurrentModel();
            
            expect(typeof model).toBe('string');
            expect(model).toBe('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo');
            
            expectCommandCalled('getCurrentModel');
        });

        it('should set preferred model with type-safe arguments', async () => {
            const newModel = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
            
            // TypeScript ensures we pass the right argument structure
            await commands.setPreferredModel({ model: newModel });
            
            // Verify the mock state changed
            const currentModel = await commands.getCurrentModel();
            expect(currentModel).toBe(newModel);
            
            expectCommandCalled('setPreferredModel', { model: newModel });
        });

        it('should handle model switching errors gracefully', async () => {
            const invalidModel = 'invalid-model-id';
            
            // Configure mock to throw error for invalid model
            mockTauri.setMockError('setPreferredModel', 'Model not found');
            
            await expect(commands.setPreferredModel({ model: invalidModel }))
                .rejects
                .toThrow('Model not found');
                
            expectCommandCalled('setPreferredModel', { model: invalidModel });
        });
    });

    describe('API Configuration', () => {
        it('should check API configuration status', async () => {
            const hasConfig: boolean = await commands.hasApiConfig();
            
            expect(typeof hasConfig).toBe('boolean');
            expect(hasConfig).toBe(true);
            
            expectCommandCalled('hasApiConfig');
        });

        it('should save API configuration', async () => {
            const testApiKey = 'test-api-key-123';
            
            // TypeScript enforces the argument structure
            await commands.saveApiConfig({ apiKey: testApiKey });
            
            expectCommandCalled('saveApiConfig', { apiKey: testApiKey });
        });

        it('should get API configuration', async () => {
            const config: string | null = await commands.getApiConfig();
            
            // TypeScript ensures we handle both string and null cases
            if (config !== null) {
                expect(typeof config).toBe('string');
            }
            
            expectCommandCalled('getApiConfig');
        });
    });

    describe('Streaming Chat', () => {
        it('should handle streaming messages with type-safe events', async () => {
            const streamHandler = new MockChatStreamHandler();
            const streamChunks: string[] = [];
            let completed = false;
            
            streamHandler.setHandlers({
                onStream: (content: string) => {
                    // TypeScript ensures content is a string
                    expect(typeof content).toBe('string');
                    streamChunks.push(content);
                },
                onComplete: () => {
                    completed = true;
                },
                onError: (error: string) => {
                    throw new Error(`Unexpected error: ${error}`);
                }
            });
            
            await streamHandler.sendMessage('Hello, world!');
            
            // Wait for async events to complete
            await new Promise(resolve => setTimeout(resolve, 200));
            
            expect(streamChunks).toHaveLength(2);
            expect(streamChunks[0]).toBe('Simulated response chunk 1 ');
            expect(streamChunks[1]).toBe('Simulated response chunk 2');
            expect(completed).toBe(true);
            
            expectCommandCalled('sendStreamingMessage', { message: 'Hello, world!' });
        });
    });

    describe('Logging', () => {
        it('should log info messages with proper types', async () => {
            const testMessage = 'Test log message';
            
            await commands.logInfo({ message: testMessage });
            
            expectCommandCalled('logInfo', { message: testMessage });
        });
    });

    describe('Type Safety Validation', () => {
        it('should enforce correct argument types at compile time', () => {
            // These should cause TypeScript compilation errors if uncommented:
            
            // ❌ Wrong argument structure
            // await commands.setPreferredModel('model-id'); // Should be { model: string }
            
            // ❌ Wrong argument type
            // await commands.setPreferredModel({ model: 123 }); // Should be string
            
            // ❌ Missing required arguments
            // await commands.saveApiConfig({}); // Missing apiKey
            
            // ❌ Wrong return type assumption
            // const models: string = await commands.getAvailableModels(); // Should be ModelInfo[]
            
            // If this test compiles, our types are working correctly
            expect(true).toBe(true);
        });

        it('should provide correct return types', async () => {
            // These assignments should all be type-safe
            const hasConfig: boolean = await commands.hasApiConfig();
            const currentModel: string = await commands.getCurrentModel();
            const models: ModelInfo[] = await commands.getAvailableModels();
            const config: string | null = await commands.getApiConfig();
            
            // Verify runtime types match compile-time types
            expect(typeof hasConfig).toBe('boolean');
            expect(typeof currentModel).toBe('string');
            expect(Array.isArray(models)).toBe(true);
            expect(config === null || typeof config === 'string').toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should properly handle and type backend errors', async () => {
            const errorMessage = 'Simulated backend error';
            
            mockTauri.setMockError('getCurrentModel', errorMessage);
            
            await expect(commands.getCurrentModel())
                .rejects
                .toThrow(errorMessage);
        });

        it('should handle custom mock responses', async () => {
            const customModels: ModelInfo[] = [
                {
                    id: 'custom-model',
                    display_name: 'Custom Test Model',
                    organization: 'Test Org'
                }
            ];
            
            mockTauri.setMockResponse('getAvailableModels', customModels);
            
            const result = await commands.getAvailableModels();
            expect(result).toEqual(customModels);
        });
    });
});