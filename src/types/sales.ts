
export interface SalesData {
  sku: string;
  date: string;
  sales: number;
  isOutlier?: boolean;
  note?: string;
}

export interface ForecastResult {
  sku: string;
  model: string;
  predictions: { date: Date; value: number }[];
  accuracy: number;
  mape?: number;
  parameters?: Record<string, number>;
  confidence?: number;
  optimizedParameters?: Record<string, number>;
  color?: string;
}

export interface EditableForecast {
  date: string;
  value: number;
  isEdited: boolean;
}

export interface OutlierDataPoint {
  sku: string;
  date: string;
  sales: number;
  isOutlier: boolean;
  zScore: number;
}

export interface ChartData {
  sku: string;
  date: string;
  sales: number;
  originalSales: number;
  cleanedSales: number;
  isOutlier?: boolean;
  note?: string;
}
