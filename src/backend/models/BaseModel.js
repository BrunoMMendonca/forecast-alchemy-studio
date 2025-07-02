// Base class for all forecasting models
export class BaseModel {
  constructor(parameters = {}) {
    this.parameters = parameters;
    this.name = 'BaseModel';
  }

  // Train the model with historical data
  train(data) {
    throw new Error('train() method must be implemented by subclass');
  }

  // Make predictions for future periods
  predict(periods) {
    throw new Error('predict() method must be implemented by subclass');
  }

  // Validate model performance on test data
  validate(testData) {
    throw new Error('validate() method must be implemented by subclass');
  }

  // Get model parameters
  getParameters() {
    return this.parameters;
  }

  // Set model parameters
  setParameters(parameters) {
    this.parameters = { ...this.parameters, ...parameters };
  }

  // Get model name
  getName() {
    return this.name;
  }

  // Add a static helper to get defaultParameters from parameters array
  static getDefaultParameters(parametersArray) {
    return Object.fromEntries(parametersArray.map(p => [p.name, p.default]));
  }

  // Static method to determine if model should be included in grid search
  static shouldIncludeInGridSearch() {
    return true; // Default: include all models in grid search
  }

  // Static method to get grid search parameters for this model
  static getGridSearchParameters(seasonalPeriod = null) {
    // Default implementation: return default parameters if no optimization parameters
    if (this.metadata && this.metadata.optimizationParameters) {
      const optParams = this.metadata.optimizationParameters;
      if (Object.keys(optParams).length === 0) {
        // No optimization parameters - return default parameters
        return [this.metadata.defaultParameters || {}];
      }
      return null; // Let GridOptimizer handle the parameter grid
    }
    // Fallback: return default parameters
    return [this.metadata?.defaultParameters || {}];
  }
} 