import type { ForecastPrediction } from '@/types/forecast';
import { generateDates } from '@/utils/dateUtils';
import { NormalizedSalesData } from '@/pages/Index';

export const generateMovingAverage = (
  data: NormalizedSalesData[] | number[],
  windowSize: number,
  forecastPeriods: number
): ForecastPrediction[] => {
  if (data.length === 0) {
    console.log('❌ FORECAST: Empty data array for moving average');
    return [];
  }
  
  // Extract sales values based on input type
  const salesValues = Array.isArray(data) && typeof data[0] === 'object' && 'Sales' in data[0]
    ? data.map(d => Number((d as NormalizedSalesData)['Sales']))
    : data.map(d => Number(d));
    
  if (salesValues.some(isNaN)) {
    console.log('❌ FORECAST: Invalid sales values in data');
    return [];
  }
  
  const lastDate = new Date();
  const dates = generateDates(lastDate, forecastPeriods);
  
  // Calculate the last moving average
  const lastWindow = salesValues.slice(-windowSize);
  const lastMA = lastWindow.reduce((sum, val) => sum + val, 0) / windowSize;
  
  // Generate predictions
  const predictions = dates.map((date, index) => ({
    date,
    value: Math.max(0, lastMA),
    confidence: {
      lower: Math.max(0, lastMA * 0.9),
      upper: lastMA * 1.1,
    },
  }));

  return predictions;
};

export const generateSimpleExponentialSmoothing = (
  data: number[],
  alpha: number,
  forecastPeriods: number
): ForecastPrediction[] => {
  if (data.length === 0) {
    console.log('❌ FORECAST: Empty data array for exponential smoothing');
    return [];
  }

  const lastDate = new Date();
  const dates = generateDates(lastDate, forecastPeriods);
  
  // Calculate the last smoothed value
  let lastSmoothed = data[0];
  for (let i = 1; i < data.length; i++) {
    lastSmoothed = alpha * data[i] + (1 - alpha) * lastSmoothed;
  }
  
  // Generate predictions
  const predictions = dates.map((date, index) => ({
    date,
    value: lastSmoothed,
    confidence: {
      lower: lastSmoothed * 0.9,
      upper: lastSmoothed * 1.1,
    },
  }));

  return predictions;
};

export const generateDoubleExponentialSmoothing = (
  data: number[],
  alpha: number,
  beta: number,
  forecastPeriods: number
): ForecastPrediction[] => {
  if (data.length === 0) return [];
  
  const lastDate = new Date();
  const dates = generateDates(lastDate, forecastPeriods);
  
  // Initialize level and trend
  let level = data[0];
  let trend = data[1] - data[0];
  
  // Calculate final level and trend
  for (let i = 1; i < data.length; i++) {
    const prevLevel = level;
    level = alpha * data[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  
  // Generate predictions
  return dates.map((date, index) => {
    const prediction = level + trend * (index + 1);
    return {
      date,
      value: prediction,
      confidence: {
        lower: prediction * 0.9,
        upper: prediction * 1.1,
      },
    };
  });
};

export const generateLinearTrend = (salesData: NormalizedSalesData[], periods: number): number[] => {
  const values = salesData.map(d => d['Sales']);
  const n = values.length;
  
  const xSum = (n * (n - 1)) / 2;
  const ySum = values.reduce((sum, val) => sum + val, 0);
  const xySum = values.reduce((sum, val, i) => sum + val * i, 0);
  const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;
  
  const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
  const intercept = (ySum - slope * xSum) / n;
  
  const predictions: number[] = [];
  for (let i = 0; i < periods; i++) {
    const prediction = intercept + slope * (n + i);
    predictions.push(Math.max(0, prediction));
  }
  
  return predictions;
};

// Keep the old function name for backward compatibility
export const generateExponentialSmoothing = generateSimpleExponentialSmoothing;
