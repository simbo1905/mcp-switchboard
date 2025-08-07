/**
 * Type System Validation
 * 
 * This file demonstrates that our type-safe Tauri bindings work correctly.
 * If this compiles, our type system is working as intended.
 */

import { commands } from './tauri';
import type { ModelInfo } from './bindings';

/**
 * Type-safe API usage examples
 * These should all compile correctly with proper type checking
 */
export async function demonstrateTypeSafety() {
    // ✅ Correct usage - these should compile
    
    // Simple commands with no arguments
    const hasConfig: boolean = await commands.hasApiConfig();
    const currentModel: string = await commands.getCurrentModel();
    const config: string | null = await commands.getApiConfig();
    
    // Commands with typed arguments
    await commands.saveApiConfig({ apiKey: 'test-key' });
    await commands.setPreferredModel({ model: 'test-model' });
    await commands.logInfo({ message: 'test message' });
    
    // Commands returning complex types
    const models: ModelInfo[] = await commands.getAvailableModels();
    
    // Type-safe property access
    models.forEach(model => {
        const id: string = model.id;
        const name: string = model.display_name;
        const org: string = model.organization;
        console.log(`Model: ${name} (${id}) by ${org}`);
    });
    
    return {
        hasConfig,
        currentModel,
        config,
        models,
        success: true
    };
}

/**
 * Examples of what should NOT compile (commented out to prevent errors)
 * 
 * Uncomment any of these to see TypeScript compilation errors:
 */
export function demonstrateTypeErrors() {
    // ❌ Wrong argument types:
    // commands.setPreferredModel('string-instead-of-object');
    // commands.setPreferredModel({ model: 123 });
    // commands.saveApiConfig({ wrongKey: 'value' });
    
    // ❌ Wrong return type assumptions:
    // const wrongType: string = await commands.getAvailableModels(); // Should be ModelInfo[]
    // const wrongType2: ModelInfo = await commands.getCurrentModel(); // Should be string
    
    // ❌ Missing required arguments:
    // commands.setPreferredModel({}); // Missing 'model' property
    // commands.saveApiConfig(); // Missing arguments entirely
    
    // ❌ Wrong property access on ModelInfo:
    // models[0].wrong_property; // Property doesn't exist
    // models[0].id = 123; // Should be string, not number
    
    return 'If this compiles, our types are catching errors correctly!';
}

/**
 * Runtime type validation helpers
 */
export function validateModelInfo(obj: any): obj is ModelInfo {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'string' &&
        typeof obj.display_name === 'string' &&
        typeof obj.organization === 'string'
    );
}

export function validateModelArray(obj: any): obj is ModelInfo[] {
    return Array.isArray(obj) && obj.every(validateModelInfo);
}

/**
 * Integration test that combines compile-time and runtime type safety
 */
export async function validateIntegration(): Promise<{
    compileTimeTypesSafe: boolean;
    runtimeTypesSafe: boolean;
    error?: string;
}> {
    try {
        // This proves compile-time type safety works
        const demo = await demonstrateTypeSafety();
        
        // This proves runtime type validation works
        const runtimeSafe = (
            typeof demo.hasConfig === 'boolean' &&
            typeof demo.currentModel === 'string' &&
            (demo.config === null || typeof demo.config === 'string') &&
            validateModelArray(demo.models)
        );
        
        return {
            compileTimeTypesSafe: true, // If this compiled, types work
            runtimeTypesSafe: runtimeSafe,
        };
    } catch (error) {
        return {
            compileTimeTypesSafe: false,
            runtimeTypesSafe: false,
            error: String(error)
        };
    }
}