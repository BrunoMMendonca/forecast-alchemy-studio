
import React from 'react';

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  parameters?: Record<string, number>;
  isSeasonal?: boolean;
  optimizedParameters?: Record<string, number>;
  optimizationConfidence?: number;
}

export interface ForecastAlgorithms {
  generateMovingAverage: (salesData: any[], window: number, periods: number) => number[];
  generateExponentialSmoothing: (salesData: any[], alpha: number, periods: number) => number[];
  generateLinearTrend: (salesData: any[], periods: number) => number[];
}
