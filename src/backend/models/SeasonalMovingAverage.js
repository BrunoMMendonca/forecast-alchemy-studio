import { BaseModel } from './BaseModel.js';

export class SeasonalMovingAverage extends BaseModel {
  static metadata = {
    id: 'seasonal-moving-average',
    displayName: 'Seasonal Moving Average',
    parameters: [
      { name: 'window', type: 'number', default: 3, visible: true, label: 'Window Size', description: 'Number of periods to average over.' },
    ],
    get defaultParameters() {
      return Object.fromEntries(this.parameters.map(p => [p.name, p.default]));
    },
    optimizationParameters: { window: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
    isSeasonal: true,
    className: 'SeasonalMovingAverage',
    enabled: true
  };

  constructor(parameters = SeasonalMovingAverage.metadata.defaultParameters, seasonLength = 12) {
    super(parameters);
    this.name = 'Seasonal Moving Average';
    this.seasonLength = seasonLength;
    this.window = parameters.window || 3;
    this.historicalData = [];
    this.seasonalAverages = [];
    this.trained = false;
  }

  train(data) {
    if (!data || data.length < this.seasonLength) {
      throw new Error(`Training data must have at least one full season (${this.seasonLength} observations)`);
    }

    const values = data.map(d => {
      if (typeof d === 'object') {
        return d.sales || d.Sales || d.value || d.amount || d;
      }
      return d;
    });
    this.historicalData = values;
    
    // De-seasonalize the data
    const seasonalIndices = this._calculateSeasonalIndices(values);
    const deseasonalizedData = values.map((val, i) => val / seasonalIndices[i % this.seasonLength]);
    
    // We don't need to store moving average results in the model itself for this one
    // The prediction logic will handle it.
    
    this.trained = true;
    return this;
  }
  
  _calculateSeasonalIndices(values) {
    const numSeasons = Math.floor(values.length / this.seasonLength);
    if (numSeasons === 0) {
      // If less than a full season, return neutral indices
      return new Array(this.seasonLength).fill(1);
    }

    const seasonAvgs = new Array(this.seasonLength).fill(0);
    const seasonCounts = new Array(this.seasonLength).fill(0);

    for (let i = 0; i < values.length; i++) {
      seasonAvgs[i % this.seasonLength] += values[i];
      seasonCounts[i % this.seasonLength]++;
    }

    for (let i = 0; i < this.seasonLength; i++) {
      seasonAvgs[i] /= seasonCounts[i];
    }
    
    const overallAvg = seasonAvgs.reduce((sum, val) => sum + val, 0) / this.seasonLength;
    return seasonAvgs.map(avg => avg / overallAvg);
  }

  predict(periods) {
    if (!this.trained) {
      throw new Error('Model must be trained before making predictions');
    }

    // De-seasonalize for moving average calculation
    const seasonalIndices = this._calculateSeasonalIndices(this.historicalData);
    const deseasonalizedData = this.historicalData.map((val, i) => val / seasonalIndices[i % this.seasonLength]);

    const movingAverages = [];
    for (let i = 0; i < periods; i++) {
        const history = deseasonalizedData.slice(-this.window);
        const forecast = history.reduce((a,b) => a+b, 0) / this.window;
        movingAverages.push(forecast);
        deseasonalizedData.push(forecast); // Add forecast to continue the series
    }

    // Re-seasonalize the forecast
    const predictions = movingAverages.map((forecast, i) => {
        const seasonIndex = (this.historicalData.length + i) % this.seasonLength;
        return forecast * seasonalIndices[seasonIndex];
    });

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
    let sum = 0, count = 0;
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
    this.window = parameters.window || this.window;
  }
}
