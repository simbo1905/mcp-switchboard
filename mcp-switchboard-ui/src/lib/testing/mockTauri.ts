/**
 * Type-safe mock Tauri API for testing
 * 
 * This provides a complete mock implementation that matches the real Tauri API
 * exactly, ensuring that tests catch any type mismatches between frontend and backend.
 */

import type { Commands, ModelInfo, TauriEvents } from '../bindings';
import { vi, expect, type MockedFunction } from 'vitest';

/**
 * Mock data that matches the Rust backend exactly
 */
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

/**
 * Type-safe mock implementation of Tauri commands
 */
export class MockTauriCommands implements Commands {
    private mockResponses = new Map<string, any>();
    private mockErrors = new Map<string, string>();
    private currentModel = "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";
    private hasApiKey = true;
    private apiKey: string | null = "mock-api-key";
    private callLog: Array<{ command: string; args?: any; timestamp: number }> = [];

    // Event simulation
    private eventListeners = new Map<keyof TauriEvents, Function[]>();

    /**
     * Configure mock responses for commands
     */
    setMockResponse<K extends keyof Commands>(
        command: K, 
        response: Awaited<ReturnType<Commands[K]>>
    ): void {
        this.mockResponses.set(command as string, response);
    }

    /**
     * Configure mock errors for commands
     */
    setMockError(command: keyof Commands, error: string): void {
        this.mockErrors.set(command as string, error);
    }

    /**
     * Get call history for testing
     */
    getCallLog() {
        return [...this.callLog];
    }

    /**
     * Clear call history
     */
    clearCallLog() {
        this.callLog = [];
    }

    /**
     * Reset all mock state
     */
    reset() {
        this.mockResponses.clear();
        this.mockErrors.clear();
        this.callLog = [];
        this.currentModel = "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";
        this.hasApiKey = true;
        this.apiKey = "mock-api-key";
        this.eventListeners.clear();
    }

    private logCall(command: string, args?: any) {
        this.callLog.push({
            command,
            args,
            timestamp: Date.now()
        });
    }

    private async executeCommand<T>(command: string, args?: any): Promise<T> {
        this.logCall(command, args);

        // Check for configured error
        if (this.mockErrors.has(command)) {
            throw new Error(this.mockErrors.get(command)!);
        }

        // Check for configured response
        if (this.mockResponses.has(command)) {
            return this.mockResponses.get(command) as T;
        }

        // Default implementations
        switch (command) {
            case 'getApiConfig':
                return this.apiKey as T;
            
            case 'saveApiConfig':
                this.apiKey = args?.apiKey || null;
                this.hasApiKey = this.apiKey !== null;
                return undefined as T;
            
            case 'hasApiConfig':
                return this.hasApiKey as T;
            
            case 'logInfo':
                console.log(`[Mock Backend] ${args?.message}`);
                return undefined as T;
            
            case 'getAvailableModels':
                return mockModels as T;
            
            case 'getCurrentModel':
                return this.currentModel as T;
            
            case 'setPreferredModel':
                this.currentModel = args?.model || this.currentModel;
                return undefined as T;
            
            case 'sendStreamingMessage':
                // Simulate streaming events
                setTimeout(() => {
                    this.emitEvent('chat-stream', { content: 'Simulated response chunk 1 ' });
                    setTimeout(() => {
                        this.emitEvent('chat-stream', { content: 'Simulated response chunk 2' });
                        setTimeout(() => {
                            this.emitEvent('chat-complete', null);
                        }, 50);
                    }, 50);
                }, 10);
                return undefined as T;
            
            default:
                throw new Error(`Unhandled mock command: ${command}`);
        }
    }

    // Commands implementation

    async getApiConfig(): Promise<string | null> {
        return this.executeCommand<string | null>('getApiConfig');
    }

    async saveApiConfig(args: { apiKey: string }): Promise<void> {
        return this.executeCommand<void>('saveApiConfig', args);
    }

    async hasApiConfig(): Promise<boolean> {
        return this.executeCommand<boolean>('hasApiConfig');
    }

    async sendStreamingMessage(args: { message: string }): Promise<void> {
        return this.executeCommand<void>('sendStreamingMessage', args);
    }

    async logInfo(args: { message: string }): Promise<void> {
        return this.executeCommand<void>('logInfo', args);
    }

    async getAvailableModels(): Promise<ModelInfo[]> {
        return this.executeCommand<ModelInfo[]>('getAvailableModels');
    }

    async getCurrentModel(): Promise<string> {
        return this.executeCommand<string>('getCurrentModel');
    }

    async setPreferredModel(args: { model: string }): Promise<void> {
        return this.executeCommand<void>('setPreferredModel', args);
    }

    // Event system simulation

    addEventListener<K extends keyof TauriEvents>(
        event: K,
        listener: (payload: TauriEvents[K]) => void
    ) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(listener);

        // Return unlisten function
        return () => {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }

    emitEvent<K extends keyof TauriEvents>(event: K, payload: TauriEvents[K]) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(listener => listener(payload));
    }
}

/**
 * Global mock instance for tests
 */
export const mockTauri = new MockTauriCommands();

/**
 * Mock Tauri API object that gets injected into window.__TAURI__
 */
export const mockTauriApi = {
    core: {
        invoke: vi.fn().mockImplementation(async (command: string, args?: any) => {
            // Map command names (snake_case to camelCase)
            const commandMap: Record<string, keyof Commands> = {
                'get_api_config': 'getApiConfig',
                'save_api_config': 'saveApiConfig',
                'has_api_config': 'hasApiConfig',
                'send_streaming_message': 'sendStreamingMessage',
                'log_info': 'logInfo',
                'get_available_models': 'getAvailableModels',
                'get_current_model': 'getCurrentModel',
                'set_preferred_model': 'setPreferredModel',
            };

            const mappedCommand = commandMap[command];
            if (!mappedCommand) {
                throw new Error(`Unknown command: ${command}`);
            }

            return (mockTauri[mappedCommand] as any)(args);
        })
    },
    event: {
        listen: vi.fn().mockImplementation((event: string, handler: (event: any) => void) => {
            return mockTauri.addEventListener(event as any, (payload) => {
                handler({ payload });
            });
        })
    }
};

/**
 * Setup function to configure the mock Tauri environment
 */
export function setupMockTauri() {
    // Mock the window.__TAURI__ object
    Object.defineProperty(window, '__TAURI__', {
        value: mockTauriApi,
        writable: true,
        configurable: true
    });

    // Mock the window.__TAURI_INTERNALS__ object (used by @tauri-apps/api)
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
            invoke: mockTauriApi.core.invoke
        },
        writable: true,
        configurable: true
    });

    // Mock the environment detection
    Object.defineProperty(window, 'location', {
        value: { href: 'tauri://localhost' },
        writable: true,
        configurable: true
    });

    return mockTauri;
}

/**
 * Cleanup function to remove mocks
 */
export function cleanupMockTauri() {
    mockTauri.reset();
    delete (window as any).__TAURI__;
    delete (window as any).__TAURI_INTERNALS__;
}

/**
 * Test helper for type-safe command testing
 */
export function expectCommandCalled<K extends keyof Commands>(
    commandName: K,
    args?: Parameters<Commands[K]>[0]
) {
    const calls = mockTauri.getCallLog().filter(call => call.command === commandName);
    
    expect(calls.length).toBeGreaterThan(0);
    
    if (args !== undefined) {
        const lastCall = calls[calls.length - 1];
        expect(lastCall.args).toEqual(args);
    }
    
    return calls;
}

/**
 * Test helper for streaming tests
 */
export class MockChatStreamHandler {
    private handlers: {
        onStream?: (content: string) => void;
        onComplete?: () => void;
        onError?: (error: string) => void;
    } = {};

    constructor() {
        mockTauri.addEventListener('chat-stream', (payload) => {
            this.handlers.onStream?.(payload.content);
        });

        mockTauri.addEventListener('chat-complete', () => {
            this.handlers.onComplete?.();
        });

        mockTauri.addEventListener('chat-error', (payload) => {
            this.handlers.onError?.(payload.error);
        });
    }

    setHandlers(handlers: {
        onStream?: (content: string) => void;
        onComplete?: () => void;
        onError?: (error: string) => void;
    }) {
        this.handlers = handlers;
    }

    async sendMessage(message: string) {
        await mockTauri.sendStreamingMessage({ message });
    }
}