import { GridOptimizer } from './optimization/GridOptimizer.js';
import { modelFactory } from './models/index.js';
import { db, dbReady } from './db.js';

// Promisify db.get and db.run for use with async/await
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        resolve(row);
    });
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { // Use function for `this`
        if (err) reject(err);
        resolve(this);
    });
});

class OptimizationWorker {
  constructor() {
    this.gridOptimizer = new GridOptimizer();
    this.isRunning = false;
    this.currentJobId = null;
  }

  // Process optimization job
  async processJob(job) {
    if (this.isRunning) {
      console.log('Worker is busy, skipping poll.');
      return;
    }

    this.isRunning = true;
    this.currentJobId = job.id;
    console.log(`[Worker] Picked up job ${job.id}`);

    try {
      await dbRun('UPDATE jobs SET status = ?, progress = 0, startedAt = ? WHERE id = ?', ['running', new Date().toISOString(), job.id]);
      
      const jobData = JSON.parse(job.data);
      const { data, modelTypes, optimizationType } = jobData;

      console.log(`[Worker] Starting real grid optimization for job ${job.id}...`);

      if (!data || data.length === 0) {
        throw new Error('No data provided for optimization');
      }

      let results;
      const progressCallback = async (progress) => {
        // Update progress in the database
        await dbRun('UPDATE jobs SET progress = ? WHERE id = ?', [progress.percentage, job.id]);
        console.log(`[Worker] Job ${job.id} progress: ${progress.percentage}%`);
      };
      
      if (optimizationType === 'grid') {
        results = await this.gridOptimizer.runGridSearch(data, modelTypes, progressCallback);
      } else if (optimizationType === 'ai') {
        results = await this.runAIOptimization(data, modelTypes, progressCallback);
      } else {
        throw new Error(`Unknown optimization type: ${optimizationType}`);
      }

      console.log(`[Worker] ✅ Optimization completed for job ${job.id}`);
      await dbRun('UPDATE jobs SET status = ?, progress = 100, completedAt = ?, result = ? WHERE id = ?', ['completed', new Date().toISOString(), JSON.stringify(results), job.id]);

    } catch (error) {
      console.error(`[Worker] ❌ Optimization failed for job ${job.id}:`, error.message);
      await dbRun('UPDATE jobs SET status = ?, completedAt = ?, error = ? WHERE id = ?', ['failed', new Date().toISOString(), error.message, job.id]);
    } finally {
      this.isRunning = false;
      this.currentJobId = null;
    }
  }

  // AI Optimization logic remains largely the same, but needs to accept the progress callback
  async runAIOptimization(data, modelTypes, progressCallback) {
     console.log('🤖 Running AI-enhanced optimization...');
    
    // Pass the progress callback to the grid search
    const quickResults = await this.gridOptimizer.runGridSearch(
      data, 
      modelTypes,
      // We can create a sub-progress indicator for the user here if we want
      (progress) => progressCallback({ ...progress, phase: 'analysis' }) 
    );

    const promisingRanges = this.analyzePromisingRanges(quickResults.results);
    const focusedResults = await this.runFocusedGridSearch(data, modelTypes, promisingRanges, progressCallback);

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

  // Focused grid search also needs the progress callback
  async runFocusedGridSearch(data, modelTypes, promisingRanges, progressCallback) {
    const focusedGrids = {};
    for (const [modelType, ranges] of Object.entries(promisingRanges)) {
      focusedGrids[modelType] = {};
      for (const [param, range] of Object.entries(ranges)) {
        const step = (range.max - range.min) / 4 || 0.1;
        focusedGrids[modelType][param] = [range.min, range.min + step, range.min + 2*step, range.min + 3*step, range.max];
      }
    }

    const originalGrids = this.gridOptimizer.getParameterGrids;
    this.gridOptimizer.getParameterGrids = () => focusedGrids;

    try {
      const results = await this.gridOptimizer.runGridSearch(data, modelTypes, (progress) => progressCallback({ ...progress, phase: 'refinement' }));
      return results;
    } finally {
      this.gridOptimizer.getParameterGrids = originalGrids;
    }
  }

  async pollForJobs() {
    if (this.isRunning) {
      return;
    }

    try {
      const job = await dbGet('SELECT * FROM jobs WHERE status = ? ORDER BY createdAt ASC LIMIT 1', ['pending']);
      if (job) {
        await this.processJob(job);
      }
    } catch (error) {
      console.error('[Worker] Error polling for jobs:', error);
    }
  }

  startPolling(interval = 5000) { // Poll every 5 seconds
    console.log('[Worker] Starting polling for jobs...');
    // Poll immediately, then set interval
    this.pollForJobs(); 
    setInterval(() => this.pollForJobs(), interval);
  }

  // Analyze promising parameter ranges from initial results
  analyzePromisingRanges(results) {
    const ranges = {};
    const modelGroups = {};
    for (const result of results) {
      if (!result.success) continue;
      if (!modelGroups[result.modelType]) {
        modelGroups[result.modelType] = [];
      }
      modelGroups[result.modelType].push(result);
    }
    for (const [modelType, modelResults] of Object.entries(modelGroups)) {
      if (modelResults.length === 0) continue;
      modelResults.sort((a, b) => b.accuracy - a.accuracy);
      const topResults = modelResults.slice(0, Math.max(1, Math.floor(modelResults.length * 0.2)));
      const paramRanges = {};
      const params = Object.keys(topResults[0].parameters);
      for (const param of params) {
        if (typeof topResults[0].parameters[param] !== 'number') continue;
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
  
  // Calculate AI confidence based on result consistency
  calculateAIConfidence(results) {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) return 0;
    const accuracies = successfulResults.map(r => r.accuracy);
    const meanAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
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
    for (const modelType in breakdown) {
      const accuracies = breakdown[modelType].accuracies;
      breakdown[modelType].avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    }
    return breakdown;
  }
}

// --- Main Execution ---
async function main() {
    await dbReady; // Wait for the database to be initialized
    const worker = new OptimizationWorker();
    worker.startPolling();
}

main().catch(console.error);
