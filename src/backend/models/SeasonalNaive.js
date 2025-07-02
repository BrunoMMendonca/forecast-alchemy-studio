import { BaseModel } from './BaseModel.js';

export class SeasonalNaive extends BaseModel {
  static metadata = {
    id: 'seasonal-naive',
    displayName: 'Seasonal Naive',
    parameters: [
      // No seasonalPeriods parameter
    ],
    get defaultParameters() {
      return Object.fromEntries(this.parameters.map(p => [p.name, p.default]));
    },
    optimizationParameters: {},
    isSeasonal: true,
    className: 'SeasonalNaive',
    enabled: true
  };

  // Override to explicitly define grid search behavior
  static getGridSearchParameters(seasonalPeriod = null) {
    // Seasonal Naive has no tunable parameters, so run once with defaults
    return [this.metadata.defaultParameters];
  }

  constructor(parameters = SeasonalNaive.metadata.defaultParameters, seasonLength = 12) {
    super(parameters);
    this.name = 'Seasonal Naive';
    this.seasonLength = seasonLength; // Set from settings/frequency
    this.historicalData = [];
    this.trained = false;
  }

  train(data) {
    if (!data || data.length < this.seasonLength) {
      throw new Error(`Training data must have at least one full season (${this.seasonLength} observations)`);
    }

    this.historicalData = data.map(d => {
      if (typeof d === 'object') {
        return d.sales || d.Sales || d.value || d.amount || d;
      }
      return d;
    });
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

  setParameters(parameters) {
    super.setParameters(parameters);
    this.seasonLength = parameters.seasonLength || this.seasonLength;
  }
}
