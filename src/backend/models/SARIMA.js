import { BaseModel } from './BaseModel.js';
import ARIMAPromise from 'arima/async.js';

// SARIMA model wrapper - distinct from ARIMA for marketing purposes
export class SARIMAModel extends BaseModel {
  static metadata = {
    id: 'sarima',
    displayName: 'SARIMA (Seasonal Autoregressive Integrated Moving Average)',
    shortName: 'SARIMA',
    parameters: [
      { name: 'p', type: 'number', default: 1, visible: true, label: 'AR Order (p)', description: 'Number of autoregressive terms.' },
      { name: 'd', type: 'number', default: 1, visible: true, label: 'Difference Order (d)', description: 'Number of nonseasonal differences needed for stationarity.' },
      { name: 'q', type: 'number', default: 1, visible: true, label: 'MA Order (q)', description: 'Number of moving average terms.' },
      { name: 'P', type: 'number', default: 1, visible: true, label: 'Seasonal AR Order (P)', description: 'Number of seasonal autoregressive terms.' },
      { name: 'D', type: 'number', default: 0, visible: true, label: 'Seasonal Difference Order (D)', description: 'Number of seasonal differences.' },
      { name: 'Q', type: 'number', default: 0, visible: true, label: 'Seasonal MA Order (Q)', description: 'Number of seasonal moving average terms.' },
      { name: 'verbose', type: 'boolean', default: false, visible: false, label: 'Verbose Output', description: 'Show detailed fitting progress (for debugging only).' },
    ],
    get defaultParameters() {
      return Object.fromEntries(this.parameters.map(p => [p.name, p.default]));
    },
    // Dynamic optimization parameters - will be generated based on seasonal period
    get optimizationParameters() {
      // This will be overridden by the GridOptimizer to use the correct seasonal period
      return [];
    },
    isSeasonal: true,
    className: 'SARIMAModel',
    enabled: true,
    description: 'Seasonal ARIMA model that captures both trend and seasonal patterns in time series data. Ideal for data with recurring seasonal cycles like monthly sales, quarterly reports, or weekly patterns.',
    category: 'Advanced Seasonal Models'
  };

  constructor(parameters = SARIMAModel.metadata.defaultParameters, seasonalPeriod = 12) {
    // Add verbose: false internally for backend processing
    const internalParameters = { ...parameters, verbose: false, s: seasonalPeriod };
    super(internalParameters);
    this.name = 'SARIMA (Seasonal ARIMA)';
    this.arima = null; // Will hold the ARIMA instance
    this.trained = false;
  }

  async train(data) {
    if (!data || data.length < 20) { // SARIMA needs more data due to seasonal components
      throw new Error('Training data must have at least 20 observations for SARIMA (to capture seasonal patterns)');
    }

    // Set up column mapping if data has metadata
    if (data && data.length > 0 && data[0]._columnMapping) {
      this.columnMapping = data[0]._columnMapping;
    }

    const values = data.map((d, index) => {
      let extractedValue;
      if (typeof d === 'object') {
        // Use column mapping if available, otherwise fallback to legacy logic
        extractedValue = this.getColumnValue(d, 'Sales', 'Sales') ?? 
                        d.sales ?? d.value ?? d.amount ?? undefined;
        // Log any problematic extractions
        if (extractedValue === undefined) {
          console.error(`[SARIMA] 🚨 DEBUG: No sales property found at index ${index}. Available properties:`, Object.keys(d));
          console.error(`[SARIMA] 🚨 DEBUG: Row data:`, d);
          extractedValue = 0; // Default to 0 if no sales property found
        }
      } else {
        extractedValue = d;
      }
      
      // Log any invalid values found during extraction
      if (isNaN(extractedValue) || !isFinite(extractedValue)) {
        console.error(`[SARIMA] 🚨 DEBUG: Invalid value at index ${index}:`, {
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
      console.error(`[SARIMA] 🚨 DEBUG: Found ${invalidIndices.length} invalid values:`, invalidIndices.slice(0, 10)); // Limit to first 10
    }
    
    // Check for valid numeric data
    if (!values.every(v => typeof v === 'number' && !isNaN(v))) {
      console.error(`[SARIMA] 🚨 DEBUG: Data validation failed. Invalid values found.`);
      throw new Error('SARIMA requires all data values to be valid numbers');
    }
    
    // Validate seasonal period
    const seasonalPeriod = this.parameters.s || 12;
    const minRequiredData = seasonalPeriod * 2;
    
    if (values.length < minRequiredData) {
      throw new Error(`SARIMA requires at least ${minRequiredData} observations for seasonal period ${seasonalPeriod} (you have ${values.length})`);
    }
    
    // Check if we have enough complete seasons
    const completeSeasons = Math.floor(values.length / seasonalPeriod);
    if (completeSeasons < 2) {
      throw new Error(`SARIMA requires at least 2 complete seasons for seasonal period ${seasonalPeriod} (you have ${completeSeasons} complete seasons from ${values.length} observations)`);
    }

    
    try {
      // The library loads asynchronously (to support browsers), so we must wait for it.
      const ARIMA = await ARIMAPromise;
      
      // Create ARIMA instance with SARIMA parameters
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
      console.error('SARIMA training error:', error);
      throw new Error(`SARIMA training failed: ${error.message}`);
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
      console.error('SARIMA prediction error:', error);
      throw new Error(`SARIMA prediction failed: ${error.message}`);
    }
  }

  validate(testData) {
    if (!this.trained) {
      throw new Error('Model must be trained before validation');
    }

    try {
      const values = testData.map(d => {
        if (typeof d === 'object') {
          // Use column mapping if available, otherwise fallback to legacy logic
          return this.getColumnValue(d, 'Sales', 'Sales') ?? 
                 (d.sales || d.Sales || d.value || d.amount || d);
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
      console.error('SARIMA validation error:', error);
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

  // SARIMA-specific method to get seasonal information
  getSeasonalInfo() {
    const seasonalPeriod = this.parameters.s || 12;
    const seasonalType = this.getSeasonalType();
    
    return {
      seasonalPeriod,
      seasonalType,
      description: `SARIMA with ${seasonalType} seasonality (period: ${seasonalPeriod})`
    };
  }

  getSeasonalType() {
    const s = this.parameters.s || 12;
    switch (s) {
      case 4: return 'Quarterly';
      case 7: return 'Weekly';
      case 12: return 'Monthly';
      case 24: return 'Hourly (Daily)';
      case 52: return 'Weekly (Yearly)';
      default: return `Custom (${s})`;
    }
  }

  // Add a getter for fitted order
  getFittedOrder() {
    return this.fittedOrder || {};
  }
} 
