import { SimpleExponentialSmoothing } from './SimpleExponentialSmoothing.js';
import { HoltLinearTrend } from './HoltLinearTrend.js';
import { MovingAverage } from './MovingAverage.js';
import { HoltWinters } from './HoltWinters.js';
import { LinearTrend } from './LinearTrend.js';
import { SeasonalNaive } from './SeasonalNaive.js';
import { SeasonalMovingAverage } from './SeasonalMovingAverage.js';
import { ARIMAModel } from './ARIMA.js';
import { SARIMAModel } from './SARIMA.js';
import { db } from '../db.js';

// Helper function to get seasonal periods from frequency
function getSeasonalPeriodsFromFrequency(frequency) {
  switch (frequency) {
    case 'daily': return 7; // weekly seasonality
    case 'weekly': return 52; // yearly seasonality
    case 'monthly': return 12; // yearly seasonality
    case 'quarterly': return 4; // yearly seasonality
    case 'yearly': return 1; // no seasonality
    default: return 12; // default to monthly
  }
}

// Helper function to get seasonal period from global settings
function getSeasonalPeriodFromSettings() {
  return new Promise((resolve) => {
    db.get("SELECT value FROM settings WHERE key = 'global_seasonalPeriods'", [], (err, row) => {
      if (!err && row) {
        try {
          const seasonalPeriods = JSON.parse(row.value);
          resolve(seasonalPeriods);
        } catch (e) {
          console.error('Error parsing seasonal periods setting:', e);
          resolve(12); // default to monthly
        }
      } else {
        // Fallback: try to get from frequency setting
        db.get("SELECT value FROM settings WHERE key = 'global_frequency'", [], (err, freqRow) => {
          if (!err && freqRow) {
            try {
              const frequency = JSON.parse(freqRow.value);
              const seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);
              resolve(seasonalPeriods);
            } catch (e) {
              console.error('Error parsing frequency setting:', e);
              resolve(12); // default to monthly
            }
          } else {
            resolve(12); // default to monthly
          }
        });
      }
    });
  });
}

// Model factory for creating and managing forecasting models
export class ModelFactory {
  constructor() {
    this.models = new Map();
    this.metadata = new Map();
    this.registerAllModels();
  }

  // Dynamically register all models
  registerAllModels() {
    const allModels = [
      SimpleExponentialSmoothing,
      HoltLinearTrend,
      MovingAverage,
      HoltWinters,
      LinearTrend,
      SeasonalNaive,
      SeasonalMovingAverage,
      ARIMAModel,
      SARIMAModel
    ];
    for (const ModelClass of allModels) {
      if (ModelClass.metadata && ModelClass.metadata.id) {
        this.models.set(ModelClass.metadata.id, ModelClass);
        this.metadata.set(ModelClass.metadata.id, ModelClass.metadata);
      }
    }
  }

  // Create a model instance with automatic seasonal period handling
  async createModel(modelType, parameters = {}, seasonalPeriod = null) {
    const ModelClass = this.models.get(modelType);
    if (!ModelClass) {
      throw new Error(`Unknown model type: ${modelType}`);
    }
    const modelInfo = this.metadata.get(modelType);
    if (modelInfo && modelInfo.isSeasonal) {
      if (!seasonalPeriod) throw new Error('seasonalPeriod is required for seasonal models');
      if (modelType === 'sarima') {
        return new SARIMAModel(parameters, seasonalPeriod);
      } else {
        return new ModelClass(parameters, seasonalPeriod);
      }
    } else {
      return new ModelClass(parameters);
    }
  }

  // Synchronous version for cases where async is not available
  createModelSync(modelType, parameters = {}, seasonalPeriod = 12) {
    const ModelClass = this.models.get(modelType);
    
    if (!ModelClass) {
      throw new Error(`Unknown model type: ${modelType}`);
    }
    
    // Check if this is a seasonal model
    const modelInfo = this.metadata.get(modelType);
    if (modelInfo && modelInfo.isSeasonal) {
      // For seasonal models, use provided seasonal period or default
      if (modelType === 'sarima') {
        return new SARIMAModel(parameters, seasonalPeriod);
      } else {
        // For other seasonal models (HoltWinters, SeasonalNaive, SeasonalMovingAverage)
        return new ModelClass(parameters, seasonalPeriod);
      }
    } else {
      // For non-seasonal models, create normally
      return new ModelClass(parameters);
    }
  }

  // Get available model types
  getAvailableModels() {
    return Array.from(this.models.keys());
  }

  // Get model information
  getModelInfo(modelType) {
    return this.metadata.get(modelType) || null;
  }

  // Get model class
  getModelClass(modelType) {
    return this.models.get(modelType) || null;
  }

  // Get all model information
  getAllModelInfo() {
    return Array.from(this.metadata.values());
  }

  // Validate model parameters
  validateParameters(modelType, parameters) {
    const ModelClass = this.models.get(modelType);
    
    if (!ModelClass) {
      throw new Error(`Unknown model type: ${modelType}`);
    }
    
    // Validate parameter ranges before creating model
    const issues = this.validateParameterRanges(modelType, parameters);
    
    if (issues.length > 0) {
      const errorMessage = `Parameter validation failed for ${modelType}:\n${issues.join('\n')}`;
      console.error(`[ModelFactory] ❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }
    
    // Create instance to validate parameters using the sync method
    const instance = this.createModelSync(modelType, parameters);
    return instance.getParameters();
  }

  // Validate parameter ranges to prevent numerical issues
  validateParameterRanges(modelType, parameters) {
    const issues = [];
    
    // Define safe parameter ranges for each model type
    const parameterRanges = {
      'simple-exponential-smoothing': {
        alpha: { min: 0.01, max: 0.99, description: 'Smoothing factor' }
      },
      'holt-linear-trend': {
        alpha: { min: 0.01, max: 0.99, description: 'Level smoothing factor' },
        beta: { min: 0.01, max: 0.99, description: 'Trend smoothing factor' }
      },
      'holt-winters': {
        alpha: { min: 0.01, max: 0.99, description: 'Level smoothing factor' },
        beta: { min: 0.01, max: 0.99, description: 'Trend smoothing factor' },
        gamma: { min: 0.01, max: 0.99, description: 'Seasonal smoothing factor' }
      },
      'moving-average': {
        window: { min: 2, max: 50, description: 'Moving average window size' }
      },
      'seasonal-moving-average': {
        window: { min: 2, max: 20, description: 'Moving average window size' }
      },
      'arima': {
        p: { min: 0, max: 5, description: 'AR order' },
        d: { min: 0, max: 2, description: 'Differencing order' },
        q: { min: 0, max: 5, description: 'MA order' }
      },
      'sarima': {
        p: { min: 0, max: 3, description: 'AR order' },
        d: { min: 0, max: 1, description: 'Differencing order' },
        q: { min: 0, max: 3, description: 'MA order' },
        P: { min: 0, max: 2, description: 'Seasonal AR order' },
        D: { min: 0, max: 1, description: 'Seasonal differencing order' },
        Q: { min: 0, max: 2, description: 'Seasonal MA order' }
      }
    };

    const ranges = parameterRanges[modelType];
    if (ranges) {
      for (const [paramName, range] of Object.entries(ranges)) {
        if (parameters[paramName] !== undefined) {
          const value = parameters[paramName];
          
          // Check if value is a valid number
          if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
            issues.push(`${paramName} (${range.description}): Invalid value "${value}" - must be a finite number`);
            continue;
          }
          
          // Check range
          if (value < range.min || value > range.max) {
            issues.push(`${paramName} (${range.description}): Value ${value} is outside safe range [${range.min}, ${range.max}]`);
          }
          
          // Additional checks for specific parameters
          if (paramName === 'alpha' || paramName === 'beta' || paramName === 'gamma') {
            if (value <= 0 || value >= 1) {
              issues.push(`${paramName} (${range.description}): Value ${value} should be between 0 and 1 (exclusive)`);
            }
          }
          
          if (paramName === 'window') {
            if (value < 2) {
              issues.push(`${paramName} (${range.description}): Value ${value} must be at least 2`);
            }
          }
          
          if (paramName === 'p' || paramName === 'q' || paramName === 'P' || paramName === 'Q') {
            if (value < 0 || !Number.isInteger(value)) {
              issues.push(`${paramName} (${range.description}): Value ${value} must be a non-negative integer`);
            }
          }
          
          if (paramName === 'd' || paramName === 'D') {
            if (value < 0 || value > 2 || !Number.isInteger(value)) {
              issues.push(`${paramName} (${range.description}): Value ${value} must be 0, 1, or 2`);
            }
          }
        }
      }
    }

    return issues;
  }

  // Get minimum data requirements for each model type
  getModelDataRequirements(seasonalPeriod = 12) {
    return {
      'simple-exponential-smoothing': {
        minObservations: 2,
        description: 'Requires at least 2 observations for basic smoothing',
        isSeasonal: false
      },
      'holt-linear-trend': {
        minObservations: 2,
        description: 'Requires at least 2 observations to establish trend',
        isSeasonal: false
      },
      'linear-trend': {
        minObservations: 2,
        description: 'Requires at least 2 observations for linear regression',
        isSeasonal: false
      },
      'moving-average': {
        minObservations: 2,
        description: 'Requires at least 2 observations for averaging',
        isSeasonal: false
      },
      'holt-winters': {
        minObservations: seasonalPeriod * 2,
        description: `Requires at least ${seasonalPeriod * 2} observations (2 full seasons) for seasonal patterns`,
        isSeasonal: true
      },
      'seasonal-naive': {
        minObservations: seasonalPeriod,
        description: `Requires at least ${seasonalPeriod} observations (1 full season) for seasonal patterns`,
        isSeasonal: true
      },
      'seasonal-moving-average': {
        minObservations: seasonalPeriod,
        description: `Requires at least ${seasonalPeriod} observations (1 full season) for seasonal patterns`,
        isSeasonal: true
      },
      'arima': {
        minObservations: 10,
        description: 'Requires at least 10 observations for ARIMA parameter estimation',
        isSeasonal: false
      },
      'sarima': {
        minObservations: seasonalPeriod * 2,
        description: `Requires at least ${seasonalPeriod * 2} observations (2 full seasons) for SARIMA seasonal components`,
        isSeasonal: true
      }
    };
  }

  // Check if a model is compatible with the given data
  isModelCompatible(modelType, dataLength, seasonalPeriod = 12) {
    const requirements = this.getModelDataRequirements(seasonalPeriod);
    const modelReq = requirements[modelType];
    
    if (!modelReq) {
      // For unknown models, assume they need at least 5 observations
      return dataLength >= 5;
    }
    
    return dataLength >= modelReq.minObservations;
  }
}

// Export singleton instance
export const modelFactory = new ModelFactory(); 