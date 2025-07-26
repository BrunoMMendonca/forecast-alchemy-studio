// Base class for all forecasting models
export class BaseModel {
  constructor(parameters = {}) {
    this.parameters = parameters;
    this.name = 'BaseModel';
    this.columnMapping = null; // Will be set during training
  }

  // Helper method to get column value using mapping or fallback
  getColumnValue(row, role, fallbackName) {
    if (this.columnMapping && this.columnMapping[role]) {
      return row[this.columnMapping[role]];
    }
    return row[fallbackName];
  }

  // Helper method to extract sales data using column mapping
  extractSalesData(data) {
    return data.map(row => this.getColumnValue(row, 'Sales', 'Sales'));
  }

  // Helper method to extract date data using column mapping
  extractDateData(data) {
    return data.map(row => this.getColumnValue(row, 'Date', 'Date'));
  }

  // Helper method to extract SKU data using column mapping
  extractSKUData(data) {
    return data.map(row => this.getColumnValue(row, 'Material Code', 'Material Code'));
  }

  // Train the model with historical data
  train(data) {
    // Set up column mapping if data has metadata
    if (data && data.length > 0 && data[0]._columnMapping) {
      this.columnMapping = data[0]._columnMapping;
    }
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