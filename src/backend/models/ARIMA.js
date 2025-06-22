import { BaseModel } from './BaseModel.js';
import ARIMAPromise from 'arima/async';

// ARIMA model wrapper
export class ARIMAModel extends BaseModel {
  constructor(parameters = { auto: true, verbose: false }) {
    super(parameters);
    this.name = 'ARIMA';
    this.arima = null; // Will hold the ARIMA instance
    this.trained = false;
  }

  async train(data) {
    if (!data || data.length < 10) { // ARIMA needs a reasonable amount of data
      throw new Error('Training data must have at least 10 observations for ARIMA');
    }

    const values = data.map(d => typeof d === 'object' ? d.sales || d.value || d.amount : d);
    
    // The library loads asynchronously (to support browsers), so we must wait for it.
    const ARIMA = await ARIMAPromise;
    
    this.arima = new ARIMA(this.parameters).train(values);
    this.trained = true;

    return this;
  }

  predict(periods) {
    if (!this.trained || !this.arima) {
      throw new Error('Model must be trained before making predictions');
    }

    const [predictions, errors] = this.arima.predict(periods);
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
  }
}
