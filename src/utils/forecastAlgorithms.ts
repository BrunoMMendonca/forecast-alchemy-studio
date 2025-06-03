
import { SalesData } from '@/pages/Index';

export const generateMovingAverage = (salesData: SalesData[], window: number, periods: number): number[] => {
  const values = salesData.map(d => d.sales);
  const predictions: number[] = [];
  
  for (let i = 0; i < periods; i++) {
    const recentValues = values.slice(-window);
    const average = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    predictions.push(average);
    values.push(average);
  }
  
  return predictions;
};

export const generateExponentialSmoothing = (salesData: SalesData[], alpha: number, periods: number): number[] => {
  const values = salesData.map(d => d.sales);
  let lastSmoothed = values[values.length - 1];
  const predictions: number[] = [];
  
  for (let i = 0; i < periods; i++) {
    predictions.push(lastSmoothed);
  }
  
  return predictions;
};

export const generateLinearTrend = (salesData: SalesData[], periods: number): number[] => {
  const values = salesData.map(d => d.sales);
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
