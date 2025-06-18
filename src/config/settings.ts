export interface AISettings {
  enabled: boolean;
  model: 'grok-3' | 'gpt-4' | 'claude-3';
  interactiveMode: boolean;
  confidenceThreshold: number;
}

export interface Settings {
  ai: AISettings;
  aiCsvImportEnabled: boolean;
}

export const defaultSettings: Settings = {
  ai: {
    enabled: true,
    model: 'grok-3',
    interactiveMode: true,
    confidenceThreshold: 0.8
  },
  aiCsvImportEnabled: true
}; 