import { SimpleExponentialSmoothing } from './SimpleExponentialSmoothing.js';
import { HoltLinearTrend } from './HoltLinearTrend.js';
import { MovingAverage } from './MovingAverage.js';
import { HoltWinters } from './HoltWinters.js';
import { LinearTrend } from './LinearTrend.js';
import { SeasonalNaive } from './SeasonalNaive.js';
import { SeasonalMovingAverage } from './SeasonalMovingAverage.js';
import { ARIMAModel } from './ARIMA.js';

// Model factory for creating and managing forecasting models
export class ModelFactory {
  constructor() {
    this.models = new Map();
    this.registerDefaultModels();
  }

  // Register default models
  registerDefaultModels() {
    this.registerModel('simple-exponential-smoothing', SimpleExponentialSmoothing);
    this.registerModel('holt-linear-trend', HoltLinearTrend);
    this.registerModel('moving-average', MovingAverage);
    this.registerModel('holt-winters', HoltWinters);
    this.registerModel('linear-trend', LinearTrend);
    this.registerModel('seasonal-naive', SeasonalNaive);
    this.registerModel('seasonal-moving-average', SeasonalMovingAverage);
    this.registerModel('arima', ARIMAModel);
  }

  // Register a new model type
  registerModel(name, modelClass) {
    this.models.set(name, modelClass);
  }

  // Create a model instance
  createModel(modelType, parameters = {}) {
    const ModelClass = this.models.get(modelType);
    
    if (!ModelClass) {
      throw new Error(`Unknown model type: ${modelType}`);
    }
    
    return new ModelClass(parameters);
  }

  // Get available model types
  getAvailableModels() {
    return Array.from(this.models.keys());
  }

  // Get model information
  getModelInfo(modelType) {
    const ModelClass = this.models.get(modelType);
    
    if (!ModelClass) {
      return null;
    }
    
    const instance = new ModelClass();
    return {
      name: instance.getName(),
      type: modelType,
      defaultParameters: instance.getParameters()
    };
  }

  // Get all model information
  getAllModelInfo() {
    const modelInfo = [];
    
    for (const [type, ModelClass] of this.models) {
      const instance = new ModelClass();
      modelInfo.push({
        name: instance.getName(),
        type: type,
        defaultParameters: instance.getParameters()
      });
    }
    
    return modelInfo;
  }

  // Validate model parameters
  validateParameters(modelType, parameters) {
    const ModelClass = this.models.get(modelType);
    
    if (!ModelClass) {
      throw new Error(`Unknown model type: ${modelType}`);
    }
    
    // Create instance to validate parameters
    const instance = new ModelClass(parameters);
    return instance.getParameters();
  }
}

// Export singleton instance
export const modelFactory = new ModelFactory(); 