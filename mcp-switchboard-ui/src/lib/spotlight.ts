export interface ModelInfo {
  id: string;
  display_name: string;
  organization: string;
}

export interface SpotlightSearch {
  input: string;
  suggestions: string[];
  selectedIndex: number;
  availableModels: ModelInfo[];
  updateCommandSuggestions(): void;
  navigateDown(): void;
  navigateUp(): void;
  selectCurrent(): string;
  reset(): void;
}

export class SpotlightSearchImpl implements SpotlightSearch {
  input = '';
  suggestions: string[] = [];
  selectedIndex = 0;
  availableModels: ModelInfo[] = [];

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
          .slice(0, 10); // Limit to 10 suggestions
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

  reset() {
    this.input = '';
    this.suggestions = [];
    this.selectedIndex = 0;
  }

  setAvailableModels(models: ModelInfo[]) {
    this.availableModels = models;
  }
}