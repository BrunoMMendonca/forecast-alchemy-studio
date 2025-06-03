
import { Calculator, TrendingUp, Target, Calendar, Activity, BarChart3 } from 'lucide-react';
import { ModelConfig } from '@/types/forecast';

export const getDefaultModels = (): ModelConfig[] => [
  {
    id: 'moving_average',
    name: 'Simple Moving Average',
    description: 'Uses the average of the last N data points to predict future values',
    icon: Calculator({ className: "h-4 w-4" }),
    enabled: true,
    parameters: { window: 3 }
  },
  {
    id: 'exponential_smoothing',
    name: 'Exponential Smoothing',
    description: 'Gives more weight to recent observations while smoothing out fluctuations',
    icon: TrendingUp({ className: "h-4 w-4" }),
    enabled: true,
    parameters: { alpha: 0.3 }
  },
  {
    id: 'linear_trend',
    name: 'Linear Trend',
    description: 'Fits a linear regression line to historical data and extrapolates',
    icon: Target({ className: "h-4 w-4" }),
    enabled: true,
    parameters: {}
  },
  {
    id: 'seasonal_moving_average',
    name: 'Seasonal Moving Average',
    description: 'Moving average that accounts for seasonal patterns in your data',
    icon: Calendar({ className: "h-4 w-4" }),
    enabled: true,
    parameters: { window: 3 },
    isSeasonal: true
  },
  {
    id: 'holt_winters',
    name: 'Holt-Winters (Triple Exponential)',
    description: 'Advanced model that handles trend and seasonality simultaneously',
    icon: Activity({ className: "h-4 w-4" }),
    enabled: true,
    parameters: { alpha: 0.3, beta: 0.1, gamma: 0.1 },
    isSeasonal: true
  },
  {
    id: 'seasonal_naive',
    name: 'Seasonal Naive',
    description: 'Uses the same period from the previous season as the forecast',
    icon: BarChart3({ className: "h-4 w-4" }),
    enabled: true,
    parameters: {},
    isSeasonal: true
  }
];
