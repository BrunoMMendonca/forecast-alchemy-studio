import { modelFactory } from '../models/index.js';

export class GridOptimizer {
  constructor() {
    this.modelFactory = modelFactory;
  }

  // Get parameter grids dynamically from model metadata
  getParameterGrids() {
    const grids = {};
    const availableModels = this.modelFactory.getAvailableModels();
    
    for (const modelId of availableModels) {
      const modelClass = this.modelFactory.getModelClass(modelId);
      if (modelClass && modelClass.metadata && modelClass.metadata.optimizationParameters) {
        // Special handling for SARIMA to use dynamic seasonal periods
        if (modelId === 'sarima') {
          // SARIMA parameters will be generated dynamically in runGridSearch
          grids[modelId] = []; // Placeholder - will be replaced
        } else {
          grids[modelId] = modelClass.metadata.optimizationParameters;
        }
      }
    }
    
    return grids;
  }

  // Generate SARIMA parameters with the correct seasonal period
  async generateSARIMAParameters() {
    // Get seasonal period from global settings (this should match the dataset frequency)
    try {
      const { pgPool } = await import('../db.js');
      const result = await pgPool.query("SELECT value FROM settings WHERE key = 'global_seasonalPeriods'", []);
      
      if (result.rows.length > 0) {
            try {
          const seasonalPeriods = JSON.parse(result.rows[0].value);
          return this.createSARIMAParameters(seasonalPeriods);
            } catch (e) {
              console.error('Error parsing seasonal periods setting:', e);
              // Fallback: try to get from frequency setting
          const freqResult = await pgPool.query("SELECT value FROM settings WHERE key = 'global_frequency'", []);
          if (freqResult.rows.length > 0) {
                  try {
              const frequency = JSON.parse(freqResult.rows[0].value);
                    const seasonalPeriods = this.getSeasonalPeriodsFromFrequency(frequency);
              return this.createSARIMAParameters(seasonalPeriods);
                  } catch (e) {
                    console.error('Error parsing frequency setting:', e);
                    // Default to monthly (12)
              return this.createSARIMAParameters(12);
                  }
                } else {
                  // Default to monthly (12)
            return this.createSARIMAParameters(12);
                }
            }
          } else {
            // Fallback: try to get from frequency setting
        const freqResult = await pgPool.query("SELECT value FROM settings WHERE key = 'global_frequency'", []);
        if (freqResult.rows.length > 0) {
                try {
            const frequency = JSON.parse(freqResult.rows[0].value);
                  const seasonalPeriods = this.getSeasonalPeriodsFromFrequency(frequency);
            return this.createSARIMAParameters(seasonalPeriods);
                } catch (e) {
                  console.error('Error parsing frequency setting:', e);
                  // Default to monthly (12)
            return this.createSARIMAParameters(12);
                }
              } else {
                // Default to monthly (12)
          return this.createSARIMAParameters(12);
              }
          }
      } catch (error) {
        console.error('Error getting seasonal periods for SARIMA:', error);
        // Default to monthly (12)
      return this.createSARIMAParameters(12);
      }
  }

  // Helper function to get seasonal periods from frequency
  getSeasonalPeriodsFromFrequency(frequency) {
    switch (frequency) {
      case 'daily': return 7; // weekly seasonality
      case 'weekly': return 52; // yearly seasonality
      case 'monthly': return 12; // yearly seasonality
      case 'quarterly': return 4; // yearly seasonality
      case 'yearly': return 1; // no seasonality
      default: return 12; // default to monthly
    }
  }

  // Create SARIMA parameters with the correct seasonal period
  createSARIMAParameters(seasonalPeriod) {
    
    // If seasonal period is 1 (yearly), SARIMA doesn't make sense - return empty array
    if (seasonalPeriod === 1) {
      return [];
    }

    return [
      // Simple SARIMA configurations with the correct seasonal period
      { p: 1, d: 1, q: 1, P: 1, D: 0, Q: 0, s: seasonalPeriod, verbose: false },
      { p: 1, d: 1, q: 1, P: 0, D: 0, Q: 1, s: seasonalPeriod, verbose: false },
      { p: 1, d: 1, q: 1, P: 0, D: 1, Q: 0, s: seasonalPeriod, verbose: false },
      { p: 1, d: 1, q: 1, P: 1, D: 0, Q: 1, s: seasonalPeriod, verbose: false },
      { p: 2, d: 1, q: 2, P: 1, D: 0, Q: 1, s: seasonalPeriod, verbose: false },
      { p: 1, d: 0, q: 1, P: 1, D: 0, Q: 0, s: seasonalPeriod, verbose: false },
      { p: 2, d: 0, q: 2, P: 1, D: 0, Q: 1, s: seasonalPeriod, verbose: false },
      { p: 0, d: 1, q: 1, P: 0, D: 0, Q: 1, s: seasonalPeriod, verbose: false },
      { p: 1, d: 1, q: 0, P: 1, D: 0, Q: 0, s: seasonalPeriod, verbose: false },
      
      // AutoSARIMA with the correct seasonal period
      { auto: true, s: seasonalPeriod, verbose: false }
    ];
  }

  // Generate all parameter combinations for a model type
  generateParameterCombinations(modelType, seasonalPeriod = null) {
    // For ARIMA and SARIMA, only use auto configuration for grid search
    if (modelType === 'arima') {
      return [{ auto: true, verbose: false }];
    }
    if (modelType === 'sarima') {
      // Use correct seasonal period
      return [{ auto: true, s: seasonalPeriod || 12, verbose: false }];
    }

    // Get model class to check if it should be included in grid search
    const modelClass = this.modelFactory.getModelClass(modelType);
    if (!modelClass) {
      throw new Error(`Unknown model type: ${modelType}`);
    }

    // Check if model should be included in grid search
    if (!modelClass.shouldIncludeInGridSearch()) {
      return []; // Model opts out of grid search
    }

    // Get grid search parameters from the model itself
    const modelGridParams = modelClass.getGridSearchParameters(seasonalPeriod);
    if (modelGridParams !== null) {
      return modelGridParams; // Model provides its own grid search parameters
    }

    // Fall back to the standard grid search logic
    const grids = this._customGrids || this.getParameterGrids();
    const grid = grids[modelType];
    if (!grid) {
      throw new Error(`No parameter grid defined for model type: ${modelType}`);
    }
    
    // If the grid is an array of explicit configurations, return it directly.
    if (Array.isArray(grid)) {
      return grid;
    }
    const combinations = [];
    const keys = Object.keys(grid);
    // Generate cartesian product of all parameter values
    const generateCombinations = (current, index) => {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }
      const key = keys[index];
      const values = grid[key];
      for (const value of values) {
        current[key] = value;
        generateCombinations(current, index + 1);
      }
    };
    generateCombinations({}, 0);
    return combinations;
  }

  // Split data into training and validation sets
  splitData(data, validationRatio = 0.2) {
    const splitIndex = Math.floor(data.length * (1 - validationRatio));
    return {
      training: data.slice(0, splitIndex),
      validation: data.slice(splitIndex)
    };
  }

  // Validate and preprocess data before optimization
  validateAndPreprocessData(data) {
 
    
    // Extract sales values and log their types
    const salesValues = data.map((d, index) => {
      let sales;
      if (typeof d === 'object') {
        // Robust, case-insensitive sales extraction - fixed to handle zero values
        sales = d.Sales ?? d.sales ?? d.value ?? d.amount ?? undefined;
        if (sales === undefined) {
          console.error(`[GridOptimizer] 🚨 No sales property found at index ${index}. Available properties:`, Object.keys(d));
          console.error(`[GridOptimizer] 🚨 Row data:`, d);
          sales = 0;
        }
      } else {
        sales = d;
      }
      
      // Log any problematic values
      if (isNaN(sales) || !isFinite(sales)) {
        console.error(`[GridOptimizer] 🚨 Invalid value at index ${index}:`, {
          originalData: d,
          extractedSales: sales,
          type: typeof sales,
          isNaN: isNaN(sales),
          isFinite: isFinite(sales)
        });
      }
      
      return sales;
    });
    


    // Check for basic data quality issues
    const issues = [];
    
    // Check for NaN or Infinity
    const hasNaN = salesValues.some(v => isNaN(v));
    const hasInfinity = salesValues.some(v => !isFinite(v));
    
    if (hasNaN) {
      console.error(`[GridOptimizer] 🚨 Found NaN values in sales data`);
      // Log the specific indices where NaN values occur
      const nanIndices = salesValues.map((v, i) => isNaN(v) ? i : -1).filter(i => i !== -1);
      console.error(`[GridOptimizer] 🚨 NaN values found at indices:`, nanIndices.slice(0, 10)); // Limit to first 10
      issues.push('Data contains NaN values');
    }
    if (hasInfinity) {
      console.error(`[GridOptimizer] 🚨 Found Infinity values in sales data`);
      // Log the specific indices where Infinity values occur
      const infinityIndices = salesValues.map((v, i) => !isFinite(v) ? i : -1).filter(i => i !== -1);
      console.error(`[GridOptimizer] 🚨 Infinity values found at indices:`, infinityIndices.slice(0, 10)); // Limit to first 10
      issues.push('Data contains Infinity values');
    }

    // Check for all zeros
    const allZero = salesValues.every(v => v === 0);
    if (allZero) {
      issues.push('All sales values are zero - no forecasting possible');
    }

    // Check for all same values
    const allSame = salesValues.every(v => v === salesValues[0]);
    if (allSame && !allZero) {
      issues.push('All sales values are identical - insufficient variation for forecasting');
    }

    // Check for insufficient data
    if (salesValues.length < 5) {
      issues.push(`Insufficient data points (${salesValues.length}) - need at least 5 for meaningful forecasting`);
    }

    // Check for insufficient variation
    const uniqueValues = new Set(salesValues);
    if (uniqueValues.size < 3) {
      issues.push(`Insufficient variation (${uniqueValues.size} unique values) - need at least 3 for meaningful forecasting`);
    }

    // Log data statistics
    const minVal = Math.min(...salesValues);
    const maxVal = Math.max(...salesValues);
    const range = maxVal - minVal;
    const nonZeroCount = salesValues.filter(v => v !== 0).length;
    

    // If there are critical issues, throw an error
    if (issues.length > 0) {
      const errorMessage = `Data validation failed:\n${issues.join('\n')}`;
      console.error(`[GridOptimizer] ❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Preprocess data if needed
    let processedData = [...data];
    
    // Replace any remaining NaN/Infinity with 0 (shouldn't happen after validation, but just in case)
    processedData = processedData.map(d => {
      if (typeof d === 'object') {
        const sales = d.Sales ?? d.sales ?? d.value ?? d.amount ?? 0;
        if (isNaN(sales) || !isFinite(sales)) {
          return { ...d, sales: 0, Sales: 0, value: 0, amount: 0 };
        }
      } else if (isNaN(d) || !isFinite(d)) {
        return 0;
      }
      return d;
    });

    return processedData;
  }

  // Validate which models can work with the given data
  validateModelCompatibility(data, modelTypes, seasonalPeriod = null) {
    const dataLength = data.length;
    const validationRatio = 0.2; // Match frontend and backend default
    const trainingDataLength = Math.floor(dataLength * (1 - validationRatio));
    
    const validModels = [];
    const invalidModels = [];


    // Get model requirements from ModelFactory for consistency
    const requirements = this.modelFactory.getModelDataRequirements(seasonalPeriod || 12);

    for (const modelType of modelTypes) {
      let isValid = true;
      let reason = '';

      const req = requirements[modelType];
      if (!req) {
        // For unknown models, assume they need at least 5 training observations
        if (trainingDataLength < 5) {
          isValid = false;
          reason = `${modelType} requires at least 5 training observations (you have ${trainingDataLength} training points from ${dataLength} total points)`;
        }
      } else {
        const minTrain = Number(req.minObservations);
        if (trainingDataLength < minTrain) {
          isValid = false;
          reason = `${modelType} requires at least ${minTrain} training observations (you have ${trainingDataLength} training points from ${dataLength} total points)`;
        }
      }

      if (isValid) {
        validModels.push(modelType);
      } else {
        invalidModels.push({ modelType, reason });
      }
    }

    if (validModels.length === 0) {
      throw new Error(`No models are compatible with the available data (${trainingDataLength} training points from ${dataLength} total points). Consider using models with lower data requirements or collecting more data.`);
    }

    if (invalidModels.length > 0) {
    }

    return {
      validModels,
      invalidModels,
      totalModels: modelTypes.length,
      compatibleModels: validModels.length
    };
  }

  // Evaluate a single model configuration
  async evaluateModel(modelType, parameters, trainingData, validationData, seasonalPeriod = null) {
    const startTime = Date.now();
    
    // Log the evaluation attempt

    
    // Log data samples for debugging
    if (trainingData.length > 0) {
      const sampleValues = trainingData.slice(0, 5).map(d => {
        if (typeof d === 'object') {
          return d.Sales ?? d.sales ?? d.value ?? d.amount ?? 0;
        }
        return d;
      });

    }
    
    // Check for data quality issues
    const allValues = trainingData.map(d => {
      if (typeof d === 'object') {
        return d.Sales ?? d.sales ?? d.value ?? d.amount ?? 0;
      }
      return d;
    });
    
    const hasNaN = allValues.some(v => isNaN(v));
    const hasInfinity = allValues.some(v => !isFinite(v));
    const allZeros = allValues.every(v => v === 0);
    const hasVariation = new Set(allValues).size > 1;
    
    if (hasNaN || hasInfinity) {
      console.warn(`[GridOptimizer] ⚠️ Data quality issues detected:`, {
        hasNaN, hasInfinity, allZeros, hasVariation
      });
    }
    
    // Calculate basic statistics for debugging
    const validValues = allValues.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (validValues.length > 0) {
      const minVal = Math.min(...validValues);
      const maxVal = Math.max(...validValues);

    }
    
    try {
      // Create and train model using the new async createModel method

      
      // Pass seasonalPeriod for seasonal models
      const model = await this.modelFactory.createModel(modelType, parameters, seasonalPeriod);

      console.log(`[GridOptimizer] Created model instance:`, {
        modelType,
        instanceType: model.constructor.name,
        hasTrainMethod: typeof model.train === 'function',
        trainMethodSource: model.train.toString().substring(0, 50)
      });

      await model.train(trainingData);
      
      // If ARIMA or SARIMA in auto mode, extract fitted parameters
      let resultParameters = { ...parameters };
      if ((modelType === 'arima' || modelType === 'sarima') && parameters.auto === true && typeof model.getFittedOrder === 'function') {
        const fitted = model.getFittedOrder();
        if (fitted && Object.keys(fitted).length > 0) {
          resultParameters = { ...parameters, ...fitted };
        }
      }
      

      const validation = model.validate(validationData);
      
      const duration = Date.now() - startTime;

      
      return {
        modelType,
        parameters: resultParameters,
        accuracy: validation.accuracy,
        mape: validation.mape,
        rmse: validation.rmse,
        mae: validation.mae,
        success: true,
        error: null,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[GridOptimizer] ❌ ${modelType} evaluation failed in ${duration}ms`);
      console.error(`[GridOptimizer] Error details:`, {
        modelType,
        parameters: JSON.stringify(parameters),
        errorMessage: error.message,
        errorStack: error.stack,
        trainingDataLength: trainingData.length,
        validationDataLength: validationData.length
      });
      
      // Log additional context for specific error types
      if (error.message.includes('NaN') || error.message.includes('Infinity') || 
          error.message.includes('maximum double value') || error.message.includes('unique solution')) {
        console.error(`[GridOptimizer] 🔍 NUMERICAL ERROR DETECTED - Additional context:`);
        console.error(`[GridOptimizer] Model: ${modelType}`);
        console.error(`[GridOptimizer] Parameters: ${JSON.stringify(parameters)}`);
        console.error(`[GridOptimizer] Training data summary:`, {
          length: trainingData.length,
          sample: trainingData.slice(0, 3).map(d => {
            if (typeof d === 'object') {
              return d.sales || d.Sales || d.value || d.amount || d;
            }
            return d;
          })
        });
      }
      
      return {
        modelType,
        parameters,
        accuracy: 0,
        mape: Infinity,
        rmse: Infinity,
        mae: Infinity,
        success: false,
        error: error.message,
        duration
      };
    }
  }

  // Run grid search optimization
  async runGridSearch(data, modelTypes = null, progressCallback = null, frequency = null, seasonalPeriod = null) {
    // Validate and preprocess data first
    const processedData = this.validateAndPreprocessData(data);

    // Use all available models if none specified
    if (!modelTypes) {
      modelTypes = this.modelFactory.getAvailableModels();
    }

    // Validate model compatibility with the data
    const compatibility = this.validateModelCompatibility(processedData, modelTypes, seasonalPeriod);
    const validModelTypes = compatibility.validModels;

    if (validModelTypes.length === 0) {
      throw new Error('No models are compatible with the available data');
    }

    // Generate SARIMA parameters dynamically if SARIMA is included
    let sarimaParams = null;
    if (validModelTypes.includes('sarima')) {
      let period = seasonalPeriod;
      if (!period && frequency) {
        period = this.getSeasonalPeriodsFromFrequency(frequency);
      }
      if (!period) period = 12; // fallback
      sarimaParams = this.createSARIMAParameters(period);
      const grids = this.getParameterGrids();
      grids.sarima = sarimaParams;
      this._customGrids = grids; // Store for generateParameterCombinations
    } else {
      this._customGrids = null;
    }

    // Split data for validation
    const { training, validation } = this.splitData(processedData);
    
    if (training.length === 0 || validation.length === 0) {
      throw new Error('Insufficient data for training and validation split');
    }



    const results = [];
    let totalCombinations = 0;
    let completedCombinations = 0;

    // Calculate total combinations
    for (const modelType of validModelTypes) {
      const combinations = this.generateParameterCombinations(modelType, seasonalPeriod);
      totalCombinations += combinations.length;

    }



    // Run grid search for each model type
    for (const modelType of validModelTypes) {

      const combinations = this.generateParameterCombinations(modelType, seasonalPeriod);
      
      for (const parameters of combinations) {
        // Evaluate model
        const result = await this.evaluateModel(modelType, parameters, training, validation, seasonalPeriod);
        results.push(result);
        
        completedCombinations++;
        
        // Report progress
        if (progressCallback) {
          const progress = {
            completed: completedCombinations,
            total: totalCombinations,
            percentage: Math.round((completedCombinations / totalCombinations) * 100),
            currentModel: modelType,
            currentParameters: parameters,
            latestResult: result
          };
          
          await progressCallback(progress);
        }
      }
    }

    // Sort results by accuracy (descending)
    results.sort((a, b) => b.accuracy - a.accuracy);

    const successfulResults = results.filter(r => r.success);
    console.log(`[GridOptimizer] ✅ Grid search completed: ${successfulResults.length}/${results.length} successful (${((successfulResults.length/results.length)*100).toFixed(1)}%)`);

    return {
      results,
      bestResult: results[0],
      summary: this.generateSummary(results),
      trainingDataSize: training.length,
      validationDataSize: validation.length,
      modelCompatibility: compatibility
    };
  }

  // Generate summary statistics
  generateSummary(results) {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return {
        totalModels: results.length,
        successfulModels: 0,
        averageAccuracy: 0,
        bestAccuracy: 0,
        worstAccuracy: 0
      };
    }

    const accuracies = successfulResults.map(r => r.accuracy);
    
    return {
      totalModels: results.length,
      successfulModels: successfulResults.length,
      averageAccuracy: accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length,
      bestAccuracy: Math.max(...accuracies),
      worstAccuracy: Math.min(...accuracies),
      accuracyStdDev: this.calculateStandardDeviation(accuracies)
    };
  }

  // Calculate standard deviation
  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  // Get best model for a specific model type
  getBestModelForType(results, modelType) {
    const modelResults = results.filter(r => r.modelType === modelType && r.success);
    return modelResults.length > 0 ? modelResults[0] : null;
  }

  // Get top N results
  getTopResults(results, n = 5) {
    return results.filter(r => r.success).slice(0, n);
  }
} 