export interface FunctionMetadata {
  helpText: string;
  usage?: string;
  examples?: string[];
  category?: string;
}

export interface RegisteredFunction extends FunctionMetadata {
  func: Function;
  name: string;
}

export class HelpSystem {
  private registeredFunctions: Map<string, RegisteredFunction> = new Map();

  private categoryIcons: Record<string, string> = {
    core: '🔧',
    logging: '📊',
    models: '🤖',
    debug: '🐛',
    api: '🌐'
  };

  registerFunction(name: string, func: Function, metadata: Partial<FunctionMetadata>): void {
    this.validateMetadata(name, metadata);
    
    const fullMetadata: RegisteredFunction = {
      helpText: metadata.helpText!,
      usage: metadata.usage,
      examples: metadata.examples,
      category: metadata.category || 'core',
      func,
      name
    };

    this.registeredFunctions.set(name, fullMetadata);
  }

  registerNestedObject(
    objectName: string, 
    obj: Record<string, Function>, 
    metadata: Record<string, Partial<FunctionMetadata>>
  ): void {
    for (const [funcName, func] of Object.entries(obj)) {
      if (typeof func !== 'function') continue;
      
      const fullName = `${objectName}.${funcName}`;
      const funcMetadata = metadata[funcName];
      
      if (!funcMetadata) {
        throw new Error(`Function "${fullName}" must have helpText`);
      }

      this.registerFunction(fullName, func, funcMetadata);
    }
  }

  private validateMetadata(name: string, metadata: Partial<FunctionMetadata>): void {
    if (!metadata.helpText || typeof metadata.helpText !== 'string' || metadata.helpText.trim() === '') {
      throw new Error(`Function "${name}" must have helpText`);
    }
  }

  getAllFunctions(): Record<string, RegisteredFunction> {
    const result: Record<string, RegisteredFunction> = {};
    for (const [name, func] of this.registeredFunctions) {
      result[name] = func;
    }
    return result;
  }

  showHelp(console: Console, category?: string): void {
    const functions = Array.from(this.registeredFunctions.values());
    const filteredFunctions = category 
      ? functions.filter(f => f.category === category)
      : functions;

    if (filteredFunctions.length === 0) {
      console.log(`❌ No functions found${category ? ` in category "${category}"` : ''}`);
      return;
    }

    const title = category 
      ? `📚 MCP Switchboard Debug Help - ${category}`
      : '📚 MCP Switchboard Debug Help';

    console.group(title);

    // Group by category
    const byCategory = filteredFunctions.reduce((acc, func) => {
      const cat = func.category || 'core';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(func);
      return acc;
    }, {} as Record<string, RegisteredFunction[]>);

    for (const [cat, funcs] of Object.entries(byCategory)) {
      if (Object.keys(byCategory).length > 1) {
        console.group(`${this.categoryIcons[cat] || '🔧'} ${cat.toUpperCase()}`);
      }

      funcs.forEach(func => {
        const icon = this.categoryIcons[func.category || 'core'] || '🔧';
        console.log(`${icon} ${func.name} - ${func.helpText}`);
        
        if (func.usage) {
          console.log(`   Usage: ${func.usage}`);
        }
        
        if (func.examples && func.examples.length > 0) {
          console.log('   Examples:');
          func.examples.forEach(example => {
            console.log(`     • ${example}`);
          });
        }
        
        if (funcs.indexOf(func) < funcs.length - 1) {
          console.log(''); // spacing between functions
        }
      });

      if (Object.keys(byCategory).length > 1) {
        console.groupEnd();
      }
    }

    console.groupEnd();
  }

  buildApiObject(console: Console): any {
    const api: any = {};

    // Add help method first
    api.help = (category?: string) => {
      this.showHelp(console, category);
    };

    // Add all registered functions
    for (const [name, registered] of this.registeredFunctions.entries()) {
      if (name.includes('.')) {
        // Nested function like "logging.enable"
        const [objectName, funcName] = name.split('.');
        if (!api[objectName]) {
          api[objectName] = {};
        }
        api[objectName][funcName] = registered.func;
      } else {
        // Top-level function
        api[name] = registered.func;
      }
    }

    return api;
  }
}