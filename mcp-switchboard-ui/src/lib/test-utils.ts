/**
 * Legacy test utilities - DEPRECATED
 * 
 * Use the new type-safe testing utilities in ./testing/mockTauri.ts instead.
 * This file is kept for backward compatibility during migration.
 */

import { vi } from 'vitest';
import type { ModelInfo } from './bindings';
import { mockModels, mockTauri } from './testing/mockTauri';

// Re-export for backward compatibility
export { mockModels };

/**
 * @deprecated Use mockTauri from ./testing/mockTauri.ts instead
 */
export const createMockTauriBackend = () => {
  console.warn('createMockTauriBackend is deprecated. Use mockTauri from ./testing/mockTauri.ts instead.');
  
  const mockInvoke = vi.fn();
  const mockListen = vi.fn();

  // Bridge to new mock system
  mockInvoke.mockImplementation(async (command: string, args?: any) => {
    const commandMap: Record<string, string> = {
      'has_api_config': 'hasApiConfig',
      'get_current_model': 'getCurrentModel',
      'get_available_models': 'getAvailableModels',
      'set_preferred_model': 'setPreferredModel',
      'send_streaming_message': 'sendStreamingMessage',
      'get_api_config': 'getApiConfig',
      'save_api_config': 'saveApiConfig',
      'log_info': 'logInfo',
    };

    const mappedCommand = commandMap[command];
    if (!mappedCommand) {
      throw new Error(`Unhandled mock command: ${command}`);
    }

    const result = await (mockTauri as any)[mappedCommand](args);
    // For backward compatibility, return true for successful void operations
    if (result === undefined && ['setPreferredModel', 'saveApiConfig', 'logInfo'].includes(mappedCommand)) {
      return true;
    }
    return result;
  });

  mockListen.mockImplementation((event: string, handler: (event: any) => void) => {
    return mockTauri.addEventListener(event as any, (payload) => {
      handler({ payload });
    });
  });

  return { mockInvoke, mockListen };
};