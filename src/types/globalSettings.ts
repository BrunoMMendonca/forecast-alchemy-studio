import { BusinessContext } from './businessContext';

export interface GlobalSettings {
  forecastPeriods: number;
  businessContext: BusinessContext;
  aiForecastModelOptimizationEnabled: boolean;
  aiCsvImportEnabled: boolean;
  aiFailureThreshold: number;
  largeFileProcessingEnabled: boolean;
  largeFileThreshold: number; // in bytes, default 1MB
  aiReasoningEnabled: boolean;
  mapeWeight: number; // as percent, e.g. 40
  rmseWeight: number;
  maeWeight: number;
  accuracyWeight: number; // as percent, e.g. 10
  
  frequency?: string;
  autoDetectFrequency?: boolean;
  csvSeparator?: string;
} 