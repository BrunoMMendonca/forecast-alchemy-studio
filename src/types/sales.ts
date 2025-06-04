
export interface SalesData {
  date: string;
  sales: number;
  sku: string;
  isOutlier?: boolean;
  note?: string;
}

export interface ForecastResult {
  sku: string;
  model: string;
  predictions: {
    date: Date;
    value: number;
  }[];
  accuracy: number;
}

export interface EditableForecast {
  date: string;
  value: number;
  isEdited: boolean;
}
