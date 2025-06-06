
import React from 'react';
import { Calculator, TrendingUp, Target, Calendar, Activity, BarChart3, ArrowRight } from 'lucide-react';
import { ModelConfig, Parameter } from '@/types/forecast';

export const getDefaultModels = (): ModelConfig[] => [
  {
    id: 'moving_average',
    name: 'Simple Moving Average',
    description: 'Uses the average of the last N data points to predict future values',
    icon: React.createElement(Calculator, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { 
      window: {
        value: 3,
        min: 1,
        max: 20,
        step: 1,
        label: 'Window Size',
        description: 'Number of periods to average'
      }
    }
  },
  {
    id: 'simple_exponential_smoothing',
    name: 'Simple Exponential Smoothing',
    description: 'Gives more weight to recent observations for stable data without trend',
    icon: React.createElement(TrendingUp, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { 
      alpha: {
        value: 0.3,
        min: 0.01,
        max: 1.0,
        step: 0.01,
        label: 'Alpha (Smoothing)',
        description: 'Smoothing parameter for level'
      }
    }
  },
  {
    id: 'double_exponential_smoothing',
    name: 'Double Exponential Smoothing (Holt)',
    description: 'Handles both level and trend for data with trend but no seasonality',
    icon: React.createElement(ArrowRight, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { 
      alpha: {
        value: 0.3,
        min: 0.01,
        max: 1.0,
        step: 0.01,
        label: 'Alpha (Level)',
        description: 'Smoothing parameter for level'
      },
      beta: {
        value: 0.1,
        min: 0.01,
        max: 1.0,
        step: 0.01,
        label: 'Beta (Trend)',
        description: 'Smoothing parameter for trend'
      }
    }
  },
  {
    id: 'linear_trend',
    name: 'Linear Trend',
    description: 'Fits a linear regression line to historical data and extrapolates',
    icon: React.createElement(Target, { className: "h-4 w-4" }),
    enabled: true,
    parameters: {} // No parameters - should not be cached/optimized
  },
  {
    id: 'seasonal_moving_average',
    name: 'Seasonal Moving Average',
    description: 'Moving average that accounts for seasonal patterns in your data',
    icon: React.createElement(Calendar, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { 
      window: {
        value: 3,
        min: 1,
        max: 20,
        step: 1,
        label: 'Window Size',
        description: 'Number of periods to average'
      },
      seasonalPeriods: {
        value: 12,
        min: 2,
        max: 52,
        step: 1,
        label: 'Seasonal Periods',
        description: 'Number of periods in one season'
      }
    },
    isSeasonal: true
  },
  {
    id: 'holt_winters',
    name: 'Holt-Winters (Triple Exponential)',
    description: 'Advanced model that handles trend and seasonality simultaneously',
    icon: React.createElement(Activity, { className: "h-4 w-4" }),
    enabled: true,
    parameters: { 
      alpha: {
        value: 0.3,
        min: 0.01,
        max: 1.0,
        step: 0.01,
        label: 'Alpha (Level)',
        description: 'Smoothing parameter for level'
      },
      beta: {
        value: 0.1,
        min: 0.01,
        max: 1.0,
        step: 0.01,
        label: 'Beta (Trend)',
        description: 'Smoothing parameter for trend'
      },
      gamma: {
        value: 0.1,
        min: 0.01,
        max: 1.0,
        step: 0.01,
        label: 'Gamma (Seasonal)',
        description: 'Smoothing parameter for seasonality'
      },
      seasonalPeriods: {
        value: 12,
        min: 2,
        max: 52,
        step: 1,
        label: 'Seasonal Periods',
        description: 'Number of periods in one season'
      }
    },
    isSeasonal: true
  },
  {
    id: 'seasonal_naive',
    name: 'Seasonal Naive',
    description: 'Uses the same period from the previous season as the forecast',
    icon: React.createElement(BarChart3, { className: "h-4 w-4" }),
    enabled: true,
    parameters: {}, // No parameters - should not be cached/optimized
    isSeasonal: true
  }
];

// Helper function to check if a model has optimizable parameters
export const hasOptimizableParameters = (model: ModelConfig): boolean => {
  return model.parameters && Object.keys(model.parameters).length > 0;
};
