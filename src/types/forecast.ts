export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  parameters?: Record<string, number>;
  optimizedParameters?: Record<string, number>;
  optimizationConfidence?: number;
  optimizationReasoning?: string;
  optimizationFactors?: {
    stability: number;
    interpretability: number;
    complexity: number;
    businessImpact: string;
  };
  expectedAccuracy?: number;
  optimizationMethod?: string; // 'ai_optimal', 'ai_tolerance', 'ai_confidence', 'grid', 'fallback'
  icon: React.ReactNode;
  isSeasonal?: boolean;
  isWinner?: boolean;
}

export interface SalesData {
  'Material Code': string;
  'Description'?: string;
  'Date': string;
  'Sales': number;
  [key: string]: string | number | undefined;
}

export interface ForecastPrediction {
  date: string;
  value: number;
  confidence?: {
    lower: number;
    upper: number;
  };
}

export interface ForecastResult {
  sku: string;
  model: string;
  predictions: ForecastPrediction[];
  accuracy?: number;
  parameters?: Record<string, number>;
}

export interface SeasonalConfig {
  enabled: boolean;
  period: number;
  strength: number;
}

export interface ForecastModel {
  id: string;
  name: string;
  description: string;
  parameters: {
    name: string;
    type: 'number' | 'boolean' | 'select';
    default: number | boolean | string;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  }[];
}

export interface ForecastState {
  forecastResults: ForecastResult[];
  selectedSKU: string;
  forecastPeriods: number;
  isGenerating: boolean;
  error: string | null;
}
