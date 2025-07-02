import { BaseModel } from './BaseModel.js';

export class LinearTrend extends BaseModel {
  static metadata = {
    id: 'linear-trend',
    displayName: 'Linear Trend',
    parameters: [],
    get defaultParameters() {
      return {};
    },
    optimizationParameters: {},
    isSeasonal: false,
    className: 'LinearTrend',
    enabled: true
  };

  constructor(parameters = LinearTrend.metadata.defaultParameters) {
    super(parameters);
    this.name = 'Linear Trend';
    this.slope = null;
    this.intercept = null;
    this.trained = false;
  }

  train(data) {
    if (!data || data.length < 2) {
      throw new Error('Training data must have at least 2 observations');
    }

    const values = data.map(d => {
      if (typeof d === 'object') {
        return d.sales || d.Sales || d.value || d.amount || d;
      }
      return d;
    });
    const n = values.length;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    this.slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    this.intercept = (sumY - this.slope * sumX) / n;
    this.historicalDataLength = n;
    
    this.trained = true;
    return this;
  }

  predict(periods) {
    if (!this.trained) {
      throw new Error('Model must be trained before making predictions');
    }

    const predictions = [];
    const lastX = this.historicalDataLength - 1;

    for (let i = 1; i <= periods; i++) {
      const prediction = this.slope * (lastX + i) + this.intercept;
      predictions.push(prediction > 0 ? prediction : 0);
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
    const predictions = this.predict(values.length);

    const mape = this.calculateMAPE(values, predictions);
    const rmse = this.calculateRMSE(values, predictions);
    const mae = this.calculateMAE(values, predictions);
    
    return {
      mape, rmse, mae,
      accuracy: Math.max(0, 100 - mape),
      predictions,
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

  // Override to explicitly define grid search behavior
  static getGridSearchParameters(seasonalPeriod = null) {
    // Linear Trend has no tunable parameters, so run once with defaults
    return [this.metadata.defaultParameters];
  }
}