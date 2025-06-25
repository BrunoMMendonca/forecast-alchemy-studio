import { modelFactory } from '../models/index.js';

export class GridOptimizer {
  constructor() {
    this.modelFactory = modelFactory;
  }

  // Define parameter grids for each model type
  getParameterGrids() {
    return {
      'simple_exponential_smoothing': {
        alpha: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
      },
      'double_exponential_smoothing': {
        alpha: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        beta: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]
      },
      'moving_average': {
        window: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20]
      },
      'holt_winters': {
        alpha: [0.1, 0.2, 0.3, 0.4, 0.5],
        beta: [0.1, 0.2, 0.3, 0.4, 0.5],
        gamma: [0.1, 0.2, 0.3, 0.4, 0.5],
        seasonalPeriods: [4, 12], // Assuming quarterly and monthly data
        type: ['additive', 'multiplicative']
      },
      'seasonal_naive': {
        seasonalPeriods: [4, 7, 12] // Quarterly, weekly, and monthly seasonality
      },
      'seasonal_moving_average': {
        seasonalPeriods: [4, 12],
        window: [2, 3, 4]
      },
      'linear_trend': {
        // Linear trend has no parameters to optimize
      },
      'arima': [
        // Configuration for AutoARIMA. 's' is the seasonal period.
        { auto: true, s: 12, verbose: false },

        // A few manual SARIMA configurations to test
        { p: 1, d: 1, q: 1, P: 1, D: 1, Q: 1, s: 12, verbose: false },
        { p: 2, d: 1, q: 2, P: 1, D: 1, Q: 1, s: 12, verbose: false }
      ]
    };
  }

  // Generate all parameter combinations for a model type
  generateParameterCombinations(modelType) {
    const grids = this.getParameterGrids();
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

  // Evaluate a single model configuration
  evaluateModel(modelType, parameters, trainingData, validationData) {
    try {
      // Create and train model
      const model = this.modelFactory.createModel(modelType, parameters);
      model.train(trainingData);
      
      // Validate model
      const validation = model.validate(validationData);
      
      return {
        modelType,
        parameters,
        accuracy: validation.accuracy,
        mape: validation.mape,
        rmse: validation.rmse,
        mae: validation.mae,
        success: true,
        error: null
      };
    } catch (error) {
      return {
        modelType,
        parameters,
        accuracy: 0,
        mape: Infinity,
        rmse: Infinity,
        mae: Infinity,
        success: false,
        error: error.message
      };
    }
  }

  // Run grid search optimization
  async runGridSearch(data, modelTypes = null, progressCallback = null) {
    if (!data || data.length === 0) {
      throw new Error('Data cannot be empty for grid search');
    }

    // Use all available models if none specified
    if (!modelTypes) {
      modelTypes = this.modelFactory.getAvailableModels();
    }

    // Split data for validation
    const { training, validation } = this.splitData(data);
    
    if (training.length === 0 || validation.length === 0) {
      throw new Error('Insufficient data for training and validation split');
    }

    const results = [];
    let totalCombinations = 0;
    let completedCombinations = 0;

    // Calculate total combinations
    for (const modelType of modelTypes) {
      const combinations = this.generateParameterCombinations(modelType);
      totalCombinations += combinations.length;
    }

    // Run grid search for each model type
    for (const modelType of modelTypes) {
      const combinations = this.generateParameterCombinations(modelType);
      
      for (const parameters of combinations) {
        // Evaluate model
        const result = this.evaluateModel(modelType, parameters, training, validation);
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

    return {
      results,
      bestResult: results[0],
      summary: this.generateSummary(results),
      trainingDataSize: training.length,
      validationDataSize: validation.length
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