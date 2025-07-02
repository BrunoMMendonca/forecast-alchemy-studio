export interface ParameterMeta {
  name: string;
  type: string;
  default: any;
  visible: boolean;
  label: string;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  options?: any[];
}

export interface ModelConfig {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  enabled: boolean;
  parameters: Record<string, number>;
  manualParameters: Record<string, number>;
  gridParameters?: Record<string, number>;
  aiParameters?: Record<string, number>;
  bestSource?: 'grid' | 'ai';
  defaultParameters?: Record<string, number>;
  optimizationConfidence?: number;
  optimizationReasoning?: string;
  optimizationFactors?: {
    stability: number;
    interpretability: number;
    complexity: number;
    businessImpact: string;
  };
  expectedAccuracy?: number;
  optimizationMethod?: string;
  icon?: React.ReactNode;
  isSeasonal?: boolean;
  isWinner?: boolean;
  category?: string;
  parametersMeta?: ParameterMeta[];
  bestMethod?: string;
  bestMethodScore?: number;
  winnerMethod?: string;
  compositeScore?: number;
  accuracy?: number;
  gridCompositeScore?: number;
  aiCompositeScore?: number;
  bestCompositeScore?: number;
}

export interface NormalizedSalesData {
  'Material Code': string;
  'Description'?: string;
  'Date': string;
  'Sales': number;
  [key: string]: string | number | undefined;
}

export interface SalesData extends NormalizedSalesData {}

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
  isValid?: boolean;
  method?: string;
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
