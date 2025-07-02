import { BaseModel } from './BaseModel.js';

export class MovingAverage extends BaseModel {
  static metadata = {
    id: 'moving-average',
    displayName: 'Simple Moving Average',
    parameters: [
      { name: 'window', type: 'number', default: 3, visible: true, label: 'Window Size', description: 'Number of periods to average over.' },
    ],
    get defaultParameters() {
      return Object.fromEntries(this.parameters.map(p => [p.name, p.default]));
    },
    optimizationParameters: { window: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
    isSeasonal: false,
    className: 'MovingAverage',
    enabled: true
  };

  constructor(parameters = MovingAverage.metadata.defaultParameters) {
    super(parameters);
    this.name = 'Simple Moving Average';
    this.window = parameters.window || 3;
    this.historicalData = [];
    this.trained = false;
  }

  train(data) {
    if (!data || data.length === 0) {
      throw new Error('Training data cannot be empty');
    }

    // Extract sales values from data - check for both lowercase and uppercase field names
    const values = data.map(d => {
      if (typeof d === 'object') {
        return d.sales || d.Sales || d.value || d.amount || d;
      }
      return d;
    });
    
    if (values.length === 0) {
      throw new Error('No valid sales data found');
    }

    // Store historical data
    this.historicalData = [...values];
    this.trained = true;
    return this;
  }

  predict(periods) {
    if (!this.trained) {
      throw new Error('Model must be trained before making predictions');
    }

    if (this.historicalData.length < this.window) {
      throw new Error(`Need at least ${this.window} observations for ${this.window}-period moving average`);
    }

    const predictions = [];
    
    for (let i = 0; i < periods; i++) {
      // Calculate moving average using the last 'window' observations
      const recentData = this.historicalData.slice(-this.window);
      const average = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
      predictions.push(average);
      
      // Update historical data with the prediction (for next iteration)
      this.historicalData.push(average);
    }
    
    return predictions;
  }

  validate(testData) {
    if (!this.trained) {
      throw new Error('Model must be trained before validation');
    }

    const values = testData.map(d => {
      if (typeof d === 'object') {
        return d.sales || d.Sales || d.value || d.amount || d;
      }
      return d;
    });
    
    if (values.length === 0) {
      throw new Error('Test data cannot be empty');
    }

    if (this.historicalData.length < this.window) {
      throw new Error(`Need at least ${this.window} observations for validation`);
    }

    // Make predictions for the test period
    const predictions = [];
    const tempHistoricalData = [...this.historicalData];
    
    for (let i = 0; i < values.length; i++) {
      const recentData = tempHistoricalData.slice(-this.window);
      const average = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
      predictions.push(average);
      tempHistoricalData.push(values[i]); // Use actual value for next prediction
    }
    
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
    this.window = parameters.window || this.window;
  }
} 