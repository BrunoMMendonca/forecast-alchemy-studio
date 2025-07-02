import { SimpleExponentialSmoothing } from './SimpleExponentialSmoothing.js';
import { HoltLinearTrend } from './HoltLinearTrend.js';
import { MovingAverage } from './MovingAverage.js';
import { HoltWinters } from './HoltWinters.js';
import { LinearTrend } from './LinearTrend.js';
import { SeasonalNaive } from './SeasonalNaive.js';
import { SeasonalMovingAverage } from './SeasonalMovingAverage.js';
import { ARIMAModel } from './ARIMA.js';
import { SARIMAModel } from './SARIMA.js';
import isEqual from 'lodash.isequal';

const ALL_MODEL_METADATA = [
  SimpleExponentialSmoothing.metadata,
  HoltLinearTrend.metadata,
  MovingAverage.metadata,
  HoltWinters.metadata,
  LinearTrend.metadata,
  SeasonalNaive.metadata,
  SeasonalMovingAverage.metadata,
  ARIMAModel.metadata,
  SARIMAModel.metadata
];

export const MODEL_METADATA = ALL_MODEL_METADATA.filter(m => m.enabled !== false); 