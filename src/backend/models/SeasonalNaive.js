import { BaseModel } from './BaseModel.js';

export class SeasonalNaive extends BaseModel {
  constructor(parameters = { seasonLength: 4 }) {
    super(parameters);
    this.name = 'Seasonal Naive';
    this.seasonLength = parameters.seasonLength || 4;
    this.historicalData = [];
    this.trained = false;
  }

  train(data) {
    if (!data || data.length < this.seasonLength) {
      throw new Error(`Training data must have at least one full season (${this.seasonLength} observations)`);
    }

    this.historicalData = data.map(d => typeof d === 'object' ? d.sales || d.value || d.amount : d);
    this.trained = true;
    return this;
  }

  predict(periods) {
    if (!this.trained) {
      throw new Error('Model must be trained before making predictions');
    }

    const predictions = [];
    for (let i = 1; i <= periods; i++) {
      const lastSeasonIndex = this.historicalData.length - this.seasonLength + ((i - 1) % this.seasonLength);
      if (lastSeasonIndex < this.historicalData.length) {
        predictions.push(this.historicalData[lastSeasonIndex]);
      } else {
        // Fallback if we somehow ask for a prediction beyond what's available
        predictions.push(this.historicalData[this.historicalData.length - this.seasonLength]);
      }
    }
    
    return predictions;
  }

  validate(testData) {
    if (!this.trained) {
      throw new Error('Model must be trained before validation');
    }

    const values = testData.map(d => typeof d === 'object' ? d.sales || d.value || d.amount : d);
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

  setParameters(parameters) {
    super.setParameters(parameters);
    this.seasonLength = parameters.seasonLength || this.seasonLength;
  }
}
