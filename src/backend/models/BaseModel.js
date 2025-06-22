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
} 