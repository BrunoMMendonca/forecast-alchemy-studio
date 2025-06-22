import { GridOptimizer } from './optimization/GridOptimizer.js';
import { modelFactory } from './models/index.js';

class OptimizationWorker {
  constructor() {
    this.gridOptimizer = new GridOptimizer();
    this.isRunning = false;
    this.currentJob = null;
  }

  // Process optimization job
  async processJob(jobData) {
    if (this.isRunning) {
      throw new Error('Worker is already processing a job');
    }

    this.isRunning = true;
    this.currentJob = jobData;

    try {
      console.log('🔄 Starting real grid optimization...');
      
      const { data, modelTypes, optimizationType } = jobData;
      
      if (!data || data.length === 0) {
        throw new Error('No data provided for optimization');
      }

      console.log(`📊 Processing ${data.length} data points`);
      console.log(`🎯 Model types: ${modelTypes ? modelTypes.join(', ') : 'All available'}`);

      let results;

      if (optimizationType === 'grid') {
        results = await this.runGridOptimization(data, modelTypes);
      } else if (optimizationType === 'ai') {
        results = await this.runAIOptimization(data, modelTypes);
      } else {
        throw new Error(`Unknown optimization type: ${optimizationType}`);
      }

      console.log('✅ Optimization completed successfully');
      
      return {
        success: true,
        results: results,
        jobId: jobData.jobId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Optimization failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        jobId: jobData.jobId,
        timestamp: new Date().toISOString()
      };
    } finally {
      this.isRunning = false;
      this.currentJob = null;
    }
  }

  // Run real grid search optimization
  async runGridOptimization(data, modelTypes = null) {
    console.log('🔍 Running grid search optimization...');
    
    const progressCallback = (progress) => {
      console.log(`📈 Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`);
      console.log(`🎯 Current: ${progress.currentModel} with params:`, progress.currentParameters);
      if (progress.latestResult.success) {
        console.log(`✅ Accuracy: ${progress.latestResult.accuracy.toFixed(2)}%`);
      } else {
        console.log(`❌ Failed: ${progress.latestResult.error}`);
      }
    };

    const results = await this.gridOptimizer.runGridSearch(
      data, 
      modelTypes, 
      progressCallback
    );

    console.log('📊 Grid search results:');
    console.log(`- Total models tested: ${results.summary.totalModels}`);
    console.log(`- Successful models: ${results.summary.successfulModels}`);
    console.log(`- Best accuracy: ${results.bestResult.accuracy.toFixed(2)}%`);
    console.log(`- Average accuracy: ${results.summary.averageAccuracy.toFixed(2)}%`);

    return {
      type: 'grid',
      results: results.results,
      bestResult: results.bestResult,
      summary: results.summary,
      topResults: this.gridOptimizer.getTopResults(results.results, 5),
      modelBreakdown: this.getModelBreakdown(results.results)
    };
  }

  // Run AI optimization (enhanced grid search with intelligent parameter selection)
  async runAIOptimization(data, modelTypes = null) {
    console.log('🤖 Running AI-enhanced optimization...');
    
    // First run a quick grid search to understand the parameter space
    const quickResults = await this.gridOptimizer.runGridSearch(
      data, 
      modelTypes
    );

    // Analyze results to find promising parameter ranges
    const promisingRanges = this.analyzePromisingRanges(quickResults.results);
    
    console.log('🧠 AI analysis of promising parameter ranges:', promisingRanges);

    // Run focused grid search in promising ranges
    const focusedResults = await this.runFocusedGridSearch(data, modelTypes, promisingRanges);

    return {
      type: 'ai',
      results: focusedResults.results,
      bestResult: focusedResults.bestResult,
      summary: focusedResults.summary,
      topResults: this.gridOptimizer.getTopResults(focusedResults.results, 5),
      modelBreakdown: this.getModelBreakdown(focusedResults.results),
      aiInsights: {
        promisingRanges,
        confidence: this.calculateAIConfidence(focusedResults.results)
      }
    };
  }

  // Analyze promising parameter ranges from initial results
  analyzePromisingRanges(results) {
    const ranges = {};
    
    // Group results by model type
    const modelGroups = {};
    for (const result of results) {
      if (!result.success) continue;
      
      if (!modelGroups[result.modelType]) {
        modelGroups[result.modelType] = [];
      }
      modelGroups[result.modelType].push(result);
    }

    // Analyze each model type
    for (const [modelType, modelResults] of Object.entries(modelGroups)) {
      if (modelResults.length === 0) continue;

      // Sort by accuracy
      modelResults.sort((a, b) => b.accuracy - a.accuracy);
      
      // Take top 20% results
      const topResults = modelResults.slice(0, Math.max(1, Math.floor(modelResults.length * 0.2)));
      
      // Analyze parameter ranges
      const paramRanges = {};
      const params = Object.keys(topResults[0].parameters);
      
      for (const param of params) {
        const values = topResults.map(r => r.parameters[param]);
        paramRanges[param] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, v) => sum + v, 0) / values.length
        };
      }
      
      ranges[modelType] = paramRanges;
    }

    return ranges;
  }

  // Run focused grid search in promising ranges
  async runFocusedGridSearch(data, modelTypes, promisingRanges) {
    // Create focused parameter grids based on promising ranges
    const focusedGrids = {};
    
    for (const [modelType, ranges] of Object.entries(promisingRanges)) {
      focusedGrids[modelType] = {};
      
      for (const [param, range] of Object.entries(ranges)) {
        // Create 5 values within the promising range
        const step = (range.max - range.min) / 4;
        focusedGrids[modelType][param] = [];
        
        for (let i = 0; i <= 4; i++) {
          focusedGrids[modelType][param].push(range.min + i * step);
        }
      }
    }

    // Temporarily override the parameter grids
    const originalGrids = this.gridOptimizer.getParameterGrids();
    this.gridOptimizer.getParameterGrids = () => focusedGrids;

    try {
      const results = await this.gridOptimizer.runGridSearch(data, modelTypes);
      return results;
    } finally {
      // Restore original grids
      this.gridOptimizer.getParameterGrids = () => originalGrids;
    }
  }

  // Calculate AI confidence based on result consistency
  calculateAIConfidence(results) {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) return 0;
    
    const accuracies = successfulResults.map(r => r.accuracy);
    const meanAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    
    // Higher confidence if results are consistent and accurate
    const consistency = 1 - (this.gridOptimizer.calculateStandardDeviation(accuracies) / meanAccuracy);
    const accuracyFactor = meanAccuracy / 100;
    
    return Math.min(95, Math.max(5, (consistency * 0.6 + accuracyFactor * 0.4) * 100));
  }

  // Get breakdown of results by model type
  getModelBreakdown(results) {
    const breakdown = {};
    
    for (const result of results) {
      if (!result.success) continue;
      
      if (!breakdown[result.modelType]) {
        breakdown[result.modelType] = {
          count: 0,
          bestAccuracy: 0,
          avgAccuracy: 0,
          accuracies: []
        };
      }
      
      breakdown[result.modelType].count++;
      breakdown[result.modelType].accuracies.push(result.accuracy);
      breakdown[result.modelType].bestAccuracy = Math.max(
        breakdown[result.modelType].bestAccuracy, 
        result.accuracy
      );
    }

    // Calculate averages
    for (const modelType in breakdown) {
      const accuracies = breakdown[modelType].accuracies;
      breakdown[modelType].avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    }

    return breakdown;
  }

  // Get worker status
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentJob: this.currentJob ? {
        jobId: this.currentJob.jobId,
        optimizationType: this.currentJob.optimizationType,
        dataSize: this.currentJob.data?.length || 0
      } : null
    };
  }
}

// Create and export worker instance
const worker = new OptimizationWorker();

// Handle messages from main thread
self.onmessage = async function(event) {
  const { type, data } = event.data;
  
  switch (type) {
    case 'process':
      try {
        const result = await worker.processJob(data);
        self.postMessage({ type: 'result', data: result });
      } catch (error) {
        self.postMessage({ 
          type: 'error', 
          data: { error: error.message, jobId: data.jobId } 
        });
      }
      break;
      
    case 'status':
      self.postMessage({ type: 'status', data: worker.getStatus() });
      break;
      
    default:
      self.postMessage({ 
        type: 'error', 
        data: { error: `Unknown message type: ${type}` } 
      });
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptimizationWorker, worker };
}
