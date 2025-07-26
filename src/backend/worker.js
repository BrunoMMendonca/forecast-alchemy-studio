import { GridOptimizer } from './optimization/GridOptimizer.js';
import { modelFactory } from './models/index.js';
import { pgPool, getTimeSeriesData, getDatasetMetadata } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// PostgreSQL query helpers for use with async/await
const dbGet = async (sql, params = []) => {
    const result = await pgPool.query(sql, params);
    return result.rows[0];
};

const dbRun = async (sql, params = []) => {
    const result = await pgPool.query(sql, params);
    return result;
};

// --- DEBUG LOGGING FOR $2 PARAMETER QUERIES ---
function debugQuery(query, params) {
  console.log('[DEBUG SQL]', query.replace(/\s+/g, ' ').trim());
  console.log('[DEBUG PARAMS]', params);
}

// Helper function to apply cleaning metadata to data
function applyCleaningMetadata(originalData, cleaningMetadata) {
  if (!cleaningMetadata || !cleaningMetadata.activeCorrections) {
    return originalData;
  }

  return originalData.map(item => {
    const sku = item['Material Code'];
    const date = item['Date'];
    
    const skuCorrections = cleaningMetadata.activeCorrections[sku];
    if (!skuCorrections) {
      return item;
    }

    const dateCorrection = skuCorrections[date];
    if (!dateCorrection) {
      return item;
    }

    // Apply the correction
    return {
      ...item,
      Sales: dateCorrection.correctedValue,
      note: dateCorrection.note
    };
  });
}

class OptimizationWorker {
  constructor() {
    this.gridOptimizer = new GridOptimizer();
    this.isRunning = false;
    this.currentJobId = null;
  }

  // Process optimization job
  async processJob(job) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.currentJobId = job.id;

    try {
      debugQuery('UPDATE optimization_jobs SET status = $1, started_at = $2, updated_at = $3 WHERE id = $4', ['running', new Date().toISOString(), new Date().toISOString(), job.id]);
      await dbRun('UPDATE optimization_jobs SET status = $1, started_at = $2, updated_at = $3 WHERE id = $4', ['running', new Date().toISOString(), new Date().toISOString(), job.id]);

      // Parse job data from the payload column
      let jobData;
      try {
        if (job.payload) {
          // Handle case where payload is already an object
          if (typeof job.payload === 'object') {
            jobData = job.payload;
          } else if (typeof job.payload === 'string') {
            // Handle case where payload is a string that might not be valid JSON
            if (job.payload === '[object Object]' || job.payload === 'undefined') {
              console.warn(`[Worker] Job ${job.id} has invalid payload format: ${job.payload}`);
              jobData = {};
            } else {
              jobData = JSON.parse(job.payload);
            }
          } else {
            jobData = {};
          }
        } else {
          jobData = {};
        }
      } catch (parseError) {
        console.error(`[Worker] Failed to parse job payload for job ${job.id}:`, parseError);
        console.error(`[Worker] Job payload value:`, job.payload);
        jobData = {};
      }
      
      let { data, modelTypes, optimizationType, sku } = jobData;
      
      // Get datasetId from job object or job data
      let datasetId = job.dataset_id;
      if (!datasetId && jobData.datasetId) {
        datasetId = jobData.datasetId;
        console.log(`[Worker] Got datasetId from jobData: ${datasetId}`);
      }
      
      console.log(`[Worker] Job ${job.id} - dataset_id: ${datasetId}`);
      
      console.log({
        hasData: !!data,
        dataLength: data ? data.length : 0,
        modelTypes,
        optimizationType,
        sku,
        datasetId
      });

      // NEW: If data is missing but datasetId is present, load from database
      let frequency = null;
      let seasonalPeriod = null;
      let columnMapping = null;
      
      if ((!data || data.length === 0) && datasetId) {
        try {
          // Load from database using dataset ID
            console.log(`[Worker] Loading data from database for dataset ${datasetId}, SKU: ${sku}`);
            
            // Get dataset metadata
            const metadata = await getDatasetMetadata(datasetId);
            if (!metadata) {
              throw new Error(`Dataset ${datasetId} not found in database`);
            }
            console.log(`[Worker] Found dataset metadata:`, metadata.name);
            
            // Get time series data
            const timeSeriesData = await getTimeSeriesData(datasetId, sku);
            console.log(`[Worker] Retrieved ${timeSeriesData ? timeSeriesData.length : 0} time series rows for SKU ${sku}`);
            
            if (!timeSeriesData || timeSeriesData.length === 0) {
              throw new Error(`No time series data found for dataset ${datasetId}${sku ? ` and SKU ${sku}` : ''}`);
            }
            
            // Convert to the format expected by the models
            data = timeSeriesData.map(row => ({
              'Material Code': row.sku_code,
              'Date': row.date,
              'Sales': row.value
            }));
            
            console.log(`[Worker] Converted data format, sample:`, data.slice(0, 2));
            
            // Extract metadata
            if (metadata.metadata) {
              const meta = metadata.metadata;
              if (meta.summary && meta.summary.frequency) {
                frequency = meta.summary.frequency;
                seasonalPeriod = getSeasonalPeriodsFromFrequency(frequency);
                console.log(`[Worker] Using frequency: ${frequency}, seasonal period: ${seasonalPeriod}`);
              }
              
              // Create column mapping
              if (meta.columnRoles && meta.columns) {
                columnMapping = {};
                meta.columnRoles.forEach((role, index) => {
                  columnMapping[role] = meta.columns[index];
                });
                console.log(`[Worker] Created column mapping:`, columnMapping);
              }
              
              // Apply cleaning metadata if it exists
              if (meta.cleaningMetadata && meta.cleaningMetadata.version === 1) {
                console.log(`[Worker] Applying cleaning metadata from database for job ${job.id}`);
                data = applyCleaningMetadata(data, meta.cleaningMetadata);
                console.log(`[Worker] Applied ${Object.keys(meta.cleaningMetadata.activeCorrections || {}).length} SKU corrections from database`);
              }
            }
            
            console.log(`[Worker] Loaded ${data.length} rows from database for dataset ${datasetId}`);
        } catch (fileErr) {
          throw new Error(`Failed to load data from dataset ${datasetId}: ${fileErr.message}`);
        }
      }

      if (!data || data.length === 0) {
        throw new Error('No data provided for optimization');
      }

      // Filter data by SKU if specified
      if (sku && data.length > 0) {
        const originalLength = data.length;
        
        // Use column mapping if available, otherwise fallback to legacy logic
        let skuColumnName = 'Material Code'; // Default fallback
        
        if (columnMapping && columnMapping['Material Code']) {
          skuColumnName = columnMapping['Material Code'];
                  console.log(`[Worker] Using column mapping: ${skuColumnName} for Material Code role`);
        }
        
        data = data.filter(row => {
          const rowSku = row[skuColumnName] || row['Material Code'] || row.sku || row.SKU;
          return String(rowSku) === sku;
        });
        
        if (data.length === 0) {
          throw new Error(`No data found for SKU: ${sku} in column: ${skuColumnName}`);
        }
        
        // Add column mapping to data for models to use
        if (columnMapping) {
          data = data.map(row => ({ ...row, _columnMapping: columnMapping }));
        }
        
        console.log(`[Worker] Filtered data for SKU ${sku}: ${originalLength} → ${data.length} rows`);
      }

      // Data quality analysis
      const salesValues = data.map(d => {
        if (typeof d === 'object') {
          // Use column mapping if available, otherwise fallback to legacy logic
          if (d._columnMapping && d._columnMapping['Sales']) {
            return d[d._columnMapping['Sales']];
          }
          return d.sales || d.Sales || d.value || d.amount || d;
        }
        return d;
      });


      const dataQuality = {
        totalPoints: salesValues.length,
        hasNaN: salesValues.some(v => isNaN(v)),
        hasInfinity: salesValues.some(v => !isFinite(v)),
        allZero: salesValues.every(v => v === 0),
        allSame: salesValues.every(v => v === salesValues[0]),
        minVal: Math.min(...salesValues),
        maxVal: Math.max(...salesValues),
        range: Math.max(...salesValues) - Math.min(...salesValues),
        nonZeroCount: salesValues.filter(v => v !== 0).length,
        uniqueValues: new Set(salesValues).size
      };

      // Warn about potential issues
      if (dataQuality.hasNaN) {
        console.warn(`⚠️ Job ${job.id}: Data contains NaN values`);
      }
      if (dataQuality.hasInfinity) {
        console.warn(`⚠️ Job ${job.id}: Data contains Infinity values`);
      }
      if (dataQuality.allZero) {
        console.warn(`⚠️ Job ${job.id}: All sales values are zero - this will cause numerical issues`);
      }
      if (dataQuality.allSame) {
        console.warn(`⚠️ Job ${job.id}: All sales values are identical (${salesValues[0]}) - this will cause matrix singularities`);
      }
      if (dataQuality.uniqueValues < 3) {
        console.warn(`⚠️ Job ${job.id}: Only ${dataQuality.uniqueValues} unique values - insufficient variation for forecasting`);
      }

      let results;
      const progressCallback = async (progress) => {
        // Update progress in the database
        await dbRun('UPDATE optimization_jobs SET progress = $1, updated_at = $2 WHERE id = $3', [progress.percentage, new Date().toISOString(), job.id]);
      };
      
      if (optimizationType === 'grid') {
        results = await this.gridOptimizer.runGridSearch(data, modelTypes, progressCallback, frequency, seasonalPeriod);
      } else if (optimizationType === 'ai') {
        results = await this.runAIOptimization(data, modelTypes, progressCallback);
      } else {
        throw new Error(`Unknown optimization type: ${optimizationType}`);
      }

      // Log optimization results summary
      const successfulResults = results.results.filter(r => r.success);
      const failedResults = results.results.filter(r => !r.success);

      console.log(`[Worker] ✅ Optimization completed for SKU ${sku}: ${successfulResults.length} successful, ${failedResults.length} failed`);

      // Generate forecasts for successful optimizations
      if (successfulResults.length > 0) {
        try {
          console.log(`[Worker] 🚀 Generating forecasts for ${successfulResults.length} successful optimizations`);
          await generateForecastsFromOptimizationResults(data, successfulResults, sku, datasetId, job.optimizationId, frequency, job);
          console.log(`[Worker] ✅ Forecasts generated and stored successfully`);
        } catch (forecastError) {
          console.error(`[Worker] ❌ Failed to generate forecasts:`, forecastError.message);
          // Don't fail the optimization job if forecast generation fails
        }
      }

      // Store optimization results in the new table
      const resultData = {
        parameters: results.results.map(r => r.parameters).filter(Boolean),
        scores: results.results.map(r => ({ modelType: r.modelType, accuracy: r.accuracy, rmse: r.rmse, mape: r.mape, mae: r.mae})).filter(Boolean),
        forecasts: results.results.map(r => r.forecast).filter(Boolean)
      };
      
      await dbRun('INSERT INTO optimization_results (job_id, company_id, parameters, scores, forecasts) VALUES ($1, $2, $3, $4, $5)', 
        [job.id, job.company_id, JSON.stringify(resultData.parameters), JSON.stringify(resultData.scores), JSON.stringify(resultData.forecasts)]);
      
      await dbRun('UPDATE optimization_jobs SET status = $1, progress = 100, completed_at = $2, updated_at = $3 WHERE id = $4', 
        ['completed', new Date().toISOString(), new Date().toISOString(), job.id]);

    } catch (error) {
      console.error(`[Worker] ❌ Job ${job.id} failed:`, error.message);
      await dbRun('UPDATE optimization_jobs SET status = $1, completed_at = $2, updated_at = $3, error = $4 WHERE id = $5', ['failed', new Date().toISOString(), new Date().toISOString(), error.message, job.id]);
    } finally {
      this.isRunning = false;
      this.currentJobId = null;
    }
  }

  // AI Optimization logic remains largely the same, but needs to accept the progress callback
  async runAIOptimization(data, modelTypes, progressCallback) {
    results = await this.gridOptimizer.runGridSearch(
      data, 
      modelTypes,
      (progress) => progressCallback({ ...progress, phase: 'analysis' }) 
    );

    const promisingRanges = this.analyzePromisingRanges(results.results);
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
      // Get any pending job (the job will contain the company_id and user_id)
      const job = await dbGet('SELECT oj.*, ores.parameters, ores.scores, ores.forecasts FROM optimization_jobs oj LEFT JOIN optimization_results ores ON oj.id = ores.job_id WHERE oj.status = $1 ORDER BY oj.created_at ASC LIMIT 1', ['pending']);
      if (job) {
        await this.processJob(job);
      }
    } catch (error) {
      console.error('[Worker] Error polling for jobs:', error);
    }
  }

  startPolling(interval = 5000) { // Poll every 5 seconds

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

// Add this helper if not present
function getSeasonalPeriodsFromFrequency(frequency) {
  switch (frequency) {
    case 'daily': return 7;
    case 'weekly': return 52;
    case 'monthly': return 12;
    case 'quarterly': return 4;
    case 'yearly': return 1;
    default: return 12;
  }
}

// Generate forecast hash for forecast deduplication
function generateForecastHash(companyId, datasetId, sku, modelId, methodType, periods, parameters, optimizationId = null) {
  // Create hash input object
  const hashInput = {
    companyId,
    datasetId,
    sku,
    modelId,
    methodType,
    periods,
    parameters: parameters || {},
    optimizationId
  };
  
  // Generate SHA-256 hash using crypto module
  return crypto.createHash('sha256').update(JSON.stringify(hashInput)).digest('hex');
}

/**
 * Generate forecasts from optimization results and store them
 */
async function generateForecastsFromOptimizationResults(data, optimizationResults, sku, datasetId, optimizationId, frequency = 'monthly', job = null) {
  try {
    // Get forecast periods from settings (default to 12 months)
    let forecastPeriods = [12];
    try {
      const forecastPeriodsResult = await dbGet("SELECT value FROM user_settings WHERE company_id = $1 AND user_id = $2 AND key = 'global_forecastPeriods'", [job?.company_id || 1, job?.user_id || 1]);
      if (forecastPeriodsResult) {
        try {
          const parsed = JSON.parse(forecastPeriodsResult.value);
          forecastPeriods = Array.isArray(parsed) ? parsed : [parsed || 12];
        } catch (e) {
          console.warn('[Worker] Could not parse forecast periods from settings, using default:', e.message);
        }
      }
    } catch (e) {
      console.warn('[Worker] Could not get forecast periods from settings, using default:', e.message);
    }

    // Get company ID from settings (default to 'default_company')
    let companyId = 'default_company';
    try {
      const companyIdResult = await dbGet("SELECT value FROM user_settings WHERE company_id = $1 AND user_id = $2 AND key = 'global_companyId'", [job?.company_id || 1, job?.user_id || 1]);
      if (companyIdResult) {
        companyId = companyIdResult.value || 'default_company';
      }
    } catch (e) {
      console.warn('[Worker] Could not get company ID from settings, using default:', e.message);
    }

    // Filter data for the specific SKU
    let skuData = data;
    if (sku && data.length > 0) {
      // Use column mapping if available
      let skuColumnName = 'Material Code';
      // Column mapping is now handled through the data loading process above
      
      skuData = data.filter(row => {
        const rowSku = row[skuColumnName] || row['Material Code'] || row.sku || row.SKU;
        return String(rowSku) === sku;
      });
    }

    if (skuData.length === 0) {
      throw new Error(`No data found for SKU: ${sku}`);
    }

    // Sort data by date
    const dateColumnName = 'Date';
    const sortedData = skuData.sort((a, b) => 
      new Date(a[dateColumnName] || a['Date']).getTime() - new Date(b[dateColumnName] || b['Date']).getTime()
    );

    // Get the last date to generate forecast dates from
    const lastDate = new Date(Math.max(...sortedData.map(d => new Date(d[dateColumnName] || d['Date']).getTime())));
    
    // Detect data frequency
    // const frequency = inferDateFrequency(sortedData.map(d => d[dateColumnName] || d['Date'])); // This line is removed as frequency is now a parameter

    // Process each optimization result
    for (const result of optimizationResults) {
      try {
        const modelId = result.modelType;
        const method = result.method || 'grid';
        const bestParameters = result.parameters; // Each result already contains the parameters

        if (!bestParameters) {
          console.warn(`[Worker] No parameters found for model ${modelId}, skipping forecast generation`);
          continue;
        }

        // Get seasonal period for seasonal models
        const seasonalPeriod = bestParameters.seasonalPeriod || 
          (modelId.includes('seasonal') || modelId === 'holt_winters' || modelId === 'sarima' ? 12 : 1);

        // Create model instance with optimized parameters
        const instance = await modelFactory.createModel(modelId, bestParameters, seasonalPeriod);
        
        console.log(`[Worker] Created model instance:`, {
          modelType: modelId,
          instanceType: instance.constructor.name,
          hasTrainMethod: typeof instance.train === 'function',
          trainMethodSource: instance.train.toString().substring(0, 50)
        });

        // Train the model
        await instance.train(sortedData);

        // Generate forecasts for each period
        for (const period of forecastPeriods) {
          try {
            // Generate forecast dates for this period
            const forecastDates = [];
            for (let i = 1; i <= period; i++) {
              const nextDate = new Date(lastDate);
              switch (frequency) {
                case 'daily':
                  nextDate.setDate(nextDate.getDate() + i);
                  break;
                case 'weekly':
                  nextDate.setDate(nextDate.getDate() + (i * 7));
                  break;
                case 'monthly':
                  nextDate.setMonth(nextDate.getMonth() + i);
                  break;
                case 'quarterly':
                  nextDate.setMonth(nextDate.getMonth() + (i * 3));
                  break;
                case 'yearly':
                  nextDate.setFullYear(nextDate.getFullYear() + i);
                  break;
                default:
                  nextDate.setMonth(nextDate.getMonth() + i);
              }
              forecastDates.push(nextDate.toISOString().split('T')[0]);
            }

            // Predict for this period
            const predictions = instance.predict(period);

            // Format predictions
            const formattedPredictions = predictions.map((value, i) => ({
              date: forecastDates[i],
              value: Math.round(Number(value) || 0)
            }));

            // Calculate accuracy metrics
            const recentActual = sortedData.slice(-Math.min(10, sortedData.length)).map(d => d['Sales'] || d['sales']);
            const syntheticPredicted = predictions.slice(0, recentActual.length);
            
            const accuracy = recentActual.length > 0 ? 
              Math.max(0, 100 - Math.abs((recentActual[recentActual.length - 1] - syntheticPredicted[syntheticPredicted.length - 1]) / recentActual[recentActual.length - 1] * 100)) : 
              0;

            // Create forecast result structure
            const methodId = `${method}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const periodId = `period_${period}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const forecastResult = {
              sku: sku,
              modelId: modelId,
              modelName: result.displayName || modelId,
              datasetId: datasetId,
              companyId: companyId,
              methods: [{
                methodId: methodId,
                methodType: method,
                periods: [{
                  periodId: periodId,
                  periods: period,
                  parameters: bestParameters,
                  generatedAt: new Date().toISOString(),
                  predictions: formattedPredictions
                }]
              }],
              generatedAt: new Date().toISOString()
            };

            // Generate forecast hash for deduplication
            const forecastHash = generateForecastHash(companyId, datasetId, sku, modelId, method, period, bestParameters, optimizationId);
            
            // Check if forecast with same hash already exists
            const existingForecast = await dbGet(
              "SELECT id, is_final_forecast FROM forecasts WHERE forecast_hash = $1 ORDER BY generated_at DESC LIMIT 1",
              [forecastHash]
            );
            
            if (existingForecast) {
              console.log(`[Worker] Forecast with hash ${forecastHash.slice(0, 8)}... already exists, skipping storage`);
              continue;
            }

            // Store forecast in database
            try {
              await dbRun(`
                INSERT INTO forecasts (
                  company_id, dataset_id, sku_id, model_id, method_id, period_id, 
                  method_type, periods, parameters, predictions, 
                  optimization_id, job_id, forecast_hash, is_final_forecast, generated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              `, [
                job?.company_id || 1, // company_id - from job context
                datasetId, // dataset_id - passed directly
                null, // sku_id - should be looked up from sku code
                null, // model_id - should be looked up from model name
                methodId,
                periodId,
                method,
                period,
                JSON.stringify(bestParameters),
                
                JSON.stringify(formattedPredictions),
                optimizationId,
                null, // job_id - could be added if needed
                forecastHash,
                false, // is_final_forecast - default to false, can be set via API
                new Date().toISOString()
              ]);
              console.log(`[Worker] ✅ Stored forecast for ${sku}/${modelId}/${method}/${period} months in database (hash: ${forecastHash.slice(0, 8)}...)`);
            } catch (err) {
              if (err.code === '23505') { // PostgreSQL unique constraint violation
                console.error(`[Worker] Unique constraint violation - final forecast already exists for ${companyId}/${datasetId}/${sku}`);
              } else {
                console.error(`[Worker] Error storing forecast in database:`, err);
              }
            }

          } catch (periodError) {
            console.error(`[Worker] Error generating forecast for period ${period}:`, periodError.message);
          }
        }

      } catch (modelError) {
        console.error(`[Worker] Error generating forecast for model ${result.modelType}:`, modelError.message);
      }
    }

    // Clean up old forecasts with different strategies for final vs non-final forecasts
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      // Delete non-final forecasts older than 90 days
      await dbRun(`
        DELETE FROM forecasts 
        WHERE generated_at < $1 AND is_final_forecast = false AND optimization_id IS NOT NULL
      `, [ninetyDaysAgo.toISOString()]);
      console.log('[Worker] ✅ Cleaned up old non-final forecasts (90+ days)');
      
      // Note: Final forecasts (isFinalForecast = true) are kept indefinitely for demand planning accuracy
      // They should only be deleted manually or through specific business logic
      
    } catch (cleanupError) {
      console.error('[Worker] Error in forecast cleanup:', cleanupError);
    }

  } catch (error) {
    console.error('[Worker] Error in generateForecastsFromOptimizationResults:', error);
    throw error;
  }
}

// --- Main Execution ---
async function main() {
    const worker = new OptimizationWorker();
    worker.startPolling();
}

main().catch(console.error);
