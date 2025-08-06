import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpSystem } from './help-system';

describe('HelpSystem', () => {
  let helpSystem: HelpSystem;
  let mockConsole: any;

  beforeEach(() => {
    helpSystem = new HelpSystem();
    mockConsole = {
      log: vi.fn(),
      group: vi.fn(),
      groupEnd: vi.fn(),
      error: vi.fn()
    };
  });

  describe('registerFunction', () => {
    it('should register a function with all required metadata', () => {
      const testFn = vi.fn();
      
      expect(() => {
        helpSystem.registerFunction('test', testFn, {
          helpText: 'Test function',
          category: 'core'
        });
      }).not.toThrow();
    });

    it('should throw error when registering function without helpText', () => {
      const testFn = vi.fn();
      
      expect(() => {
        helpSystem.registerFunction('test', testFn, {});
      }).toThrow('Function "test" must have helpText');
    });

    it('should throw error when registering function with empty helpText', () => {
      const testFn = vi.fn();
      
      expect(() => {
        helpSystem.registerFunction('test', testFn, {
          helpText: ''
        });
      }).toThrow('Function "test" must have helpText');
    });

    it('should default category to "core" when not specified', () => {
      const testFn = vi.fn();
      
      helpSystem.registerFunction('test', testFn, {
        helpText: 'Test function'
      });

      const registered = helpSystem.getAllFunctions();
      expect(registered['test'].category).toBe('core');
    });
  });

  describe('registerNestedObject', () => {
    it('should register nested object functions recursively', () => {
      const nestedObject = {
        enable: vi.fn(),
        disable: vi.fn(),
        status: vi.fn()
      };

      const metadata = {
        enable: { helpText: 'Enable feature', category: 'logging' },
        disable: { helpText: 'Disable feature', category: 'logging' },
        status: { helpText: 'Show status', category: 'logging' }
      };

      helpSystem.registerNestedObject('logging', nestedObject, metadata);

      const registered = helpSystem.getAllFunctions();
      expect(registered['logging.enable']).toBeDefined();
      expect(registered['logging.disable']).toBeDefined();
      expect(registered['logging.status']).toBeDefined();
    });

    it('should throw error when nested function lacks metadata', () => {
      const nestedObject = {
        enable: vi.fn(),
        disable: vi.fn()
      };

      const metadata = {
        enable: { helpText: 'Enable feature' }
        // missing disable metadata
      };

      expect(() => {
        helpSystem.registerNestedObject('logging', nestedObject, metadata);
      }).toThrow('Function "logging.disable" must have helpText');
    });
  });

  describe('showHelp', () => {
    beforeEach(() => {
      const testFn1 = vi.fn();
      const testFn2 = vi.fn();
      
      helpSystem.registerFunction('info', testFn1, {
        helpText: 'Show system information',
        usage: 'window.mcps.info()',
        examples: ['window.mcps.info()'],
        category: 'core'
      });

      helpSystem.registerFunction('debug', testFn2, {
        helpText: 'Enable debug mode',
        category: 'core'
      });
    });

    it('should show all functions when no category specified', () => {
      helpSystem.showHelp(mockConsole);

      expect(mockConsole.group).toHaveBeenCalledWith('📚 MCP Switchboard Debug Help');
      expect(mockConsole.log).toHaveBeenCalledWith('🔧 info - Show system information');
      expect(mockConsole.log).toHaveBeenCalledWith('🔧 debug - Enable debug mode');
      expect(mockConsole.groupEnd).toHaveBeenCalled();
    });

    it('should show only functions from specified category', () => {
      const loggingFn = vi.fn();
      helpSystem.registerFunction('enable', loggingFn, {
        helpText: 'Enable logging',
        category: 'logging'
      });

      helpSystem.showHelp(mockConsole, 'logging');

      expect(mockConsole.group).toHaveBeenCalledWith('📚 MCP Switchboard Debug Help - logging');
      expect(mockConsole.log).toHaveBeenCalledWith('📊 enable - Enable logging');
      expect(mockConsole.log).not.toHaveBeenCalledWith(expect.stringContaining('info'));
    });

    it('should show usage and examples when available', () => {
      helpSystem.showHelp(mockConsole);

      expect(mockConsole.log).toHaveBeenCalledWith('   Usage: window.mcps.info()');
      expect(mockConsole.log).toHaveBeenCalledWith('   Examples:');
      expect(mockConsole.log).toHaveBeenCalledWith('     • window.mcps.info()');
    });

    it('should handle category icons correctly', () => {
      const loggingFn = vi.fn();
      const modelsFn = vi.fn();
      
      helpSystem.registerFunction('enable', loggingFn, {
        helpText: 'Enable logging',
        category: 'logging'
      });

      helpSystem.registerFunction('list', modelsFn, {
        helpText: 'List models',
        category: 'models'
      });

      helpSystem.showHelp(mockConsole);

      expect(mockConsole.log).toHaveBeenCalledWith('📊 enable - Enable logging');
      expect(mockConsole.log).toHaveBeenCalledWith('🤖 list - List models');
    });
  });

  describe('buildApiObject', () => {
    it('should build flat API object with help method', () => {
      const testFn = vi.fn();
      
      helpSystem.registerFunction('info', testFn, {
        helpText: 'Show info',
        category: 'core'
      });

      const api = helpSystem.buildApiObject(mockConsole);

      expect(api.info).toBe(testFn);
      expect(typeof api.help).toBe('function');
    });

    it('should build nested API object structure', () => {
      const loggingFns = {
        enable: vi.fn(),
        disable: vi.fn()
      };

      helpSystem.registerNestedObject('logging', loggingFns, {
        enable: { helpText: 'Enable logging', category: 'logging' },
        disable: { helpText: 'Disable logging', category: 'logging' }
      });

      const api = helpSystem.buildApiObject(mockConsole);

      expect(api.logging.enable).toBe(loggingFns.enable);
      expect(api.logging.disable).toBe(loggingFns.disable);
    });

    it('should include help method that calls showHelp', () => {
      // Register a test function first
      const testFn = vi.fn();
      helpSystem.registerFunction('test', testFn, {
        helpText: 'Test function',
        category: 'core'
      });
      
      const api = helpSystem.buildApiObject(mockConsole);
      
      api.help();
      
      expect(mockConsole.group).toHaveBeenCalledWith('📚 MCP Switchboard Debug Help');
    });

    it('should pass category parameter to help method', () => {
      // Register a test function first
      const testFn = vi.fn();
      helpSystem.registerFunction('test', testFn, {
        helpText: 'Test function',
        category: 'logging'
      });
      
      const api = helpSystem.buildApiObject(mockConsole);
      
      api.help('logging');
      
      expect(mockConsole.group).toHaveBeenCalledWith('📚 MCP Switchboard Debug Help - logging');
    });
  });

  describe('validation edge cases', () => {
    it('should handle functions with null helpText', () => {
      const testFn = vi.fn();
      
      expect(() => {
        helpSystem.registerFunction('test', testFn, {
          helpText: null as any
        });
      }).toThrow('Function "test" must have helpText');
    });

    it('should handle functions with undefined helpText', () => {
      const testFn = vi.fn();
      
      expect(() => {
        helpSystem.registerFunction('test', testFn, {
          helpText: undefined as any
        });
      }).toThrow('Function "test" must have helpText');
    });

    it('should trim whitespace from helpText', () => {
      const testFn = vi.fn();
      
      expect(() => {
        helpSystem.registerFunction('test', testFn, {
          helpText: '   '
        });
      }).toThrow('Function "test" must have helpText');
    });
  });
});