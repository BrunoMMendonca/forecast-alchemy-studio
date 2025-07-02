import { BaseModel } from './BaseModel.js';
import ARIMAPromise from 'arima/async.js';

// ARIMA model wrapper
export class ARIMAModel extends BaseModel {
  static metadata = {
    id: 'arima',
    displayName: 'ARIMA (Autoregressive Integrated Moving Average)',
    parameters: [
      { name: 'p', type: 'number', default: 1, visible: true, label: 'AR Order (p)', description: 'Number of autoregressive terms.' },
      { name: 'd', type: 'number', default: 1, visible: true, label: 'Difference Order (d)', description: 'Number of nonseasonal differences needed for stationarity.' },
      { name: 'q', type: 'number', default: 1, visible: true, label: 'MA Order (q)', description: 'Number of moving average terms.' },
      { name: 'auto', type: 'boolean', default: true, visible: false, label: 'Auto ARIMA', description: 'Automatically select best ARIMA order.', trueLabel: 'Enabled', falseLabel: 'Disabled' },
      { name: 'verbose', type: 'boolean', default: false, visible: false, label: 'Verbose Output', description: 'Show detailed fitting progress (for debugging only).' },
    ],
    get defaultParameters() {
      // Generate defaultParameters from parameters array
      return Object.fromEntries(this.parameters.map(p => [p.name, p.default]));
    },
    optimizationParameters: [
      // AutoARIMA configurations (most reliable)
      { auto: true, verbose: false },  // AutoARIMA with automatic parameter selection
      
      // Simple ARIMA configurations (non-seasonal)
      { p: 1, d: 1, q: 1, P: 0, D: 0, Q: 0, s: 0, verbose: false },  // ARIMA(1,1,1)
      { p: 2, d: 1, q: 2, P: 0, D: 0, Q: 0, s: 0, verbose: false },  // ARIMA(2,1,2)
      { p: 1, d: 0, q: 1, P: 0, D: 0, Q: 0, s: 0, verbose: false },  // ARIMA(1,0,1)
      { p: 2, d: 0, q: 2, P: 0, D: 0, Q: 0, s: 0, verbose: false },  // ARIMA(2,0,2)
      { p: 0, d: 1, q: 1, P: 0, D: 0, Q: 0, s: 0, verbose: false },  // ARIMA(0,1,1) - Random Walk with Drift
      { p: 1, d: 1, q: 0, P: 0, D: 0, Q: 0, s: 0, verbose: false }   // ARIMA(1,1,0) - Random Walk with Trend
    ],
    isSeasonal: false,
    className: 'ARIMAModel',
    enabled: true,
    description: 'Autoregressive Integrated Moving Average model for time series forecasting. Captures trend and autocorrelation patterns without seasonal components. Use SARIMA for seasonal data.',
    category: 'Advanced Trend Models'
  };

  constructor(parameters = ARIMAModel.metadata.defaultParameters) {
    // Add verbose: false internally for backend processing
    const internalParameters = { ...parameters, verbose: false };
    super(internalParameters);
    this.name = 'ARIMA';
    this.arima = null; // Will hold the ARIMA instance
    this.trained = false;
  }

  async train(data) {
    if (!data || data.length < 10) { // ARIMA needs a reasonable amount of data
      throw new Error('Training data must have at least 10 observations for ARIMA');
    }

    const values = data.map((d, index) => {
      let extractedValue;
      if (typeof d === 'object') {
        // Fix: Use nullish coalescing to handle zero values properly
        extractedValue = d.Sales ?? d.sales ?? d.value ?? d.amount ?? undefined;
        // Log any problematic extractions
        if (extractedValue === undefined) {
          console.error(`[ARIMA] 🚨 DEBUG: No sales property found at index ${index}. Available properties:`, Object.keys(d));
          console.error(`[ARIMA] 🚨 DEBUG: Row data:`, d);
          extractedValue = 0; // Default to 0 if no sales property found
        }
      } else {
        extractedValue = d;
      }
      
      // Log any invalid values found during extraction
      if (isNaN(extractedValue) || !isFinite(extractedValue)) {
        console.error(`[ARIMA] 🚨 DEBUG: Invalid value at index ${index}:`, {
          originalData: d,
          extractedValue: extractedValue,
          type: typeof extractedValue,
          isNaN: isNaN(extractedValue),
          isFinite: isFinite(extractedValue)
        });
      }
      
      return extractedValue;
    });
    
    // Find and log all invalid values
    const invalidIndices = values.map((v, i) => {
      if (typeof v !== 'number' || isNaN(v) || !isFinite(v)) {
        return { index: i, value: v, originalData: data[i] };
      }
      return null;
    }).filter(item => item !== null);
    
    if (invalidIndices.length > 0) {
      console.error(`[ARIMA] 🚨 DEBUG: Found ${invalidIndices.length} invalid values:`, invalidIndices.slice(0, 10)); // Limit to first 10
    }
    
    // Check for valid numeric data
    if (!values.every(v => typeof v === 'number' && !isNaN(v))) {
      console.error(`[ARIMA] 🚨 DEBUG: Data validation failed. Invalid values found.`);
      throw new Error('ARIMA requires all data values to be valid numbers');
    }
    
    try {
    // The library loads asynchronously (to support browsers), so we must wait for it.
    const ARIMA = await ARIMAPromise;
    
      // Create ARIMA instance with timeout protection
      const arimaInstance = new ARIMA(this.parameters);
      
      // Train with timeout protection
      this.arima = arimaInstance.train(values);
      this.trained = true;


      // Extract fitted order if auto:true
      if (this.parameters.auto === true && this.arima) {
        let fitted = {};
        if (typeof this.arima.getOrder === 'function') {
          fitted = this.arima.getOrder();
        } else if (this.arima.options) {
          ['p','d','q','P','D','Q','s'].forEach(key => {
            if (typeof this.arima.options[key] === 'number') {
              fitted[key] = this.arima.options[key];
            }
          });
        }
        this.fittedOrder = fitted;
      }

      return this;
    } catch (error) {
      console.error('ARIMA training error:', error);
      throw new Error(`ARIMA training failed: ${error.message}`);
    }
  }

  predict(periods) {
    if (!this.trained || !this.arima) {
      throw new Error('Model must be trained before making predictions');
    }

    try {
    const [predictions, errors] = this.arima.predict(periods);
    return predictions;
    } catch (error) {
      console.error('ARIMA prediction error:', error);
      throw new Error(`ARIMA prediction failed: ${error.message}`);
    }
  }

  validate(testData) {
    if (!this.trained) {
      throw new Error('Model must be trained before validation');
    }

    try {
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
    } catch (error) {
      console.error('ARIMA validation error:', error);
      // Return a failed validation result instead of throwing
      return {
        mape: Infinity,
        rmse: Infinity,
        mae: Infinity,
        accuracy: 0,
        predictions: [],
        actual: values || [],
        error: error.message
      };
    }
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

  // Add a getter for fitted order
  getFittedOrder() {
    return this.fittedOrder || {};
  }
}
