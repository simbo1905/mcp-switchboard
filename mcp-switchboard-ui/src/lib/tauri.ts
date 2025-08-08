/**
 * Type-safe Tauri command wrapper
 * 
 * This module provides a typed interface to Tauri commands and handles:
 * - Type-safe invoke calls
 * - Proper error handling for Result<T, String> types
 * - Event listening with proper types
 * - Environment detection (browser vs Tauri)
 */

// Declare Tauri globals
declare global {
    interface Window {
        __TAURI__?: any;
        __TAURI_INTERNALS__?: any;
    }
}

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ModelInfo } from '../bindings';

// Define command interfaces (simplified - no longer generated)
interface Commands {
    getApiConfig(): Promise<string | null>;
    saveApiConfig(args: { apiKey: string }): Promise<void>;
    hasApiConfig(): Promise<boolean>;
    sendStreamingMessage(args: { message: string }): Promise<void>;
    logInfo(args: { message: string }): Promise<void>;
    getAvailableModels(): Promise<ModelInfo[]>;
    getCurrentModel(): Promise<string>;
    setPreferredModel(args: { model: string }): Promise<void>;
    getBuildInfo(): Promise<any>; // BuildInfo type
}

interface TauriEvents {
    'chat-stream': { content: string };
    'chat-complete': {};
    'chat-error': { error: string };
}

// Command names for invoke calls
const COMMAND_NAMES = {
    getApiConfig: 'get_api_config',
    saveApiConfig: 'save_api_config', 
    hasApiConfig: 'has_api_config',
    sendStreamingMessage: 'send_streaming_message',
    logInfo: 'log_info',
    getAvailableModels: 'get_available_models',
    getCurrentModel: 'get_current_model',
    setPreferredModel: 'set_preferred_model',
    getBuildInfo: 'get_build_info'
} as const;

// Environment detection - Tauri v2 detection
export const isTauri = typeof window !== 'undefined' && 
    (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);

/**
 * Type-safe wrapper around Tauri's invoke function
 */
class TauriCommands implements Commands {
    private async safeInvoke<T>(command: string, args?: Record<string, any>): Promise<T> {
        if (!isTauri) {
            throw new Error(`Tauri command '${command}' called in browser environment`);
        }

        try {
            const result = await tauriInvoke<T>(command, args);
            return result;
        } catch (error) {
            // Tauri errors come as strings from our Result<T, String> returns
            if (typeof error === 'string') {
                throw new Error(error);
            }
            throw error;
        }
    }

    async getApiConfig(): Promise<string | null> {
        return this.safeInvoke<string | null>(COMMAND_NAMES.getApiConfig);
    }

    async saveApiConfig(args: { apiKey: string }): Promise<void> {
        return this.safeInvoke<void>(COMMAND_NAMES.saveApiConfig, args);
    }

    async hasApiConfig(): Promise<boolean> {
        return this.safeInvoke<boolean>(COMMAND_NAMES.hasApiConfig);
    }

    async sendStreamingMessage(args: { message: string }): Promise<void> {
        return this.safeInvoke<void>(COMMAND_NAMES.sendStreamingMessage, args);
    }

    async logInfo(args: { message: string }): Promise<void> {
        return this.safeInvoke<void>(COMMAND_NAMES.logInfo, args);
    }

    async getAvailableModels(): Promise<ModelInfo[]> {
        return this.safeInvoke<ModelInfo[]>(COMMAND_NAMES.getAvailableModels);
    }

    async getBuildInfo(): Promise<any> {
        return this.safeInvoke<any>(COMMAND_NAMES.getBuildInfo);
    }

    async getCurrentModel(): Promise<string> {
        return this.safeInvoke<string>(COMMAND_NAMES.getCurrentModel);
    }

    async setPreferredModel(args: { model: string }): Promise<void> {
        return this.safeInvoke<void>(COMMAND_NAMES.setPreferredModel, args);
    }
}

/**
 * Type-safe event listening
 */
export async function listenToEvent<K extends keyof TauriEvents>(
    event: K,
    handler: (payload: TauriEvents[K]) => void
): Promise<UnlistenFn> {
    if (!isTauri) {
        throw new Error(`Tauri event listening not available in browser environment`);
    }

    return tauriListen(event, (event) => {
        handler(event.payload as TauriEvents[K]);
    });
}

/**
 * Singleton instance of typed commands
 */
export const commands = new TauriCommands();

/**
 * Helper for handling streaming chat responses
 */
export class ChatStreamHandler {
    private unlistenStream?: UnlistenFn;
    private unlistenComplete?: UnlistenFn;
    private unlistenError?: UnlistenFn;

    async startListening(handlers: {
        onStream: (content: string) => void;
        onComplete: () => void;
        onError: (error: string) => void;
    }) {
        if (!isTauri) {
            throw new Error('Chat streaming not available in browser environment');
        }

        // Set up event listeners
        this.unlistenStream = await listenToEvent('chat-stream', (payload) => handlers.onStream(payload.content));
        this.unlistenComplete = await listenToEvent('chat-complete', handlers.onComplete);
        this.unlistenError = await listenToEvent('chat-error', (payload) => handlers.onError(payload.error));
    }

    async sendMessage(message: string): Promise<void> {
        await commands.sendStreamingMessage({ message });
    }

    stopListening() {
        this.unlistenStream?.();
        this.unlistenComplete?.();
        this.unlistenError?.();
    }
}

/**
 * Error types for better error handling
 */
export class TauriCommandError extends Error {
    constructor(
        message: string,
        public readonly command: string,
        public readonly originalError?: any
    ) {
        super(message);
        this.name = 'TauriCommandError';
    }
}

/**
 * Utility to wrap command calls with enhanced error handling
 */
export async function safeCommand<T>(
    commandFn: () => Promise<T>,
    commandName: string
): Promise<T> {
    try {
        return await commandFn();
    } catch (error) {
        throw new TauriCommandError(
            `Command '${commandName}' failed: ${error}`,
            commandName,
            error
        );
    }
}