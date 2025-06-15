
import React from 'react';
import { Calculator, TrendingUp, Target, Calendar, Activity, BarChart3, ArrowRight } from 'lucide-react';
import { ModelConfig } from '@/types/forecast';

export const getDefaultModels = (): ModelConfig[] => [
  {
    id: 'moving_average',
    name: 'Simple Moving Average',
    description: 'Uses the average of the last N data points to predict future values',
    icon: React.createElement(Calculator, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { window: 3 }
  },
  {
    id: 'simple_exponential_smoothing',
    name: 'Simple Exponential Smoothing',
    description: 'Gives more weight to recent observations for stable data without trend',
    icon: React.createElement(TrendingUp, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { alpha: 0.3 }
  },
  {
    id: 'double_exponential_smoothing',
    name: 'Double Exponential Smoothing (Holt)',
    description: 'Handles both level and trend for data with trend but no seasonality',
    icon: React.createElement(ArrowRight, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { alpha: 0.3, beta: 0.1 }
  },
  {
    id: 'linear_trend',
    name: 'Linear Trend',
    description: 'Fits a linear regression line to historical data and extrapolates',
    icon: React.createElement(Target, { className: "h-4 w-4" }),
    enabled: true,
    parameters: {}
  },
  {
    id: 'seasonal_moving_average',
    name: 'Seasonal Moving Average',
    description: 'Moving average that accounts for seasonal patterns in your data',
    icon: React.createElement(Calendar, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { window: 3, seasonalPeriods: 12 },
    isSeasonal: true
  },
  {
    id: 'holt_winters',
    name: 'Holt-Winters (Triple Exponential)',
    description: 'Advanced model that handles trend and seasonality simultaneously',
    icon: React.createElement(Activity, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { alpha: 0.3, beta: 0.1, gamma: 0.1, seasonalPeriods: 12 },
    isSeasonal: true
  },
  {
    id: 'seasonal_naive',
    name: 'Seasonal Naive',
    description: 'Uses the same period from the previous season as the forecast',
    icon: React.createElement(BarChart3, { className: "h-4 w-4" }),
    enabled: true,
    parameters: {},
    isSeasonal: true
  }
];

// Helper function to check if a model has optimizable parameters
export const hasOptimizableParameters = (model: ModelConfig): boolean => {
  return model.parameters && Object.keys(model.parameters).length > 0;
};
