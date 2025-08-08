import { describe, it, expect, beforeEach } from 'vitest';

// Mock the spotlight search functionality
interface SpotlightSearch {
  input: string;
  suggestions: string[];
  selectedIndex: number;
  availableModels: { id: string; display_name: string; organization: string }[];
}

class SpotlightSearchImpl implements SpotlightSearch {
  input = '';
  suggestions: string[] = [];
  selectedIndex = 0;
  availableModels = [
    { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', display_name: 'Meta Llama 3.1 8B', organization: 'Meta' },
    { id: 'deepseek-ai/deepseek-chat', display_name: 'DeepSeek Chat', organization: 'DeepSeek' },
    { id: 'deepseek-ai/deepseek-coder', display_name: 'DeepSeek Coder', organization: 'DeepSeek' },
    { id: 'Qwen/Qwen2.5-7B-Instruct-Turbo', display_name: 'Qwen 2.5 7B', organization: 'Qwen' },
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', display_name: 'Mistral 7B', organization: 'Mistral AI' },
    { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', display_name: 'Llama 4 Scout', organization: 'Meta' }
  ];

  updateCommandSuggestions() {
    const input = this.input.toLowerCase();
    const allCommands = ['/models', '/model'];
    
    if (input === '/') {
      this.suggestions = allCommands;
    } else if (input.startsWith('/model ')) {
      const modelQuery = input.substring(7).toLowerCase();
      if (modelQuery.length >= 3) {
        const filteredModels = this.availableModels
          .filter(model => model.id.toLowerCase().includes(modelQuery))
          .map(model => `/model ${model.id}`)
          .slice(0, 10);
        this.suggestions = filteredModels;
      } else if (modelQuery.length === 0) {
        this.suggestions = ['/model type model name...'];
      } else {
        this.suggestions = [];
      }
    } else {
      this.suggestions = allCommands.filter(cmd => cmd.startsWith(input));
    }
    
    this.selectedIndex = 0;
  }

  navigateDown() {
    if (this.suggestions.length > 0) {
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
    }
  }

  navigateUp() {
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
  }

  selectCurrent(): string {
    if (this.suggestions.length > 0) {
      const selected = this.suggestions[this.selectedIndex];
      this.input = selected;
      this.updateCommandSuggestions();
      return selected;
    }
    return '';
  }
}

describe('Spotlight Search Functionality', () => {
  let spotlight: SpotlightSearchImpl;

  beforeEach(() => {
    spotlight = new SpotlightSearchImpl();
  });

  describe('Basic Command Suggestions', () => {
    it('should show all commands when input is just "/"', () => {
      spotlight.input = '/';
      spotlight.updateCommandSuggestions();
      
      expect(spotlight.suggestions).toEqual(['/models', '/model']);
      expect(spotlight.selectedIndex).toBe(0);
    });

    it('should filter commands based on input', () => {
      spotlight.input = '/mode';
      spotlight.updateCommandSuggestions();
      
      expect(spotlight.suggestions).toEqual(['/models', '/model']);
    });

    it('should filter to single command', () => {
      spotlight.input = '/models';
      spotlight.updateCommandSuggestions();
      
      expect(spotlight.suggestions).toEqual(['/models']);
    });

    it('should show no suggestions for invalid commands', () => {
      spotlight.input = '/invalid';
      spotlight.updateCommandSuggestions();
      
      expect(spotlight.suggestions).toEqual([]);
    });
  });

  describe('Model Filtering', () => {
    it('should show placeholder when /model has no query', () => {
      spotlight.input = '/model ';
      spotlight.updateCommandSuggestions();
      
      expect(spotlight.suggestions).toEqual(['/model type model name...']);
    });

    it('should filter models by partial match (case insensitive)', () => {
      spotlight.input = '/model dee';
      spotlight.updateCommandSuggestions();
      
      const expectedSuggestions = [
        '/model deepseek-ai/deepseek-chat',
        '/model deepseek-ai/deepseek-coder'
      ];
      expect(spotlight.suggestions).toEqual(expectedSuggestions);
    });

    it('should filter models by llama query', () => {
      spotlight.input = '/model llama';
      spotlight.updateCommandSuggestions();
      
      const expectedSuggestions = [
        '/model meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        '/model meta-llama/Llama-4-Scout-17B-16E-Instruct'
      ];
      expect(spotlight.suggestions).toEqual(expectedSuggestions);
    });

    it('should filter models by provider', () => {
      spotlight.input = '/model meta-';
      spotlight.updateCommandSuggestions();
      
      const expectedSuggestions = [
        '/model meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        '/model meta-llama/Llama-4-Scout-17B-16E-Instruct'
      ];
      expect(spotlight.suggestions).toEqual(expectedSuggestions);
    });

    it('should require minimum 3 characters for model filtering', () => {
      spotlight.input = '/model de';
      spotlight.updateCommandSuggestions();
      
      expect(spotlight.suggestions).toEqual([]);
    });

    it('should limit results to 10 models maximum', () => {
      // Add more models to test the limit
      for (let i = 0; i < 15; i++) {
        spotlight.availableModels.push({
          id: `test-model-${i}`,
          display_name: `Test Model ${i}`,
          organization: 'Test'
        });
      }
      
      spotlight.input = '/model test';
      spotlight.updateCommandSuggestions();
      
      expect(spotlight.suggestions.length).toBe(10);
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      spotlight.input = '/';
      spotlight.updateCommandSuggestions();
    });

    it('should navigate down correctly', () => {
      expect(spotlight.selectedIndex).toBe(0);
      
      spotlight.navigateDown();
      expect(spotlight.selectedIndex).toBe(1);
      
      spotlight.navigateDown();
      expect(spotlight.selectedIndex).toBe(1); // Should not go beyond last item
    });

    it('should navigate up correctly', () => {
      spotlight.selectedIndex = 1;
      
      spotlight.navigateUp();
      expect(spotlight.selectedIndex).toBe(0);
      
      spotlight.navigateUp();
      expect(spotlight.selectedIndex).toBe(0); // Should not go below 0
    });

    it('should select current suggestion and update input', () => {
      spotlight.selectedIndex = 1;
      const selected = spotlight.selectCurrent();
      
      expect(selected).toBe('/model');
      expect(spotlight.input).toBe('/model');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty suggestions gracefully', () => {
      spotlight.input = '/nonexistent';
      spotlight.updateCommandSuggestions();
      
      spotlight.navigateDown();
      expect(spotlight.selectedIndex).toBe(0);
      
      const selected = spotlight.selectCurrent();
      expect(selected).toBe('');
    });

    it('should handle model search with special characters', () => {
      spotlight.input = '/model qwen2.5';
      spotlight.updateCommandSuggestions();
      
      expect(spotlight.suggestions).toEqual(['/model Qwen/Qwen2.5-7B-Instruct-Turbo']);
    });

    it('should handle case insensitive model search', () => {
      spotlight.input = '/model MISTRAL';
      spotlight.updateCommandSuggestions();
      
      expect(spotlight.suggestions).toEqual(['/model mistralai/Mistral-7B-Instruct-v0.3']);
    });
  });
});