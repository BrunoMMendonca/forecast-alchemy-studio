
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
  optimizationMethod?: string; // 'ai_optimal', 'ai_tolerance', 'ai_confidence', 'grid_search', 'fallback'
  icon: React.ReactNode;
  isSeasonal?: boolean;
}

export interface ForecastPrediction {
  date: string;
  value: number;
}

export interface ForecastResult {
  model: string;
  sku: string;
  predictions: ForecastPrediction[];
  accuracy: number;
  parameters: Record<string, number>;
  mape?: number;
  mae?: number;
  rmse?: number;
}

export interface SeasonalConfig {
  enabled: boolean;
  period: number;
  strength: number;
}
