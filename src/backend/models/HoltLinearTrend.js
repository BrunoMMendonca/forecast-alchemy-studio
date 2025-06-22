import { BaseModel } from './BaseModel.js';

export class HoltLinearTrend extends BaseModel {
  constructor(parameters = { alpha: 0.3, beta: 0.1 }) {
    super(parameters);
    this.name = "Holt's Linear Trend";
    this.alpha = parameters.alpha || 0.3;
    this.beta = parameters.beta || 0.1;
    this.level = null;
    this.trend = null;
    this.trained = false;
  }

  train(data) {
    if (!data || data.length < 2) {
      throw new Error('Training data must have at least 2 observations');
    }

    // Extract sales values from data
    const values = data.map(d => typeof d === 'object' ? d.sales || d.value || d.amount : d);
    
    if (values.length < 2) {
      throw new Error('No valid sales data found');
    }

    // Initialize level and trend
    this.level = values[0];
    this.trend = values[1] - values[0]; // Simple trend initialization
    
    // Apply Holt's method
    for (let i = 1; i < values.length; i++) {
      const prevLevel = this.level;
      const prevTrend = this.trend;
      
      // Update level
      this.level = this.alpha * values[i] + (1 - this.alpha) * (prevLevel + prevTrend);
      
      // Update trend
      this.trend = this.beta * (this.level - prevLevel) + (1 - this.beta) * prevTrend;
    }
    
    this.trained = true;
    return this;
  }

  predict(periods) {
    if (!this.trained) {
      throw new Error('Model must be trained before making predictions');
    }

    const predictions = [];
    
    for (let i = 1; i <= periods; i++) {
      const prediction = this.level + i * this.trend;
      predictions.push(prediction);
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
      accuracy: Math.max(0, 100 - mape),
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
    this.beta = parameters.beta || this.beta;
  }
} 