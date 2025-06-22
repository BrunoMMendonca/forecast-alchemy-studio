import { BaseModel } from './BaseModel.js';

export class SimpleExponentialSmoothing extends BaseModel {
  constructor(parameters = { alpha: 0.3 }) {
    super(parameters);
    this.name = 'Simple Exponential Smoothing';
    this.alpha = parameters.alpha || 0.3;
    this.level = null;
    this.trained = false;
  }

  train(data) {
    if (!data || data.length === 0) {
      throw new Error('Training data cannot be empty');
    }

    // Extract sales values from data
    const values = data.map(d => typeof d === 'object' ? d.sales || d.value || d.amount : d);
    
    if (values.length === 0) {
      throw new Error('No valid sales data found');
    }

    // Initialize level with first observation
    this.level = values[0];
    
    // Apply exponential smoothing
    for (let i = 1; i < values.length; i++) {
      this.level = this.alpha * values[i] + (1 - this.alpha) * this.level;
    }
    
    this.trained = true;
    return this;
  }

  predict(periods) {
    if (!this.trained) {
      throw new Error('Model must be trained before making predictions');
    }

    const predictions = [];
    let currentLevel = this.level;
    
    for (let i = 0; i < periods; i++) {
      predictions.push(currentLevel);
    }
    
    return predictions;
  }

  validate(testData) {
    if (!this.trained) {
      throw new Error('Model must be trained before validation');
    }

    const values = testData.map(d => typeof d === 'object' ? d.sales || d.value || d.amount : d);
    
    if (values.length === 0) {
      throw new Error('Test data cannot be empty');
    }

    // Make predictions for the test period
    const predictions = this.predict(values.length);
    
    // Calculate accuracy metrics
    const mape = this.calculateMAPE(values, predictions);
    const rmse = this.calculateRMSE(values, predictions);
    const mae = this.calculateMAE(values, predictions);
    
    return {
      mape: mape,
      rmse: rmse,
      mae: mae,
      accuracy: Math.max(0, 100 - mape), // Convert MAPE to accuracy percentage
      predictions: predictions,
      actual: values
    };
  }

  calculateMAPE(actual, predicted) {
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }
    
    return count > 0 ? (sum / count) * 100 : 0;
  }

  calculateRMSE(actual, predicted) {
    let sum = 0;
    
    for (let i = 0; i < actual.length; i++) {
      sum += Math.pow(actual[i] - predicted[i], 2);
    }
    
    return Math.sqrt(sum / actual.length);
  }

  calculateMAE(actual, predicted) {
    let sum = 0;
    
    for (let i = 0; i < actual.length; i++) {
      sum += Math.abs(actual[i] - predicted[i]);
    }
    
    return sum / actual.length;
  }

  setParameters(parameters) {
    super.setParameters(parameters);
    this.alpha = parameters.alpha || this.alpha;
  }
} 