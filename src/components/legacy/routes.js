import express from 'express';
import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import winston from 'winston';
import fileUpload from 'express-fileupload';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sha256 } from 'js-sha256';
import crypto from 'crypto';
import Papa from 'papaparse';
import { parseCsvWithHeaders, detectColumnRoles, parseNumberWithFormat, parseDateWithFormat, transposeData, normalizeAndPivotData, inferDateFrequency, applyTransformations, findField, autoDetectSeparator } from './utils.js';
import { 
  createDataset, 
  insertTimeSeriesData, 
  getDatasetMetadata, 
  getTimeSeriesData, 
  findDatasetByHash,
  getDatasets,
  getDivisions,
  getClusters,
  getSopCycles,
  getUserRoles
} from './db.js';
import { callGrokAPI } from './grokService.js';
import { optimizeParametersWithAI, getModelRecommendation } from './aiOptimizationService.js';
import { MODEL_METADATA } from './models/ModelMetadata.js';
import { modelFactory } from './models/ModelFactory.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
const UPLOADS_DIR = path.resolve('uploads');

// Initialize Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000,
  message: { error: 'Too many requests, please try again later.' }
});
router.use(globalLimiter);

// File upload middleware
router.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  abortOnLimit: true,
  createParentPath: true
}));

// Standardized error response
function sendError(res, status, message, details = {}) {
  logger.error(`${message}: ${JSON.stringify(details)}`);
  res.status(status).json({ error: message, details });
}

// Safe JSON parsing
function safeParseJSON(data, defaultValue = {}) {
  try {
    return JSON.parse(data);
          } catch (error) {
    logger.error(`JSON parse error: ${error.message}`);
    return defaultValue;
  }
}

// Validate dataset ID
function validateDatasetId(datasetId) {
  if (!datasetId || typeof datasetId !== 'number' || isNaN(datasetId)) {
    throw new Error('Invalid datasetId. Expected a number');
  }
  return datasetId;
}

// Get or create SKU
async function getOrCreateSku(client, companyId, skuCode) {
  let skuResult = await client.query(
    'SELECT id FROM skus WHERE company_id = $1 AND sku_code = $2',
    [companyId, skuCode]
  );
  if (skuResult.rows.length === 0) {
    const newSkuResult = await client.query(
      'INSERT INTO skus (company_id, sku_code) VALUES ($1, $2) RETURNING id',
      [companyId, skuCode]
    );
    return newSkuResult.rows[0].id;
  }
  return skuResult.rows[0].id;
}

// Database pool
const pgPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

// Read AI instructions from files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const aiInstructionsSmall = fs.readFileSync(path.join(__dirname, 'config/CSVImport/ai_csv_instructions_small.txt'), 'utf-8');
const aiInstructionsLarge = fs.readFileSync(path.join(__dirname, 'config/CSVImport/ai_csv_instructions_large.txt'), 'utf-8');

// Track recent no-results logs to avoid spam
const recentNoResultsLogs = new Set();

// Job priorities
const JOB_PRIORITIES = {
  SETUP: 1,
  DATA_CLEANING: 2,
  INITIAL_IMPORT: 3
};

function getPriorityFromReason(reason) {
  if (reason === 'settings_change' || reason === 'config' || reason === 'metric_weight_change') {
    return JOB_PRIORITIES.DATA_CLEANING;
  }
  if (reason === 'csv_upload_data_cleaning' || reason === 'manual_edit_data_cleaning') {
    return JOB_PRIORITIES.SETUP;
  }
  if (reason === 'dataset_upload' || reason === 'initial_import') {
     return JOB_PRIORITIES.INITIAL_IMPORT;
  }
  return JOB_PRIORITIES.INITIAL_IMPORT;
}

// Helper function to get default result for model
function getDefaultResultForModel(model, sku, batchId, datasetId) {
  return {
    model_id: model,
    sku_code: sku,
    batch_id: batchId,
    dataset_id: datasetId,
    method: 'grid',
    status: 'pending',
    parameters: {},
    scores: { mape: null, rmse: null, mae: null, accuracy: null },
    forecasts: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// Helper function to safely calculate metric
function safeMetric(val, max) {
  return val !== null && val !== undefined && !isNaN(val) && val <= max ? val : null;
}

// Helper function to extract best results per model method
function extractBestResultsPerModelMethod(jobs, modelMetadataMap, weights = { mape: 0.4, rmse: 0.3, mae: 0.2, accuracy: 0.1 }) {
  const resultsByModel = {};
  
  jobs.forEach(job => {
    // Use the proper model_id column (no longer need to extract from payload)
    const modelId = job.model_id;
    const method = job.method;
    const key = `${modelId}_${method}`;
    
    if (!modelId) {
      console.warn('[extractBestResultsPerModelMethod] Skipping job without model_id:', job.id);
      return;
    }
    
    if (!resultsByModel[key]) {
      resultsByModel[key] = [];
    }
    
    // Use scores from optimization_results table if available, otherwise from job.scores
    const scores = job.scores || {};
    if (scores && typeof scores === 'object' && Object.keys(scores).length > 0) {
      resultsByModel[key].push({
        ...job,
        scores: scores,
        modelType: modelId,
        sku: job.sku,
        datasetId: job.dataset_id,
        optimizationId: job.optimization_id,
        methods: [{
          method: method,
          bestResult: {
            accuracy: scores.accuracy || 0,
            mape: scores.mape || 0,
            rmse: scores.rmse || 0,
            mae: scores.mae || 0,
            compositeScore: calculateWeightedScore(scores, weights),
            parameters: job.parameters || {},
            jobId: job.id,
            sku: job.sku,
            createdAt: job.created_at,
            completedAt: job.completed_at,
            datasetId: job.dataset_id,
            optimizationId: job.optimization_id
          },
          allResults: [{
            accuracy: scores.accuracy || 0,
            mape: scores.mape || 0,
            rmse: scores.rmse || 0,
            mae: scores.mae || 0,
            compositeScore: calculateWeightedScore(scores, weights),
            parameters: job.parameters || {},
            jobId: job.id,
            sku: job.sku,
            createdAt: job.created_at,
            completedAt: job.completed_at,
            datasetId: job.dataset_id,
            optimizationId: job.optimization_id
          }]
        }]
      });
    } else {
      console.warn('[extractBestResultsPerModelMethod] Job has no scores:', job.id, 'scores:', job.scores);
    }
  });
  
  const bestResults = [];
  
  Object.entries(resultsByModel).forEach(([key, results]) => {
    if (results.length === 0) return;
    
    // Find the best result based on weighted score
    let bestResult = results[0];
    let bestScore = calculateWeightedScore(results[0].scores, weights);
    
    results.forEach(result => {
      const score = calculateWeightedScore(result.scores, weights);
      if (score < bestScore) {
        bestScore = score;
        bestResult = result;
      }
    });
    
    bestResults.push(bestResult);
  });
  
  console.log(`[extractBestResultsPerModelMethod] Processed ${jobs.length} jobs, found ${bestResults.length} best results`);
  
  return bestResults;
}

// Helper function to calculate weighted score
function calculateWeightedScore(scores, weights) {
  if (!scores || typeof scores !== 'object') return Infinity;
  
  let totalScore = 0;
  let totalWeight = 0;
  
  Object.entries(weights).forEach(([metric, weight]) => {
    const value = scores[metric];
    if (value !== null && value !== undefined && !isNaN(value)) {
      totalScore += value * weight;
      totalWeight += weight;
    }
  });
  
  return totalWeight > 0 ? totalScore / totalWeight : Infinity;
}

// Helper function to get seasonal periods from frequency
function getSeasonalPeriodsFromFrequency(frequency) {
  const frequencyMap = {
    'daily': 7,
    'weekly': 52,
    'monthly': 12,
    'quarterly': 4,
    'yearly': 1
  };
  return frequencyMap[frequency] || 12;
}

/**
 * Health check endpoint
 * @route GET /health
 * @returns {object} Status of database connection
 */
router.get('/health', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT 1 as test');
    res.json({ 
      status: 'ok', 
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Database connection failed', { error: err.message, code: err.code });
  }
});

/**
 * Get schema for optimization_jobs table
 * @route GET /schema
 * @returns {object} Table schema
 */
router.get('/schema', async (req, res) => {
  try {
    const result = await pgPool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
      WHERE table_name = $1 
    ORDER BY ordinal_position
    `, ['optimization_jobs']);
    res.json({ 
      status: 'ok', 
      table: 'optimization_jobs',
      columns: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Schema check failed', { error: err.message, code: err.code });
  }
});

/**
 * Get job status
 * @route GET /jobs/status
 * @returns {object} Job status information
 */
router.get('/jobs/status', async (req, res) => {
  const { datasetId, method } = req.query;
  try {
    if (!datasetId) {
      return sendError(res, 400, 'Missing datasetId');
    }
    const datasetIdNum = validateDatasetId(datasetId);
    if (method && !['grid', 'ai', 'all'].includes(method)) {
      return sendError(res, 400, 'Invalid method', { valid: ['grid', 'ai', 'all'] });
    }
    const query = method && method !== 'all'
      ? 'SELECT oj.*, ores.parameters, ores.scores, ores.forecasts FROM optimization_jobs oj LEFT JOIN optimization_results ores ON oj.id = ores.job_id AND ores.company_id = oj.company_id WHERE oj.company_id = $1 AND oj.dataset_id = $2 AND method = $3'
      : 'SELECT oj.*, ores.parameters, ores.scores, ores.forecasts FROM optimization_jobs oj LEFT JOIN optimization_results ores ON oj.id = ores.job_id AND ores.company_id = oj.company_id WHERE oj.company_id = $1 AND oj.dataset_id = $2';
    const params = method && method !== 'all' ? [1, datasetIdNum, method] : [1, datasetIdNum];
    const result = await pgPool.query(query, params);
    res.json({ status: 'ok', jobs: result.rows });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch job status', { error: err.message });
  }
});

/**
 * Create optimization jobs
 * @route POST /jobs
 * @returns {object} Job creation result
 */
router.post('/jobs', authenticateToken, async (req, res) => {
  try {
    let { data, models, skus, reason, method = 'grid', datasetId, batchId, optimizationHash: frontendHash, metricWeights } = req.body;
    
    logger.info(`[Job Creation] Creating jobs for ${skus?.length || 0} SKUs, ${models?.length || 0} models, method: ${method}, datasetId: ${datasetId}`);
    logger.info(`[Job Creation] Frontend provided optimizationHash: ${frontendHash ? 'Yes' : 'No'}`);
    logger.info(`[Job Creation] Frontend provided metricWeights: ${metricWeights ? 'Yes' : 'No'}`);

    // Use authenticated user's company and user ID
    const companyId = req.user.company_id;
    const userId = req.user.id;

    // ===== COMPREHENSIVE VALIDATION =====

    // 1. Validate required fields
    if (!skus || !Array.isArray(skus) || skus.length === 0) {
      logger.warn('[Job Creation] Validation failed: skus array is required and must not be empty');
      return sendError(res, 400, 'skus array is required and must not be empty', { received: skus });
    }

    if (!models || !Array.isArray(models) || models.length === 0) {
      logger.warn('[Job Creation] Validation failed: models array is required and must not be empty');
      return sendError(res, 400, 'models array is required and must not be empty', { received: models });
    }

    if (!datasetId || typeof datasetId !== 'number' || isNaN(datasetId)) {
      logger.warn('[Job Creation] Validation failed: datasetId is required and must be a number');
      return sendError(res, 400, 'datasetId is required and must be a number', { received: datasetId });
    }

    // 2. Validate dataset exists
    try {
      const metadata = await getDatasetMetadata(datasetId);
      if (!metadata) {
        logger.warn(`[Job Creation] Validation failed: Dataset ${datasetId} not found`);
        return sendError(res, 404, `Dataset ${datasetId} not found`, { datasetId });
      }
      logger.info(`[Job Creation] Dataset ${datasetId} exists: ${metadata.name}`);
    } catch (error) {
      logger.warn(`[Job Creation] Validation failed: Error checking dataset ${datasetId}:`, error.message);
      return sendError(res, 500, `Error checking dataset existence: ${error.message}`, { datasetId });
    }

    // 3. Validate SKUs exist in database
    const skuValidationResults = [];
    for (const sku of skus) {
      try {
        const skuIdResult = await pgPool.query(
          'SELECT id, sku_code, description FROM skus WHERE company_id = $1 AND sku_code = $2',
          [companyId, sku]
        );
        if (skuIdResult.rows.length === 0) {
          skuValidationResults.push({ sku, exists: false, error: 'SKU not found in database' });
        } else {
          skuValidationResults.push({ sku, exists: true, skuId: skuIdResult.rows[0].id, description: skuIdResult.rows[0].description });
        }
      } catch (error) {
        skuValidationResults.push({ sku, exists: false, error: `Database error: ${error.message}` });
      }
    }

    const missingSkus = skuValidationResults.filter(result => !result.exists);
    if (missingSkus.length > 0) {
      logger.warn('[Job Creation] Validation failed: Some SKUs not found in database');
      return sendError(res, 400, 'Some SKUs not found in database', { missingSkus, validSkus: skuValidationResults.filter(result => result.exists) });
    }
    logger.info(`[Job Creation] All ${skus.length} SKUs exist in database`);

    // 4. Validate data availability for database datasets
    const dataValidationResults = [];
    for (const sku of skus) {
      try {
        const timeSeriesData = await getTimeSeriesData(datasetId, sku);
        if (!timeSeriesData || timeSeriesData.length === 0) {
          dataValidationResults.push({ sku, hasData: false, error: 'No time series data found' });
        } else {
          dataValidationResults.push({ sku, hasData: true, dataPoints: timeSeriesData.length });
        }
      } catch (error) {
        dataValidationResults.push({ sku, hasData: false, error: `Error loading data: ${error.message}` });
      }
    }
    
    const skusWithoutData = dataValidationResults.filter(result => !result.hasData);
    if (skusWithoutData.length > 0) {
      logger.warn('[Job Creation] Validation failed: Some SKUs have no data');
      return sendError(res, 400, 'Some SKUs have no data in the dataset', { skusWithoutData, skusWithData: dataValidationResults.filter(result => result.hasData) });
    }
    logger.info(`[Job Creation] All ${skus.length} SKUs have data in dataset ${datasetId}`);

    // 5. Validate models exist and are valid
    const modelValidationResults = [];
    for (const modelId of models) {
      const modelClass = modelFactory.getModelClass(modelId);
      if (!modelClass) {
        modelValidationResults.push({ modelId, valid: false, error: 'Model not found' });
      } else {
        modelValidationResults.push({ modelId, valid: true, displayName: modelClass.metadata?.displayName || modelId });
      }
    }

    const invalidModels = modelValidationResults.filter(result => !result.valid);
    if (invalidModels.length > 0) {
      logger.warn('[Job Creation] Validation failed: Some models are invalid');
      return sendError(res, 400, 'Some models are invalid or not found', { invalidModels, validModels: modelValidationResults.filter(result => result.valid) });
    }
    logger.info(`[Job Creation] All ${models.length} models are valid`);

    logger.info('[Job Creation] All validation passed, proceeding with job creation');

    // --- JOB CREATION LOGIC ---
    const priority = getPriorityFromReason(reason);
    let jobsCreated = 0;
    let jobsMerged = 0;

    // Get seasonal period from dataset metadata
    let seasonalPeriod = 12; // Default fallback
    try {
      const metadata = await getDatasetMetadata(datasetId);
      if (metadata && metadata.metadata && metadata.metadata.summary && metadata.metadata.summary.frequency) {
        const frequency = metadata.metadata.summary.frequency;
        seasonalPeriod = getSeasonalPeriodsFromFrequency(frequency);
        logger.info(`[Job Creation] Using seasonal period ${seasonalPeriod} from dataset ${datasetId} frequency: ${frequency}`);
      }
    } catch (e) {
      logger.warn('[Job Creation] Could not get seasonal period from dataset metadata, using default:', e.message);
    }
          
    for (const sku of skus) {
      logger.info(`[Job Creation] Creating jobs for SKU: ${sku}`);
      
      // Include all models - the worker will filter based on actual data availability
      const eligibleModels = models;
      
      // Generate optimizationId per SKU (not per job) - all models for this SKU share the same optimizationId
      const optimizationId = uuidv4();

      // Create jobs for all eligible models
      for (const modelId of eligibleModels) {
        // Check if model should be included in grid search using the model's own method
        const modelClass = modelFactory.getModelClass(modelId);
        if (method === 'grid' && modelClass && !modelClass.shouldIncludeInGridSearch()) {
          jobsMerged++;
          logger.info(`[Job Creation] Merged job for SKU: ${sku}, Model: ${modelId} (model opted out of grid search)`);
          continue;
        }
        
        // Generate optimization hash for this specific model
        const optimizationHash = generateOptimizationHash(sku, modelId, method, `dataset_${datasetId}`, {}, metricWeights);
        
        // Check if a job with the same hash already exists
        try {
          const existingJob = await checkExistingOptimizationJob(optimizationHash, userId);
          if (existingJob) {
            if (existingJob.status === 'pending' || existingJob.status === 'running') {
              jobsMerged++;
              logger.info(`[Job Creation] Merged job for SKU: ${sku}, Model: ${modelId} (duplicate job ${existingJob.id} already ${existingJob.status})`);
              continue;
            } else if (existingJob.status === 'completed') {
              jobsMerged++;
              logger.info(`[Job Creation] Merged job for SKU: ${sku}, Model: ${modelId} (duplicate job ${existingJob.id} already completed)`);
              continue;
            }
            // If failed or cancelled, we can create a new job
            logger.info(`[Job Creation] Creating new job for SKU: ${sku}, Model: ${modelId} (previous job ${existingJob.id} was ${existingJob.status})`);
          }
        } catch (error) {
          logger.warn(`[Job Creation] Error checking for existing job: ${error.message}`);
          // Continue with job creation if we can't check for duplicates
        }
        
        // Get friendly dataset name
        let friendlyName = '';
        try {
          const metadata = await getDatasetMetadata(datasetId);
          if (metadata && metadata.name) {
            friendlyName = metadata.name;
          }
        } catch (e) {
          logger.warn(`Could not get dataset name for ID ${datasetId}:`, e.message);
        }
        
        if (!friendlyName) {
          friendlyName = `Dataset ${datasetId}`;
        }

        // Create job data
        const jobData = { 
          modelTypes: [modelId], 
          optimizationType: method, 
          name: friendlyName, 
          sku,
          datasetId: datasetId
        };
        
        // Insert job
        const insertQuery = `
          INSERT INTO optimization_jobs (
            company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, 
            batch_id, priority, optimization_id, optimization_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
        
        // Lookup sku_id from skus table
        const skuIdResult = await pgPool.query(
          'SELECT id FROM skus WHERE company_id = $1 AND sku_code = $2',
          [companyId, sku]
        );
        const skuId = skuIdResult.rows[0]?.id;
        if (!skuId) throw new Error(`SKU not found: ${sku}`);
        
        // Ensure jobData is properly stringified
        const jobDataString = typeof jobData === 'string' ? jobData : JSON.stringify(jobData);
        await pgPool.query(insertQuery, [
          companyId, userId, skuId, sku, datasetId, method, jobDataString, 'pending', 
          reason || 'manual_trigger', batchId, priority, 
          optimizationId, optimizationHash
        ]);
        
        jobsCreated++;
        logger.info(`[Job Creation] Created job for SKU: ${sku}, Model: ${modelId}, Hash: ${optimizationHash.slice(0, 8)}...`);
      }
    }

    res.status(201).json({ 
      message: `Successfully created ${jobsCreated} jobs`, 
      jobsCreated, 
      jobsCancelled: 0, 
      jobsMerged, 
      jobsFiltered: 0,
      skusProcessed: skus.length, 
      modelsPerSku: models.length, 
      priority 
    });
  } catch (error) {
    logger.error('Error in jobs post:', error.message, error.stack);
    sendError(res, 500, 'Failed to create jobs', { error: error.message });
  }
});

/**
 * Get best results per model and method
 * @route GET /jobs/best-results-per-model
 * @returns {object} Best results grouped by model and method
 */
router.get('/jobs/best-results-per-model', async (req, res) => {
  try {
    const userId = 1; // or whatever your test user's id is
    const { method, datasetId, sku } = req.query;
    
    // Accept metric weights from query params, fallback to defaults
    const mapeWeight = parseFloat(req.query.mapeWeight) || 0.4;
    const rmseWeight = parseFloat(req.query.rmseWeight) || 0.3;
    const maeWeight = parseFloat(req.query.maeWeight) || 0.2;
    const accuracyWeight = parseFloat(req.query.accuracyWeight) || 0.1;
    const weights = { mape: mapeWeight, rmse: rmseWeight, mae: maeWeight, accuracy: accuracyWeight };
    
    // Validate method parameter
    if (method && !['grid', 'ai', 'all'].includes(method)) {
      return res.status(400).json({ error: 'Method must be "grid", "ai", or "all"' });
    }
    
    // Build query based on method filter and datasetId filter
    // Join with optimization_results to get only jobs that have results
    let query = `
      SELECT oj.*, ores.parameters, ores.scores, ores.forecasts 
      FROM optimization_jobs oj 
      LEFT JOIN optimization_results ores ON oj.id = ores.job_id AND ores.company_id = oj.company_id 
      WHERE oj.status = 'completed' AND oj.user_id = $1 AND ores.id IS NOT NULL
    `;
    let params = [userId];
    let paramIndex = 2;
    
    if (method && method !== 'all') {
      query += ` AND oj.method = $${paramIndex}`;
      params.push(method);
      paramIndex++;
    }
    
    if (datasetId) {
      // Use datasetId directly
      query += ` AND oj.dataset_id = $${paramIndex}`;
      params.push(datasetId);
      paramIndex++;
    }
    
    if (sku) {
      query += ` AND oj.sku_code = $${paramIndex}`;
      params.push(sku);
      paramIndex++;
    }
    
    query += " ORDER BY oj.created_at DESC";
    
    console.log(`[API] Query: ${query}, Params:`, params);
    
    const result = await pgPool.query(query, params);
    
    if (result.rows.length === 0) {
      // Return empty results instead of 404 to avoid console errors
      console.log(`[API] No jobs found with criteria: datasetId='${datasetId}', sku='${sku}', method='${method}'`);
      return res.json({
        totalJobs: 0,
        bestResultsPerModelMethod: [],
        timestamp: new Date().toISOString()
      });
    }
    
    // Create a lookup map for model metadata
    const modelMetadataMap = new Map();
    // Import MODEL_METADATA if available, otherwise use empty map
    try {
      const { MODEL_METADATA } = await import('./models/ModelMetadata.js');
      MODEL_METADATA.forEach(model => {
        modelMetadataMap.set(model.id, model);
      });
    } catch (error) {
      console.warn('[API] Could not load MODEL_METADATA, using empty map');
    }
    
    const bestResultsPerModelMethod = extractBestResultsPerModelMethod(result.rows, modelMetadataMap, weights);
    const response = {
      totalJobs: result.rows.length,
      bestResultsPerModelMethod,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[API] Returning ${bestResultsPerModelMethod.length} results for datasetId: ${datasetId}, sku: ${sku}`);
    if (bestResultsPerModelMethod.length > 0) {
              console.log(`[API] Sample result:`, {
          modelType: bestResultsPerModelMethod[0].modelType,
          sku: bestResultsPerModelMethod[0].sku,
          datasetId: bestResultsPerModelMethod[0].datasetId,
          methodsCount: bestResultsPerModelMethod[0].methods?.length,
          hasBestResult: bestResultsPerModelMethod[0].methods?.some(m => m.bestResult?.compositeScore !== null)
        });
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Error processing best results per model:', error);
    res.status(500).json({ error: 'Failed to process best results per model', details: error.message });
  }
});

/**
 * Detect existing datasets
 * @route GET /detect-existing-data
 * @returns {object} List of existing datasets with metadata
 */
router.get('/detect-existing-data', async (req, res) => {
  try {
    // Get all datasets for the company
    const datasetsResult = await pgPool.query(`
      SELECT 
        d.id,
        d.name,
        d.file_path,
        d.metadata,
        d.uploaded_at,
        d.dataset_hash,
        COUNT(DISTINCT tsd.sku_code) as sku_count,
        MIN(tsd.date) as min_date,
        MAX(tsd.date) as max_date,
        COUNT(DISTINCT tsd.date) as total_periods
      FROM datasets d
      LEFT JOIN time_series_data tsd ON d.id = tsd.dataset_id
      WHERE d.company_id = $1
      GROUP BY d.id, d.name, d.file_path, d.metadata, d.uploaded_at, d.dataset_hash
      ORDER BY d.uploaded_at DESC
    `, [1]); // Hardcoded company_id = 1 for now

    const datasets = datasetsResult.rows.map(row => {
      // Extract frequency from metadata if available
      let frequency = 'monthly'; // default
      if (row.metadata && row.metadata.summary && row.metadata.summary.frequency) {
        frequency = row.metadata.summary.frequency;
      }

      // Determine import type from metadata or filename
      let importType = 'Manual Import'; // default
      if (row.metadata && row.metadata.source) {
        if (row.metadata.source === 'ai-import') {
          importType = 'AI Import';
        } else if (row.metadata.source === 'manual-import') {
          importType = 'Manual Import';
        }
      } else if (row.file_path) {
        // Fallback: check filename for AI indicators
        const filename = path.basename(row.file_path);
        if (filename.includes('AI_Processed') || filename.includes('ai-import')) {
          importType = 'AI Import';
        }
      }

      return {
        id: row.id.toString(),
        name: row.name || `Dataset ${row.id}`,
        type: importType,
        filename: row.file_path ? path.basename(row.file_path) : `dataset_${row.id}.csv`,
        timestamp: new Date(row.uploaded_at).getTime(),
        summary: {
          skuCount: parseInt(row.sku_count) || 0,
          dateRange: [
            row.min_date ? new Date(row.min_date).toISOString().split('T')[0] : '',
            row.max_date ? new Date(row.max_date).toISOString().split('T')[0] : ''
          ],
          totalPeriods: parseInt(row.total_periods) || 0,
          frequency: frequency
        }
      };
    });

    res.json({ 
      status: 'ok',
      datasets: datasets,
                timestamp: new Date().toISOString()
            });
  } catch (err) {
    sendError(res, 500, 'Failed to detect existing data', { error: err.message });
  }
});

/**
 * Get settings
 * @route GET /settings
 * @returns {object} Application settings
 */
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    // Get company settings
    const companySettingsResult = await pgPool.query(`
      SELECT key, value FROM company_settings WHERE company_id = $1
    `, [1]); // Hardcoded company_id = 1 for now

    // Get user settings
    const userSettingsResult = await pgPool.query(`
      SELECT key, value FROM user_settings WHERE company_id = $1 AND user_id = $2
          `, [req.user.company_id, req.user.id]);

    // Combine settings
    const rawSettings = {};
    
    // Add company settings
    companySettingsResult.rows.forEach(row => {
      rawSettings[row.key] = row.value;
    });
    
    // Add user settings (user settings override company settings)
    userSettingsResult.rows.forEach(row => {
      rawSettings[row.key] = row.value;
    });

    // Parse and structure settings according to GlobalSettings interface
    const settings = {
      // Core forecast settings
      forecastPeriods: parseInt(rawSettings['global_forecastPeriods'] || '12'),
      
      // Business context
      businessContext: {
        costOfError: rawSettings['business_costOfError'] || 'medium',
        planningPurpose: rawSettings['business_planningPurpose'] || 'tactical',
        updateFrequency: rawSettings['business_updateFrequency'] || 'weekly',
        interpretabilityNeeds: rawSettings['business_interpretabilityNeeds'] || 'medium'
      },
      
      // AI settings
      aiForecastModelOptimizationEnabled: rawSettings['global_aiForecastModelOptimizationEnabled'] === 'true',
      aiCsvImportEnabled: rawSettings['global_aiCsvImportEnabled'] !== 'false', // Default to true
      aiFailureThreshold: parseInt(rawSettings['global_aiFailureThreshold'] || '5'),
      aiReasoningEnabled: rawSettings['global_aiReasoningEnabled'] === 'true',
      
      // File processing settings
      largeFileProcessingEnabled: rawSettings['global_largeFileProcessingEnabled'] !== 'false', // Default to true
      largeFileThreshold: parseInt(rawSettings['global_largeFileThreshold'] || '1048576'), // 1MB default
      
      // Metric weights (as percentages)
      mapeWeight: parseInt(rawSettings['global_mapeWeight'] || '40'),
      rmseWeight: parseInt(rawSettings['global_rmseWeight'] || '30'),
      maeWeight: parseInt(rawSettings['global_maeWeight'] || '20'),
      accuracyWeight: parseInt(rawSettings['global_accuracyWeight'] || '10'),
      
      // CSV import settings
      csvSeparator: rawSettings['global_csvSeparator'] || ',',
      autoDetectFrequency: rawSettings['global_autoDetectFrequency'] !== 'false' // Default to true
    };

    res.json({
      status: 'ok',
      settings: settings,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch settings', { error: err.message });
  }
});

/**
 * Update settings
 * @route POST /settings
 * @returns {object} Updated settings
 */
router.post('/settings', authenticateToken, async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return sendError(res, 400, 'Invalid settings data');
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // Map structured settings to database keys
      const settingsToUpdate = {};

      // Core forecast settings
      if (settings.forecastPeriods !== undefined) {
        settingsToUpdate['global_forecastPeriods'] = settings.forecastPeriods.toString();
      }

      // Business context settings
      if (settings.businessContext) {
        if (settings.businessContext.costOfError !== undefined) {
          settingsToUpdate['business_costOfError'] = settings.businessContext.costOfError;
        }
        if (settings.businessContext.planningPurpose !== undefined) {
          settingsToUpdate['business_planningPurpose'] = settings.businessContext.planningPurpose;
        }
        if (settings.businessContext.updateFrequency !== undefined) {
          settingsToUpdate['business_updateFrequency'] = settings.businessContext.updateFrequency;
        }
        if (settings.businessContext.interpretabilityNeeds !== undefined) {
          settingsToUpdate['business_interpretabilityNeeds'] = settings.businessContext.interpretabilityNeeds;
        }
      }

      // AI settings
      if (settings.aiForecastModelOptimizationEnabled !== undefined) {
        settingsToUpdate['global_aiForecastModelOptimizationEnabled'] = settings.aiForecastModelOptimizationEnabled.toString();
      }
      if (settings.aiCsvImportEnabled !== undefined) {
        settingsToUpdate['global_aiCsvImportEnabled'] = settings.aiCsvImportEnabled.toString();
      }
      if (settings.aiFailureThreshold !== undefined) {
        settingsToUpdate['global_aiFailureThreshold'] = settings.aiFailureThreshold.toString();
      }
      if (settings.aiReasoningEnabled !== undefined) {
        settingsToUpdate['global_aiReasoningEnabled'] = settings.aiReasoningEnabled.toString();
      }

      // File processing settings
      if (settings.largeFileProcessingEnabled !== undefined) {
        settingsToUpdate['global_largeFileProcessingEnabled'] = settings.largeFileProcessingEnabled.toString();
      }
      if (settings.largeFileThreshold !== undefined) {
        settingsToUpdate['global_largeFileThreshold'] = settings.largeFileThreshold.toString();
      }

      // Metric weights
      if (settings.mapeWeight !== undefined) {
        settingsToUpdate['global_mapeWeight'] = settings.mapeWeight.toString();
      }
      if (settings.rmseWeight !== undefined) {
        settingsToUpdate['global_rmseWeight'] = settings.rmseWeight.toString();
      }
      if (settings.maeWeight !== undefined) {
        settingsToUpdate['global_maeWeight'] = settings.maeWeight.toString();
      }
      if (settings.accuracyWeight !== undefined) {
        settingsToUpdate['global_accuracyWeight'] = settings.accuracyWeight.toString();
      }

      // CSV import settings
      if (settings.csvSeparator !== undefined) {
        settingsToUpdate['global_csvSeparator'] = settings.csvSeparator;
      }
      if (settings.autoDetectFrequency !== undefined) {
        settingsToUpdate['global_autoDetectFrequency'] = settings.autoDetectFrequency.toString();
      }

      // Update company settings
      for (const [key, value] of Object.entries(settingsToUpdate)) {
        await client.query(`
          INSERT INTO company_settings (company_id, key, value, updated_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (company_id, key)
          DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP, updated_by = $4
        `, [req.user.company_id, key, value, req.user.id]);
      }
      
      await client.query('COMMIT');
      
      res.json({ 
        status: 'ok',
        message: 'Settings updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    sendError(res, 500, 'Failed to update settings', { error: err.message });
  }
});

/**
 * Get available models
 * @route GET /models
 * @returns {object} List of available forecasting models
 */
router.get('/models', async (req, res) => {
  try {
    const models = [
      {
        id: 'simple-exponential-smoothing',
        name: 'Simple Exponential Smoothing',
        description: 'Basic exponential smoothing for trendless data',
        category: 'smoothing',
        parameters: ['alpha'],
        seasonal: false
      },
      {
        id: 'holt-linear-trend',
        name: 'Holt Linear Trend',
        description: 'Exponential smoothing with linear trend',
        category: 'trend',
        parameters: ['alpha', 'beta'],
        seasonal: false
      },
      {
        id: 'holt-winters',
        name: 'Holt-Winters',
        description: 'Exponential smoothing with trend and seasonality',
        category: 'seasonal',
        parameters: ['alpha', 'beta', 'gamma'],
        seasonal: true
      },
      {
        id: 'arima',
        name: 'ARIMA',
        description: 'Autoregressive Integrated Moving Average',
        category: 'statistical',
        parameters: ['p', 'd', 'q'],
        seasonal: false
      },
      {
        id: 'sarima',
        name: 'SARIMA',
        description: 'Seasonal ARIMA',
        category: 'seasonal',
        parameters: ['p', 'd', 'q', 'P', 'D', 'Q', 's'],
        seasonal: true
      },
      {
        id: 'moving-average',
        name: 'Moving Average',
        description: 'Simple moving average forecasting',
        category: 'smoothing',
        parameters: ['window'],
        seasonal: false
      },
      {
        id: 'seasonal-moving-average',
        name: 'Seasonal Moving Average',
        description: 'Moving average with seasonality',
        category: 'seasonal',
        parameters: ['window', 'seasonal_period'],
        seasonal: true
      },
      {
        id: 'linear-trend',
        name: 'Linear Trend',
        description: 'Simple linear regression trend',
        category: 'trend',
                  parameters: [],
        seasonal: false
      },
      {
        id: 'seasonal-naive',
        name: 'Seasonal Naive',
        description: 'Naive forecast with seasonality',
        category: 'seasonal',
        parameters: ['seasonal_period'],
        seasonal: true
      }
    ];

    // Return array directly (not wrapped in object) - matches original implementation
    res.json(models);
  } catch (err) {
    sendError(res, 500, 'Failed to fetch models', { error: err.message });
  }
});

/**
 * Get optimization status
 * @route GET /optimizations/status
 * @returns {object} Optimization status and progress grouped by SKU
 */
router.get('/optimizations/status', async (req, res) => {
  try {
    // Get optimization jobs with SKU information
    const optimizationsResult = await pgPool.query(`
      SELECT 
        oj.optimization_id,
        oj.optimization_hash,
        oj.batch_id,
        oj.reason,
        oj.sku_code,
        oj.dataset_id,
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN oj.status = 'pending' THEN 1 END) as pending_jobs,
        COUNT(CASE WHEN oj.status = 'running' THEN 1 END) as running_jobs,
        COUNT(CASE WHEN oj.status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN oj.status = 'failed' THEN 1 END) as failed_jobs,
        COUNT(CASE WHEN oj.status = 'cancelled' THEN 1 END) as cancelled_jobs,
        COUNT(CASE WHEN oj.status = 'skipped' THEN 1 END) as skipped_jobs,
        MIN(oj.created_at) as created_at,
        MAX(oj.updated_at) as updated_at,
        AVG(oj.progress) as avg_progress
      FROM optimization_jobs oj
      WHERE oj.company_id = $1 AND oj.optimization_id IS NOT NULL
      GROUP BY oj.optimization_id, oj.optimization_hash, oj.batch_id, oj.reason, oj.sku_code, oj.dataset_id
      ORDER BY MIN(oj.created_at) DESC
    `, [1]); // Hardcoded company_id = 1 for now

    // Group optimizations by SKU
    const skuGroups = {};
    
    optimizationsResult.rows.forEach(row => {
      const skuCode = row.sku_code || 'unknown';
      const datasetId = row.dataset_id || 0;
      const batchId = row.batch_id || 'default';
      
      if (!skuGroups[skuCode]) {
        skuGroups[skuCode] = {
          sku: skuCode,
          skuDescription: skuCode, // Could be enhanced with actual SKU descriptions
          datasetId: datasetId,
          batches: {},
          totalJobs: 0,
          pendingJobs: 0,
          runningJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          cancelledJobs: 0,
          skippedJobs: 0,
          progress: 0,
          isOptimizing: false,
          methods: [],
          models: []
        };
      }
      
      const totalJobs = parseInt(row.total_jobs);
      const completedJobs = parseInt(row.completed_jobs);
      const failedJobs = parseInt(row.failed_jobs);
      const runningJobs = parseInt(row.running_jobs);
      const pendingJobs = parseInt(row.pending_jobs);
      const cancelledJobs = parseInt(row.cancelled_jobs);
      const skippedJobs = parseInt(row.skipped_jobs);

      let status = 'pending';
      if (failedJobs > 0 && completedJobs === 0) {
        status = 'failed';
      } else if (completedJobs === totalJobs) {
        status = 'completed';
      } else if (runningJobs > 0 || completedJobs > 0) {
        status = 'running';
      }

      const progress = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
      const isOptimizing = pendingJobs > 0 || runningJobs > 0;

      // Create batch object
      const batch = {
        batchId: batchId,
        sku: skuCode,
        skuDescription: skuCode,
        datasetId: datasetId,
        reason: row.reason,
        priority: 1, // Default priority
        createdAt: row.created_at,
        optimizations: {
          [row.optimization_id]: {
            optimizationId: row.optimization_id,
            modelId: 'unknown', // Could be extracted from job payload
            modelDisplayName: 'Unknown Model',
            modelShortName: 'Unknown',
            method: 'grid', // Default method
            methodDisplayName: 'Grid Search',
            methodShortName: 'Grid',
            reason: row.reason,
            status: status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            progress: progress,
          jobs: []
          }
        },
        totalJobs: totalJobs,
        pendingJobs: pendingJobs,
        runningJobs: runningJobs,
        completedJobs: completedJobs,
        failedJobs: failedJobs,
        cancelledJobs: cancelledJobs,
        skippedJobs: skippedJobs,
        progress: progress,
        isOptimizing: isOptimizing,
        methods: ['grid'], // Default method
        models: ['unknown'] // Default model
      };

      // Add batch to SKU group
      skuGroups[skuCode].batches[batchId] = batch;
      
      // Update SKU group totals
      skuGroups[skuCode].totalJobs += totalJobs;
      skuGroups[skuCode].pendingJobs += pendingJobs;
      skuGroups[skuCode].runningJobs += runningJobs;
      skuGroups[skuCode].completedJobs += completedJobs;
      skuGroups[skuCode].failedJobs += failedJobs;
      skuGroups[skuCode].cancelledJobs += cancelledJobs;
      skuGroups[skuCode].skippedJobs += skippedJobs;
      skuGroups[skuCode].isOptimizing = skuGroups[skuCode].isOptimizing || isOptimizing;
    });

    // Convert to array and calculate SKU group progress
    const skuGroupsArray = Object.values(skuGroups).map(skuGroup => {
      const totalProcessable = skuGroup.totalJobs - skuGroup.cancelledJobs;
      skuGroup.progress = totalProcessable > 0 ? Math.round(((skuGroup.completedJobs + skuGroup.failedJobs) / totalProcessable) * 100) : 0;
      return skuGroup;
    });

    res.json({
      status: 'ok',
      optimizations: skuGroupsArray,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch optimization status', { error: err.message });
  }
});

/**
 * Transform CSV data using Grok
 * @route POST /grok-transform
 * @returns {object} Transformed data
 */
router.post('/grok-transform', async (req, res) => {
  try {
    const { csvData, reasoningEnabled } = req.body;
    if (!csvData) {
      return sendError(res, 400, 'Missing csvData');
    }
    const { data, headers } = parseCsvWithHeaders(csvData);
    // Placeholder for Grok transformation logic
    const transformed = data.map(row => ({ ...row, transformed: true }));
    res.json({ status: 'ok', headers, data: transformed });
  } catch (err) {
    sendError(res, 500, 'Failed to process transformation', { error: err.message });
  }
});

/**
 * Grok generate config endpoint
 * @route POST /grok-generate-config
 * @returns {object} Generated configuration
 */
router.post('/grok-generate-config', async (req, res) => {
  try {
    const { csvChunk, fileSize, reasoningEnabled } = req.body;
    if (!csvChunk) {
      return res.status(400).json({ error: 'Missing csvChunk or instructions' });
    }

    const outputFormat = reasoningEnabled
      ? `{
          "reasoning": "Detailed explanation of how you generated the configuration.",
          "config": {
            "operations": [
              { "operation": "rename", "old_name": "Old Name", "new_name": "New Name" },
              { "operation": "pivot_longer", "cols": ["Jan", "Feb", "Mar"], "names_to": "Month", "values_to": "Sales" }
            ]
          }
        }`
      : `{
          "config": {
            "operations": [
              { "operation": "rename", "old_name": "Old Name", "new_name": "New Name" },
              { "operation": "pivot_longer", "cols": ["Jan", "Feb", "Mar"], "names_to": "Month", "values_to": "Sales" }
            ]
          }
        }`;

    const prompt = `CSV Data (first 5 rows):\n${JSON.stringify(csvChunk.slice(0, 5), null, 2)}\n\nInstructions:\n${aiInstructionsLarge}\n\nOutput Format:\n${outputFormat}`;
    const response = await callGrokAPI(prompt, 4000, reasoningEnabled);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch (parseError) {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ error: 'Failed to parse Grok response as JSON' });
      }
    }

    const reasoning = parsedResponse.reasoning || 'No reasoning provided';
    const config = parsedResponse.config || parsedResponse;

    res.json({ 
      config,
      reasoning,
      originalResponse: response
    });
  } catch (error) {
    console.error('Error in grok-generate-config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Apply config endpoint
 * @route POST /apply-config
 * @returns {object} Applied configuration result
 */
router.post('/apply-config', async (req, res) => {
  try {
    const { data, config } = req.body;
    if (!data || !config) {
      return res.status(400).json({ error: 'Missing data or config' });
    }

    const transformedData = applyTransformations(data, config.operations);
    const columns = Object.keys(transformedData[0] || {});
    const columnRoles = detectColumnRoles(columns).map(obj => obj.role);

    res.json({ 
      transformedData,
      columns,
      columnRoles
    });
  } catch (error) {
    console.error('Error in apply-config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Load processed data endpoint
 * @route GET /load-processed-data
 * @returns {object} Processed data
 */
router.get('/load-processed-data', async (req, res) => {
  try {
    const { datasetId, sku } = req.query;

    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId parameter is required' });
    }

    const id = parseInt(datasetId);
    logger.info(`[load-processed-data] Loading dataset with ID: ${id}${sku ? ` for SKU: ${sku}` : ''}`);
    
    const metadata = await getDatasetMetadata(id);
    logger.info(`[load-processed-data] Metadata result: ${metadata ? 'found' : 'not found'}`);
    
    if (!metadata) {
      return sendError(res, 404, 'Dataset not found');
    }
    
    // Load time series data, optionally filtered by SKU
    let timeSeriesData;
    if (sku) {
      timeSeriesData = await getTimeSeriesData(id, sku);
      logger.info(`[load-processed-data] Time series data for SKU result: ${timeSeriesData ? `${timeSeriesData.length} rows` : 'not found'}`);
    } else {
      timeSeriesData = await getTimeSeriesData(id);
      logger.info(`[load-processed-data] Time series data result: ${timeSeriesData ? `${timeSeriesData.length} rows` : 'not found'}`);
    }
    
    if (!timeSeriesData || timeSeriesData.length === 0) {
      return sendError(res, 404, sku ? `No time series data found for dataset and SKU ${sku}` : 'No time series data found for dataset');
    }
    
    // Convert to the format expected by the frontend
    const data = {
      data: timeSeriesData.map(row => ({
        'Material Code': row.sku_code,
        'Date': row.date,
        'Sales': row.value
      })),
      columns: metadata.metadata?.columns || ['Material Code', 'Date', 'Sales'],
      columnRoles: metadata.metadata?.columnRoles || ['Material Code', 'Date', 'Sales'],
      source: metadata.metadata?.source || 'database',
      summary: metadata.metadata?.summary || {},
      name: metadata.name,
      csvHash: metadata.metadata?.csvHash
    };
    
    res.json(data);
  } catch (error) {
    logger.error('Error loading processed data:', error);
    sendError(res, 500, 'Failed to load processed data', { details: error.message });
  }
});

/**
 * AI optimize endpoint
 * @route POST /ai-optimize
 * @returns {object} AI optimization result
 */
router.post('/ai-optimize', async (req, res) => {
  try {
    const { modelId, data, metricWeights } = req.body;
    const result = await optimizeParametersWithAI(modelId, data, metricWeights);
    res.json(result);
  } catch (error) {
    console.error('Error in ai-optimize:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * AI model recommendation endpoint
 * @route POST /ai-model-recommendation
 * @returns {object} Model recommendation
 */
router.post('/ai-model-recommendation', async (req, res) => {
  try {
    const { data } = req.body;
    const recommendation = await getModelRecommendation(data);
    res.json(recommendation);
  } catch (error) {
    console.error('Error in ai-model-recommendation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save cleaning metadata endpoint
 * @route POST /save-cleaned-data
 * @returns {object} Save result
 */
router.post('/save-cleaned-data', async (req, res) => {
  try {
    const { cleaningMetadata, datasetId } = req.body;
    
    console.log('[save-cleaned-data] Received request:', {
      hasCleaningMetadata: !!cleaningMetadata,
      datasetId: datasetId,
      datasetIdType: typeof datasetId,
      datasetIdIsNaN: isNaN(datasetId)
    });
    
    if (!cleaningMetadata || !datasetId) {
      return res.status(400).json({ error: 'Missing cleaningMetadata or datasetId' });
    }

    // Convert datasetId to number if it's a string
    const numericDatasetId = typeof datasetId === 'string' ? parseInt(datasetId, 10) : datasetId;
    
    // Validate datasetId
    const validDatasetId = validateDatasetId(numericDatasetId);
    if (!validDatasetId) {
      return res.status(400).json({ error: 'Invalid datasetId' });
    }

    // Save cleaning metadata to database
    try {
      const client = await pool.connect();
      try {
        // Update the dataset's cleaning metadata
        await client.query(
          'UPDATE datasets SET cleaning_metadata = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(cleaningMetadata), validDatasetId]
        );
        
        console.log(`[save-cleaned-data] Updated cleaning metadata for dataset ${validDatasetId}`);
        
        res.json({ 
          success: true,
          datasetId: validDatasetId,
          message: 'Cleaning metadata saved successfully'
        });
      } finally {
        client.release();
      }
    } catch (dbError) {
      console.error('Database error saving cleaning metadata:', dbError);
      res.status(500).json({ error: 'Failed to save cleaning metadata to database' });
    }
  } catch (error) {
    console.error('Error saving cleaning metadata:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process AI import endpoint
 * @route POST /process-ai-import
 * @returns {object} AI import result
 */
router.post('/process-ai-import', async (req, res) => {
  try {
    const { transformedData, originalCsvString, reasoning } = req.body;
    if (!transformedData || !originalCsvString) {
      return res.status(400).json({ error: 'Missing transformedData or originalCsvString' });
    }

    // Generate timestamp and hash
    const timestamp = Date.now();
    const csvHash = crypto.createHash('sha256').update(originalCsvString, 'utf8').digest('hex').slice(0, 30);
    
    // Save original CSV
    const baseName = `AI_Processed_Upload-${timestamp}`;
    const csvFileName = `${baseName}-${csvHash.slice(0, 8)}-original.csv`;
    const csvFilePath = path.join(UPLOADS_DIR, csvFileName);
    fs.writeFileSync(csvFilePath, originalCsvString);

    // Process the transformed data
    const columns = Object.keys(transformedData[0] || {});
    const columnRoles = detectColumnRoles(columns).map(obj => obj.role);

    // Filter out rows where all sales values are zero or empty
    const filteredTransformedData = transformedData.filter(row => {
      // Check if this row has any non-zero sales values
      const salesValue = row['Sales'];
      if (salesValue !== undefined && salesValue !== null && salesValue !== '' && salesValue !== 0) {
        const num = Number(salesValue);
        return Number.isFinite(num) && num > 0;
      }
      return false;
    });

    // Extract summary information
    const skuList = Array.from(new Set(filteredTransformedData.map(row => row['Material Code']).filter(Boolean)));
    const skuCount = skuList.length;
    const dateList = filteredTransformedData.map(row => row['Date']).filter(Boolean);
    const uniqueDates = Array.from(new Set(dateList)).sort();
    const dateRange = uniqueDates.length > 0 ? [uniqueDates[0], uniqueDates[uniqueDates.length - 1]] : ["N/A", "N/A"];
    const totalPeriods = uniqueDates.length;
    const frequency = inferDateFrequency(uniqueDates);

    // Create dataset
    const companyId = 1;
    const divisionId = 1; // Default division for now
    const clusterId = 1; // Default cluster for now
    const createdBy = 1;
    const datasetName = `AI Processed Dataset ${new Date().toISOString().slice(0,10)} - ${skuCount} products`;
    
    const metadata = {
      columns,
      columnRoles,
      source: 'ai-import',
      reasoning,
      summary: {
        skuCount,
        dateRange,
        totalPeriods,
        frequency,
      },
      csvHash
    };
    
    const datasetId = await createDataset(
      companyId,
      divisionId,
      clusterId,
      datasetName,
      `uploads/${csvFileName}`,
      createdBy,
      metadata
    );

    // Insert time series data
    const timeSeriesRows = filteredTransformedData.map(row => ({
      sku_code: row['Material Code'],
      date: row['Date'],
      value: parseFloat(row['Sales']) || 0
    })).filter(row => row.sku_code && row.date && !isNaN(row.value));
    
    await insertTimeSeriesData(datasetId, timeSeriesRows, companyId);

    res.json({
      success: true,
      datasetId,
      summary: {
        skuCount,
        dateRange,
        totalPeriods,
        frequency,
      },
      skuList,
      columns,
      columnRoles,
      reasoning
    });
  } catch (error) {
    console.error('Error processing AI import:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process manual import endpoint
 * @route POST /process-manual-import
 * @returns {object} Manual import result
 */
router.post('/process-manual-import', authenticateToken, async (req, res) => {
  try {
    const { headers, data, mappings, dateFormat, transpose, finalColumnRoles, originalCsvData, originalCsvString } = req.body;

    // Validate required fields
    if (!headers || !data || !mappings || !finalColumnRoles) {
      return sendError(res, 400, 'Missing required fields', { 
        required: ['headers', 'data', 'mappings', 'finalColumnRoles'],
        received: Object.keys(req.body)
      });
    }

    // Generate single timestamp for both files
    const timestamp = Date.now();

    // Save original CSV data first (for detection logic)
    let csvHash = '';

    // Use raw CSV string if provided, otherwise reconstruct from originalCsvData
    if (originalCsvString) {
      // Hash the raw CSV string directly (this matches the frontend hash)
      csvHash = crypto.createHash('sha256').update(originalCsvString, 'utf8').digest('hex').slice(0, 30);
    } else if (originalCsvData && Array.isArray(originalCsvData) && originalCsvData.length > 0) {
      // Fallback: Convert array of objects back to CSV format
      const csvHeaders = Object.keys(originalCsvData[0]);
      const csvContent = [
        csvHeaders.join(','),
        ...originalCsvData.map(row => csvHeaders.map(header => row[header]).join(','))
      ].join('\n');
      csvHash = crypto.createHash('sha256').update(csvContent, 'utf8').digest('hex').slice(0, 30);
    }

    // Generate base name from timestamp
    const baseName = `Original_CSV_Upload-${timestamp}`;

    // Save original CSV with new naming convention
    const csvFileName = `${baseName}-${csvHash.slice(0, 8)}-original.csv`;
    const csvFilePath = path.join(UPLOADS_DIR, csvFileName);

    if (originalCsvString) {
      fs.writeFileSync(csvFilePath, originalCsvString);
      logger.info('Saved original CSV from raw string:', csvFileName);
    } else if (originalCsvData && Array.isArray(originalCsvData) && originalCsvData.length > 0) {
      const csvHeaders = Object.keys(originalCsvData[0]);
      const csvContent = [
        csvHeaders.join(','),
        ...originalCsvData.map(row => csvHeaders.map(header => row[header]).join(','))
      ].join('\n');
      fs.writeFileSync(csvFilePath, csvContent);
      logger.info('Saved original CSV from reconstructed data:', csvFileName);
    }

    // Use the provided cleaned headers and data directly
    let processedData = data;
    let processedHeaders = headers;

    // If transpose is requested, transpose the data and headers
    if (transpose) {
      // Transpose logic for data and headers
      const transposed = processedHeaders.map((_, colIndex) => processedData.map(row => row[processedHeaders[colIndex]]));
      processedHeaders = transposed[0];
      processedData = transposed.slice(1).map(rowArr => {
        const rowObj = {};
        processedHeaders.forEach((h, i) => {
          rowObj[h] = rowArr[i];
        });
        return rowObj;
      });
    }

    // The normalizeAndPivotData is specifically designed for the manual mapping flow.
    // We assume processedData is an array of objects, each representing a row, with keys matching processedHeaders.
    // Convert processedData to array of arrays for compatibility with normalizeAndPivotData
    const dataRows = processedData.map(row => processedHeaders.map(h => row[h]));

    const { data: transformedData, columns } = normalizeAndPivotData(dataRows, mappings, undefined, dateFormat, processedHeaders);

    if (!finalColumnRoles || finalColumnRoles.length !== columns.length) {
      throw new Error('finalColumnRoles length does not match normalized columns length');
    }

    const columnRoles = finalColumnRoles;

    // Create dataset record in database
    const companyId = req.user.company_id; // Use authenticated user's company
    const createdBy = req.user.id; // Use authenticated user's ID

    // For setup wizard, we don't create divisions/clusters automatically
    // They will be created when the user completes the setup
    let divisionId = null;
    let clusterId = null;

    // Extract summary information
    const skuList = Array.from(new Set(transformedData.map(row => row['Material Code']).filter(Boolean)));
    const skuCount = skuList.length;

    // Ensure all SKUs exist in the skus table
    // For setup wizard, we'll create SKUs without division_id initially
    // The division_id will be set when the user completes the setup
    for (const skuCode of skuList) {
      await pgPool.query(
        'INSERT INTO skus (company_id, sku_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [companyId, skuCode]
      );
    }
    logger.info(`[process-manual-import] Ensured ${skuCount} SKUs exist in database`);

    const dateList = transformedData.map(row => row['Date']).filter(Boolean);
    const uniqueDates = Array.from(new Set(dateList)).sort();
    let dateRange = ["N/A", "N/A"];
    if (uniqueDates.length > 0) {
      dateRange = [uniqueDates[0], uniqueDates[uniqueDates.length - 1]];
    }
    const totalPeriods = uniqueDates.length;
    const frequency = inferDateFrequency(uniqueDates);
    logger.info('[process-manual-import] Inferred frequency:', frequency, 'from dates:', uniqueDates);
    const datasetName = `Dataset ${new Date().toISOString().slice(0,10)} - From ${dateRange[0]} to ${dateRange[1]} (${skuCount} products)`;

    // Auto-update global frequency setting if enabled
    try {
      const autoDetectResult = await pgPool.query(`
        SELECT value FROM user_settings WHERE company_id = $1 AND user_id = $2 AND key = $3
      `, [companyId, createdBy, 'global_autoDetectFrequency']);
      
      if (autoDetectResult.rows.length > 0) {
        const autoDetectEnabled = JSON.parse(autoDetectResult.rows[0].value);
        if (autoDetectEnabled) {
          const seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);
          
          // Update frequency setting
          await pgPool.query(`
            INSERT INTO user_settings (company_id, user_id, key, value, updated_at) 
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (company_id, user_id, key) 
            DO UPDATE SET value = $4, updated_at = CURRENT_TIMESTAMP
          `, [companyId, createdBy, 'global_frequency', frequency]);
          
          // Update seasonal periods setting
          await pgPool.query(`
            INSERT INTO user_settings (company_id, user_id, key, value, updated_at) 
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (company_id, user_id, key) 
            DO UPDATE SET value = $4, updated_at = CURRENT_TIMESTAMP
          `, [companyId, createdBy, 'global_seasonalPeriods', seasonalPeriods.toString()]);
          
          logger.info('Auto-updated frequency settings:', { frequency, seasonalPeriods });
        }
      }
    } catch (e) {
      logger.error('Error updating auto-detected frequency settings:', e);
    }

    const metadata = {
      columns: columns,
      columnRoles: columnRoles,
      source: 'manual-import',
      summary: {
        skuCount,
        dateRange,
        totalPeriods,
        frequency,
      },
      csvHash: csvHash
    };

    const datasetId = await createDataset(
      companyId,
      divisionId,
      clusterId,
      datasetName,
      `uploads/${csvFileName}`, // Store path to original audit file
      createdBy,
      metadata
    );

    // Convert transformed data to time series format and insert into database
    const timeSeriesRows = transformedData.map(row => {
      // Ensure date is in YYYY-MM-DD format for PostgreSQL
      let formattedDate = row['Date'];
      if (typeof formattedDate === 'string') {
        // Try to parse and format the date
        const parsedDate = new Date(formattedDate);
        if (!isNaN(parsedDate.getTime())) {
          formattedDate = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        }
      }
      
      return {
        sku_code: row['Material Code'],
        date: formattedDate,
        value: parseFloat(row['Sales']) || 0
      };
    }).filter(row => row.sku_code && row.date && !isNaN(row.value));

    await insertTimeSeriesData(datasetId, timeSeriesRows, companyId);

    logger.info(`Inserted ${timeSeriesRows.length} time series rows for dataset ${datasetId}`);

    const result = {
      success: true,
      datasetId: datasetId,
      summary: {
        skuCount: skuCount,
        dateRange,
        totalPeriods: totalPeriods,
        frequency,
      },
      skuList: skuList,
      columns: columns,
      previewData: transformedData.slice(0, 10),
      columnRoles: columnRoles
    };

    logger.info('Manual import processed successfully:', {
      datasetId: result.datasetId,
      skuCount: result.summary.skuCount,
      totalPeriods: result.summary.totalPeriods
    });

    res.json(result);
  } catch (error) {
    logger.error('Error processing manual import:', error);
    sendError(res, 500, 'An unexpected error occurred during manual processing', { 
      details: error.message, 
      stack: error.stack 
    });
  }
});

/**
 * Load cleaning metadata endpoint
 * @route GET /load-cleaning-metadata
 * @returns {object} Cleaning metadata
 */
router.get('/load-cleaning-metadata', authenticateToken, async (req, res) => {
  try {
    const { datasetId } = req.query;

    logger.info(`[load-cleaning-metadata] Received request with datasetId: ${datasetId}`);

    if (!datasetId) {
      return sendError(res, 400, 'Missing datasetId parameter', {
        details: 'datasetId is required to load cleaning metadata'
      });
    }

    const datasetIdNum = validateDatasetId(datasetId);
    logger.info(`[load-cleaning-metadata] Using dataset ID: ${datasetIdNum}`);

    // Query the dataset metadata from database
    const query = `
      SELECT metadata
      FROM datasets
      WHERE id = $1 AND company_id = $2
    `;

    const result = await pgPool.query(query, [datasetIdNum, req.user.company_id]);

    if (result.rows.length === 0) {
      logger.warn(`[load-cleaning-metadata] Dataset not found: ${datasetIdNum}`);
      return sendError(res, 404, 'Dataset not found', {
        details: `Dataset with ID ${datasetIdNum} not found`
      });
    }

    const metadata = result.rows[0].metadata;
    logger.info(`[load-cleaning-metadata] Successfully loaded metadata for dataset: ${datasetIdNum}`);

    res.json({
      success: true,
      metadata: metadata
    });
  } catch (error) {
    logger.error('Error loading cleaning metadata:', error);
    sendError(res, 500, 'An unexpected error occurred while loading cleaning metadata', { 
      details: error.message, 
      stack: error.stack 
    });
  }
});

// Generate optimization hash for job deduplication
function generateOptimizationHash(sku, modelId, method, datasetId, parameters = {}, metricWeights = null) {
  // Get default metric weights if not provided
  if (!metricWeights) {
    metricWeights = { mape: 0.4, rmse: 0.3, mae: 0.2, accuracy: 0.1 };
  }
  
  // Create hash input object
  // Note: seasonalPeriod is already included in parameters for seasonal models
  const hashInput = {
    sku,
    modelId,
    method,
    datasetId, // Using datasetId as data identifier
    parameters: parameters || {},
    metricWeights
  };
  
  // Generate SHA-256 hash using js-sha256 for consistency with frontend
  return sha256(JSON.stringify(hashInput));
}

// Check if a job with the same optimization hash already exists
async function checkExistingOptimizationJob(optimizationHash, userId = 1) {
  try {
    const result = await pgPool.query(
      'SELECT id, status FROM optimization_jobs WHERE optimization_hash = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
      [optimizationHash, userId]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error checking existing optimization job:', err);
    throw err;
  }
}

// Check for existing optimization results by hash
async function checkExistingOptimizationResults(optimizationHash, companyId) {
  try {
    const result = await pgPool.query(
      `SELECT * FROM optimization_results 
       WHERE optimization_hash = $1 AND company_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [optimizationHash, companyId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error checking existing optimization results:', err);
    throw err;
  }
}

// Store optimization results
async function storeOptimizationResults(jobId, optimizationHash, modelId, method, parameters, scores, forecasts, companyId) {
  try {
    const result = await pgPool.query(
      `INSERT INTO optimization_results 
       (job_id, optimization_hash, model_id, method, parameters, scores, forecasts, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [jobId, optimizationHash, modelId, method, parameters, scores, forecasts, companyId]
    );
    return result.rows[0].id;
  } catch (err) {
    console.error('Error storing optimization results:', err);
    throw err;
  }
}

// Create optimization job with result caching
async function createOptimizationJobWithResultCache(jobData) {
  const optimizationHash = generateOptimizationHash(
    jobData.sku,
    jobData.modelId,
    jobData.method,
    jobData.datasetId,
    jobData.parameters,
    jobData.metricWeights
  );
  
  // Check for existing results
  const existingResult = await checkExistingOptimizationResults(optimizationHash, jobData.companyId);
  
  if (existingResult) {
    // Reuse existing results
    console.log(`[Cache] Reusing existing optimization results for hash: ${optimizationHash}`);
    
    // Create job that references existing results
    const jobResult = await pgPool.query(
      `INSERT INTO optimization_jobs 
       (company_id, user_id, sku, dataset_id, method, payload, reason, batch_id, 
        status, optimization_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [jobData.companyId, jobData.userId, jobData.sku, jobData.datasetId,
       jobData.method, jobData.payload, jobData.reason, jobData.batchId,
       'completed', optimizationHash]
    );
    
    // Link the job to existing results
    await pgPool.query(
      `UPDATE optimization_results 
       SET job_id = $1 
       WHERE id = $2`,
      [jobResult.rows[0].id, existingResult.id]
    );
    
    return {
      jobId: jobResult.rows[0].id,
      cached: true,
      resultId: existingResult.id
    };
  } else {
    // Create new job for optimization
    const jobResult = await pgPool.query(
      `INSERT INTO optimization_jobs 
       (company_id, user_id, sku, dataset_id, method, payload, reason, batch_id, 
        status, optimization_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [jobData.companyId, jobData.userId, jobData.sku, jobData.datasetId,
       jobData.method, jobData.payload, jobData.reason, jobData.batchId,
       'pending', optimizationHash]
    );
    
    return {
      jobId: jobResult.rows[0].id,
      cached: false
    };
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
  
  // Generate SHA-256 hash using js-sha256 for consistency
  return sha256(JSON.stringify(hashInput));
}

// Check if a forecast with the same hash already exists
async function checkExistingForecast(forecastHash) {
  try {
    const result = await pgPool.query(
      'SELECT id, is_final_forecast, generated_at FROM forecasts WHERE company_id = 1 AND forecast_hash = $1 ORDER BY generated_at DESC LIMIT 1',
      [forecastHash]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error checking existing forecast:', err);
    throw err;
  }
}

// Check if a final forecast already exists for a company/datasetId/SKU combination
async function checkExistingFinalForecast(companyId, datasetId, sku) {
  try {
    const result = await pgPool.query(
      'SELECT id, model_id, method, periods, generated_at FROM forecasts WHERE company_id = $1 AND dataset_id = $2 AND sku_id = (SELECT id FROM skus WHERE company_id = $1 AND sku_code = $3) AND is_final_forecast = true',
      [companyId, datasetId, sku]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error checking existing final forecast:', err);
    throw err;
  }
}

// =====================================================
// OPTIMIZATION RESULTS API ENDPOINTS
// =====================================================

// Get optimization results by hash
router.get('/optimization-results/:hash', authenticateToken, async (req, res) => {
  try {
    const { hash } = req.params;
    const companyId = req.user.company_id;
    
    const result = await pgPool.query(
      `SELECT * FROM optimization_results 
       WHERE optimization_hash = $1 AND company_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [hash, companyId]
    );
    
    if (result.rows.length === 0) {
      return sendError(res, 404, 'Optimization results not found');
    }
    
    res.json({
      success: true,
      result: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Error fetching optimization results:', error);
    sendError(res, 500, 'Failed to fetch optimization results');
  }
});

// Get all results for a job
router.get('/jobs/:jobId/results', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const results = await pgPool.query(
      `SELECT * FROM optimization_results 
       WHERE job_id = $1
       ORDER BY created_at DESC`,
      [jobId]
    );
    
    res.json({
      success: true,
      results: results.rows
    });
    
  } catch (error) {
    logger.error('Error fetching job results:', error);
    sendError(res, 500, 'Failed to fetch job results');
  }
});

// Create optimization job with caching
router.post('/jobs/create-with-cache', authenticateToken, async (req, res) => {
  try {
    const jobData = req.body;
    
    // Validate required fields
    if (!jobData.sku || !jobData.modelId || !jobData.method || !jobData.datasetId) {
      return sendError(res, 400, 'Missing required fields: sku, modelId, method, datasetId');
    }
    
    // Set defaults
    jobData.companyId = jobData.companyId || req.user.company_id;
    jobData.userId = jobData.userId || req.user.id;
    jobData.batchId = jobData.batchId || `batch_${Date.now()}`;
    jobData.reason = jobData.reason || 'manual_optimization';
    
    const result = await createOptimizationJobWithResultCache(jobData);
    
    res.json({
      success: true,
      jobId: result.jobId,
      cached: result.cached,
      message: result.cached ? 'Using cached optimization result' : 'Created new optimization job'
    });
    
  } catch (error) {
    logger.error('Error creating optimization job with cache:', error);
    sendError(res, 500, 'Failed to create optimization job');
  }
});

// Get cache statistics
router.get('/jobs/cache-stats', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    
    const stats = await pgPool.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(DISTINCT optimization_hash) as unique_optimizations,
        COUNT(*) - COUNT(DISTINCT optimization_hash) as cache_hits,
        ROUND(
          (COUNT(*) - COUNT(DISTINCT optimization_hash))::numeric / NULLIF(COUNT(*), 0) * 100, 2
        ) as cache_hit_percentage
      FROM optimization_jobs 
      WHERE status = 'completed' AND company_id = $1
    `, [companyId]);
    
    // Get optimization results stats
    const resultsStats = await pgPool.query(`
      SELECT 
        COUNT(*) as total_results,
        COUNT(DISTINCT optimization_hash) as unique_result_hashes
      FROM optimization_results 
      WHERE company_id = $1
    `, [companyId]);
    
    res.json({
      success: true,
      stats: {
        ...stats.rows[0],
        ...resultsStats.rows[0]
      }
    });
    
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    sendError(res, 500, 'Failed to get cache statistics');
  }
});

// Store optimization results (for worker to use)
router.post('/optimization-results/store', authenticateToken, async (req, res) => {
  try {
    const { jobId, optimizationHash, modelId, method, parameters, scores, forecasts } = req.body;
    const companyId = req.user.company_id;
    
    if (!jobId || !optimizationHash || !modelId || !method) {
      return sendError(res, 400, 'Missing required fields: jobId, optimizationHash, modelId, method');
    }
    
    const resultId = await storeOptimizationResults(
      jobId, optimizationHash, modelId, method, parameters, scores, forecasts, companyId
    );
    
    res.json({
      success: true,
      resultId: resultId,
      message: 'Optimization results stored successfully'
    });
    
  } catch (error) {
    logger.error('Error storing optimization results:', error);
    sendError(res, 500, 'Failed to store optimization results');
  }
});

// =====================================================
// DATASET MANAGEMENT API ENDPOINTS
// =====================================================

// Endpoint to delete a dataset and all its associated data
router.delete('/datasets/:datasetId', authenticateToken, async (req, res) => {
  try {
    const { datasetId } = req.params;
    const id = parseInt(datasetId);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid dataset ID' });
    }

    console.log(`[DELETE] Deleting dataset ID: ${id}`);

    // Start a transaction to ensure data consistency
    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');
      
      // First, get dataset information for better logging and response
      const datasetInfo = await client.query(
        'SELECT name, file_path, metadata FROM datasets WHERE company_id = $1 AND id = $2',
        [req.user.company_id, id]
      );
      
      if (datasetInfo.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Dataset not found' });
      }
      
      const dataset = datasetInfo.rows[0];
      const datasetName = dataset.name || (dataset.file_path ? path.basename(dataset.file_path) : `Dataset ${id}`);
      const skuCount = dataset.metadata?.summary?.skuCount || 'Unknown';
      
      console.log(`[DELETE] Deleting dataset: "${datasetName}" (ID: ${id})`);
      
      // Delete time series data first (foreign key constraint)
      const timeSeriesResult = await client.query(
        'DELETE FROM time_series_data WHERE company_id = $1 AND dataset_id = $2',
        [req.user.company_id, id]
      );
      console.log(`[DELETE] Deleted ${timeSeriesResult.rowCount} time series records`);
      
      // Delete jobs associated with this dataset
      const jobsResult = await client.query(
        'DELETE FROM optimization_jobs WHERE dataset_id = $1',
        [id]
      );
      console.log(`[DELETE] Deleted ${jobsResult.rowCount} job records`);
      
      // Finally delete the dataset
      const datasetResult = await client.query(
        'DELETE FROM datasets WHERE company_id = $1 AND id = $2',
        [req.user.company_id, id]
      );
      
      await client.query('COMMIT');
      
      console.log(`[DELETE] Successfully deleted dataset: "${datasetName}" (ID: ${id})`);
      res.json({ 
        success: true, 
        message: `Dataset "${datasetName}" deleted successfully`,
        datasetInfo: {
          id: id,
          name: datasetName,
          filename: dataset.file_path ? path.basename(dataset.file_path) : null,
          skuCount: skuCount
        },
        deletedTimeSeriesRecords: timeSeriesResult.rowCount,
        deletedJobRecords: jobsResult.rowCount
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting dataset:', error);
    res.status(500).json({ error: 'Failed to delete dataset', details: error.message });
  }
});

// Endpoint to rename a dataset
router.post('/datasets/:id/rename', authenticateToken, async (req, res) => {
  const datasetId = parseInt(req.params.id, 10);
  const { name } = req.body;
  
  if (!datasetId || !name) {
    return res.status(400).json({ error: 'datasetId and name are required' });
  }
  
  try {
    await pgPool.query('UPDATE datasets SET name = $1 WHERE id = $2 AND company_id = $3', [name, datasetId, req.user.company_id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error renaming dataset:', error);
    res.status(500).json({ error: 'Failed to rename dataset', details: error.message });
  }
});

// Endpoint to update dataset frequency
router.post('/update-dataset-frequency', authenticateToken, async (req, res) => {
  const { datasetId, frequency } = req.body;
  
  if (!datasetId || !frequency) {
    return res.status(400).json({ error: 'Missing datasetId or frequency' });
  }
  
  try {
    // Update dataset metadata with new frequency
    const updateQuery = `
      UPDATE datasets 
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb), 
        '{summary,frequency}', 
        $1::jsonb
      )
      WHERE id = $2 AND company_id = $3
    `;

    const result = await pgPool.query(updateQuery, [JSON.stringify(frequency), datasetId, req.user.company_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    res.json({ success: true, frequency });
  } catch (err) {
    console.error('Error updating frequency:', err);
    res.status(500).json({ error: 'Failed to update frequency' });
  }
});

// Endpoint to auto-detect dataset frequency
router.post('/auto-detect-dataset-frequency', authenticateToken, async (req, res) => {
  const { datasetId } = req.body;
  
  if (!datasetId) {
    return res.status(400).json({ error: 'Missing datasetId' });
  }
  
  try {
    // Get time series data from database
    const timeSeriesData = await getTimeSeriesData(datasetId);
    if (!timeSeriesData || timeSeriesData.length === 0) {
      return res.status(404).json({ error: 'No time series data found for dataset' });
    }

    // Extract dates and infer frequency
    const dateList = timeSeriesData.map(row => row.date).filter(Boolean);
    const uniqueDates = Array.from(new Set(dateList)).sort();
    const frequency = inferDateFrequency(uniqueDates);

    // Update dataset metadata with new frequency
    const updateQuery = `
      UPDATE datasets 
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb), 
        '{summary,frequency}', 
        $1::jsonb
      )
      WHERE id = $2 AND company_id = $3
    `;

    await pgPool.query(updateQuery, [JSON.stringify(frequency), datasetId, req.user.company_id]);

    res.json({ success: true, frequency });
  } catch (err) {
    console.error('Error auto-detecting frequency:', err);
    res.status(500).json({ error: 'Failed to auto-detect frequency' });
  }
});

/**
 * Generate preview of CSV data with column role detection
 * @route POST /generate-preview
 * @returns {object} Preview data with column roles and processed headers
 */
router.post('/generate-preview', (req, res) => {
  try {
    const { csvData, transposed, separator: requestedSeparator, dateFormat: requestedDateFormat, numberFormat: requestedNumberFormat } = req.body;
    
    // Debug: Log received config and first few lines of CSV
    console.log('[generate-preview] Received:', {
      separator: requestedSeparator,
      dateFormat: requestedDateFormat,
      numberFormat: requestedNumberFormat,
      transposed: transposed
    });
    if (csvData) {
      console.log('[generate-preview] First 5 lines of CSV:', csvData.split('\n').slice(0, 5));
    }

    // Use the new robust parser with the requested separator
    let { data, headers, separator } = parseCsvWithHeaders(csvData, requestedSeparator);

    // Debug: Log detected headers
    console.log('[generate-preview] Detected headers:', headers);

    if (transposed) {
      const transposedResult = transposeData(data, headers);
      data = transposedResult.data;
      headers = transposedResult.headers;
    }

    // Get column roles as objects first, passing the date format
    const columnRolesObjects = detectColumnRoles(headers, requestedDateFormat);
    // Extract just the role strings for the frontend
    const columnRoles = columnRolesObjects.map(obj => obj.role);

    // Debug: Log detected column roles
    console.log('[generate-preview] Detected column roles:', columnRoles);
    console.log('[generate-preview] Headers:', headers);

    // Process preview data to show how dates would be interpreted with the selected format
    // Limit to 15 rows for preview to avoid overwhelming the UI
    const processedPreviewRows = data.slice(0, 15).map((row, rowIdx) => {
      const processedRow = {};
      headers.forEach((header, index) => {
        const value = row[header];
        const role = columnRoles[index];

        if (role === 'Date') {
          // For date columns, validate the cell value (sales numbers) against number format
          if (value === '' || value === null || value === undefined) {
            // Empty cells are valid - they represent no sales
            processedRow[header] = 0;
          } else {
            const parsedNumber = parseNumberWithFormat(value, requestedNumberFormat);
            if (!isNaN(parsedNumber)) {
              processedRow[header] = parsedNumber;
            } else {
              processedRow[header] = `❌ Invalid (${requestedNumberFormat})`;
            }
          }
        } else if (role === 'Material Code' || role === 'Description') {
          // For Material Code and Description columns, show original value
          processedRow[header] = value;
        } else if (role === 'Lifecycle Phase' || role === 'Division' || role === 'Cluster') {
          // For Lifecycle Phase, Division, and Cluster columns, preserve as text (don't parse as number)
          processedRow[header] = value;
        } else if (role === header) {
          // For columns that are mapped as their own name (text fields like "Marca")
          // Show the original value
          processedRow[header] = value;
        } else {
          // For other columns (aggregatable fields), try to parse as number
          if (value === '' || value === null || value === undefined) {
            // Empty cells are valid - they represent no sales
            processedRow[header] = 0;
          } else {
            const parsedNumber = parseNumberWithFormat(value, requestedNumberFormat);
            if (!isNaN(parsedNumber)) {
              processedRow[header] = parsedNumber;
            } else {
              processedRow[header] = `❌ Invalid (${requestedNumberFormat})`;
            }
          }
        }
      });
      return processedRow;
    });

    // Filter out rows where all sales values are zero or empty
    const filteredPreviewRows = processedPreviewRows.filter(row => {
      // Check if this row has any non-zero sales values across all date columns
      let hasNonZeroSales = false;
      headers.forEach((header, index) => {
        const role = columnRoles[index];
        if (role === 'Date') {
          const salesValue = row[header];
          if (salesValue !== 0 && salesValue !== '' && salesValue !== null && salesValue !== undefined) {
            hasNonZeroSales = true;
          }
        }
      });
      return hasNonZeroSales;
    });

    // Create processed headers array to show invalid date formats in headers
    // This is only for display - the data structure keeps original header names
    const processedHeaders = headers.map((header, index) => {
      const role = columnRoles[index];
      if (role === 'Date') {
        const isHeaderValid = parseDateWithFormat(header, requestedDateFormat) !== null;
        if (!isHeaderValid) {
          return `❌ Invalid (${requestedDateFormat})`;
        }
      }
      return header;
    });

    res.json({
      headers: processedHeaders.slice(0, 50),
      originalHeaders: headers.slice(0, 50), // Add original headers for data access
      previewRows: filteredPreviewRows,
      columnRoles,
      separator,
      transposed: !!transposed,
      dateFormat: requestedDateFormat,
      numberFormat: requestedNumberFormat
    });

    // Debug: Log what we're sending back
    console.log('[generate-preview] Sending response with processed data:');
    console.log('[generate-preview] First row preview data:', filteredPreviewRows[0]);
    console.log('[generate-preview] Date columns in first row:', Object.keys(filteredPreviewRows[0]).filter(key => 
      columnRoles[processedHeaders.indexOf(key)] === 'Date'
    ).map(key => `${key}: ${filteredPreviewRows[0][key]}`));
  } catch (error) {
    console.error('Error in generate-preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// MODEL MANAGEMENT API ENDPOINTS
// =====================================================

// Get available models with data requirements
router.get('/models', (req, res) => {
  try {
    const seasonalPeriod = req.query.seasonalPeriod ? parseInt(req.query.seasonalPeriod) : 12;
    const models = modelFactory.getAllModelInfo();
    
    // Add data requirements to each model
    const requirements = modelFactory.getModelDataRequirements(seasonalPeriod);
    const enhancedModels = models.map(model => ({
      ...model,
      dataRequirements: requirements[model.id] || {
        minObservations: 5,
        description: 'Requires at least 5 observations',
        isSeasonal: false
      }
    }));

    res.json(enhancedModels);
  } catch (error) {
    console.error('[API] Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Get model data requirements
router.get('/models/data-requirements', (req, res) => {
  try {
    const seasonalPeriod = req.query.seasonalPeriod ? parseInt(req.query.seasonalPeriod) : 12;
    const requirements = modelFactory.getModelDataRequirements(seasonalPeriod);
    res.json(requirements);
  } catch (error) {
    console.error('[API] Error fetching model data requirements:', error);
    res.status(500).json({ error: 'Failed to fetch model data requirements' });
  }
});

// Check model compatibility with data
router.post('/models/check-compatibility', (req, res) => {
  try {
    const { modelTypes, dataLength, seasonalPeriod = 12 } = req.body;
    
    if (!modelTypes || !Array.isArray(modelTypes)) {
      return res.status(400).json({ error: 'modelTypes must be an array' });
    }

    if (typeof dataLength !== 'number' || dataLength < 0) {
      return res.status(400).json({ error: 'dataLength must be a non-negative number' });
    }

    const compatibility = {
      dataLength,
      seasonalPeriod,
      compatibleModels: [],
      incompatibleModels: [],
      totalModels: modelTypes.length
    };

    for (const modelType of modelTypes) {
      const isCompatible = modelFactory.isModelCompatible(modelType, dataLength, seasonalPeriod);
      const requirements = modelFactory.getModelDataRequirements(seasonalPeriod)[modelType];
      
      if (isCompatible) {
        compatibility.compatibleModels.push({
          modelType,
          requirements
        });
      } else {
        compatibility.incompatibleModels.push({
          modelType,
          requirements,
          reason: requirements ? 
            `Requires at least ${requirements.minObservations} observations (you have ${dataLength})` :
            `Requires at least 5 observations (you have ${dataLength})`
        });
      }
    }

    compatibility.compatibleCount = compatibility.compatibleModels.length;
    compatibility.incompatibleCount = compatibility.incompatibleModels.length;

    res.json(compatibility);
  } catch (error) {
    console.error('[API] Error checking model compatibility:', error);
    res.status(500).json({ error: 'Failed to check model compatibility' });
  }
});

// =====================================================
// HIERARCHY MANAGEMENT API ENDPOINTS
// =====================================================

// Get divisions for a company
router.get('/divisions', async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId) || 1; // Default to company 1 for now
    const divisions = await getDivisions(companyId);
    res.json(divisions);
  } catch (error) {
    console.error('[API] Error fetching divisions:', error);
    res.status(500).json({ error: 'Failed to fetch divisions' });
  }
});

// Get clusters for a company/division
router.get('/clusters', async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId) || 1;
    const divisionId = req.query.divisionId ? parseInt(req.query.divisionId) : null;
    const clusters = await getClusters(companyId, divisionId);
    res.json(clusters);
  } catch (error) {
    console.error('[API] Error fetching clusters:', error);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// Get S&OP cycles for a company/division
router.get('/sop-cycles', async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId) || 1;
    const divisionId = req.query.divisionId ? parseInt(req.query.divisionId) : null;
    const cycles = await getSopCycles(companyId, divisionId);
    res.json(cycles);
  } catch (error) {
    console.error('[API] Error fetching S&OP cycles:', error);
    res.status(500).json({ error: 'Failed to fetch S&OP cycles' });
  }
});

// Get user roles and permissions
router.get('/user-roles', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || 1;
    const companyId = parseInt(req.query.companyId) || 1;
    const roles = await getUserRoles(userId, companyId);
    res.json(roles);
  } catch (error) {
    console.error('[API] Error fetching user roles:', error);
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

// Get datasets with hierarchy information
router.get('/datasets', async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId) || 1;
    const divisionId = req.query.divisionId ? parseInt(req.query.divisionId) : null;
    const clusterId = req.query.clusterId ? parseInt(req.query.clusterId) : null;
    // Use the imported getDatasets function
    const datasets = await getDatasets(companyId, divisionId, clusterId);
    res.json(datasets);
  } catch (error) {
    console.error('[API] Error fetching datasets:', error);
    res.status(500).json({ error: 'Failed to fetch datasets' });
  }
});

// Get dataset metadata with hierarchy information
router.get('/datasets/:datasetId', async (req, res) => {
  try {
    const datasetId = validateDatasetId(parseInt(req.params.datasetId));
    const metadata = await getDatasetMetadata(datasetId);
    
    if (!metadata) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    
    res.json(metadata);
  } catch (error) {
    console.error('[API] Error fetching dataset metadata:', error);
    res.status(500).json({ error: 'Failed to fetch dataset metadata' });
  }
});

// =====================================================
// SETUP WIZARD API ENDPOINTS
// =====================================================

// Check if setup is required
router.get('/setup/status', async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId) || 1;
    
    console.log(`[SETUP STATUS] Checking setup status for companyId: ${companyId}`);
    
    // Get company details including the new setup_wizard_accessible flag
    const companyResult = await pgPool.query(
      'SELECT setup_completed, setup_wizard_accessible FROM companies WHERE id = $1',
      [companyId]
    );
    
    if (companyResult.rows.length === 0) {
      console.log(`[SETUP STATUS] Company not found for id: ${companyId}`);
      return res.status(404).json({ error: 'Company not found' });
    }
    
    const company = companyResult.rows[0];
    
    console.log(`[SETUP STATUS] Company found:`);
    console.log(`  - setup_completed: ${company.setup_completed}`);
    console.log(`  - setup_wizard_accessible: ${company.setup_wizard_accessible}`);
    
    // Check if we have more than just the default division/cluster
    const divisionsResult = await pgPool.query(
      'SELECT COUNT(*) as count FROM divisions WHERE company_id = $1',
      [companyId]
    );
    
    const clustersResult = await pgPool.query(
      'SELECT COUNT(*) as count FROM clusters WHERE company_id = $1',
      [companyId]
    );
    
    const datasetsResult = await pgPool.query(
      'SELECT COUNT(*) as count FROM datasets WHERE company_id = $1',
      [companyId]
    );
    
    // Use setup_completed flag for initial setup status
    // Use setup_wizard_accessible flag for admin access control
   
    const hasDatasets = datasetsResult.rows[0].count > 0;
    
    const response = {
      setupRequired: !company.setup_completed,
      setupWizardAccessible: company.setup_wizard_accessible,
      hasDatasets,
      divisionCount: parseInt(divisionsResult.rows[0].count),
      clusterCount: parseInt(clustersResult.rows[0].count),
      datasetCount: parseInt(datasetsResult.rows[0].count)
    };
    
    console.log(`[SETUP STATUS] Response:`);
    console.log(`  - setupRequired: ${response.setupRequired}`);
    console.log(`  - setupWizardAccessible: ${response.setupWizardAccessible}`);
    console.log(`  - divisionCount: ${response.divisionCount}`);
    console.log(`  - clusterCount: ${response.clusterCount}`);
    console.log(`  - datasetCount: ${response.datasetCount}`);
    
    res.json(response);
  } catch (error) {
    console.error('[API] Error checking setup status:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// Create company
router.post('/setup/companies', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      country, 
      website, 
      phone, 
      address, 
      city, 
      state_province, 
      postal_code, 
      company_size, 
      fiscal_year_start, 
      timezone, 
      currency, 
      logo_url, 
      notes 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    
    const result = await pgPool.query(
      `INSERT INTO companies (
        name, description, country, website, phone, 
        address, city, state_province, postal_code, company_size, 
        fiscal_year_start, timezone, currency, logo_url, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING id, name, description, country, website, phone, 
        address, city, state_province, postal_code, company_size, 
        fiscal_year_start, timezone, currency, logo_url, notes`,
      [
        name, description || null, country || null, 
        website || null, phone || null, address || null, city || null, 
        state_province || null, postal_code || null, company_size || null, 
        fiscal_year_start || null, timezone || 'UTC', currency || 'USD', 
        logo_url || null, notes || null
      ]
    );
    
    res.json({
      success: true,
      company: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Get companies
router.get('/companies', async (req, res) => {
  try {
    const result = await pgPool.query(
      `SELECT id, name, description, country, website, phone, 
        address, city, state_province, postal_code, company_size, 
        fiscal_year_start, timezone, currency, logo_url, notes, 
        created_at, updated_at 
       FROM companies ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[API] Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Create division
router.post('/setup/divisions', authenticateToken, async (req, res) => {
  try {
          const { name, description, industry } = req.body;
      const companyId = req.user.company_id;
    
    if (!name) {
      return res.status(400).json({ error: 'Division name is required' });
    }
    
    const result = await pgPool.query(
      'INSERT INTO divisions (company_id, name, description, industry, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id, name, description, industry, is_active',
      [companyId, name, description || null, industry || null]
    );
    
    res.json({
      success: true,
      division: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error creating division:', error);
    res.status(500).json({ error: 'Failed to create division' });
  }
});

// Update division
router.put('/setup/divisions/:id', async (req, res) => {
  try {
    const divisionId = parseInt(req.params.id);
    const { name, description, industry } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Division name is required' });
    }
    
    const result = await pgPool.query(
      'UPDATE divisions SET name = $1, description = $2, industry = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING id, name, description, industry',
      [name, description || null, industry || null, divisionId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Division not found' });
    }
    
    res.json({
      success: true,
      division: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error updating division:', error);
    res.status(500).json({ error: 'Failed to update division' });
  }
});

// Create cluster
router.post('/setup/clusters', authenticateToken, async (req, res) => {
  try {
          const { divisionId, name, description, countryCode, region } = req.body;
      const companyId = req.user.company_id;
    
    if (!name || !divisionId) {
      return res.status(400).json({ error: 'Cluster name and division ID are required' });
    }
    
    const result = await pgPool.query(
      'INSERT INTO clusters (company_id, division_id, name, description, country_code, region, is_active) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, name, description, country_code, region, is_active',
      [companyId, divisionId, name, description || null, countryCode || null, region || null]
    );
    
    res.json({
      success: true,
      cluster: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error creating cluster:', error);
    res.status(500).json({ error: 'Failed to create cluster' });
  }
});

// Update cluster
router.put('/setup/clusters/:id', async (req, res) => {
  try {
    const clusterId = parseInt(req.params.id);
    const { name, description, countryCode, region } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Cluster name is required' });
    }
    
    const result = await pgPool.query(
      'UPDATE clusters SET name = $1, description = $2, country_code = $3, region = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id, name, description, country_code, region',
      [name, description || null, countryCode || null, region || null, clusterId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cluster not found' });
    }
    
    res.json({
      success: true,
      cluster: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error updating cluster:', error);
    res.status(500).json({ error: 'Failed to update cluster' });
  }
});

// Create S&OP cycle
router.post('/setup/sop-cycles', authenticateToken, async (req, res) => {
  try {
          const { divisionId, name, description, startDate, endDate } = req.body;
      const companyId = req.user.company_id;
    
    if (!name || !divisionId) {
      return res.status(400).json({ error: 'S&OP cycle name and division ID are required' });
    }
    
    const result = await pgPool.query(
      'INSERT INTO sop_cycles (company_id, division_id, name, description, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, description, start_date, end_date',
      [companyId, divisionId, name, description || null, startDate || null, endDate || null]
    );
    
    res.json({
      success: true,
      sopCycle: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error creating S&OP cycle:', error);
    res.status(500).json({ error: 'Failed to create S&OP cycle' });
  }
});

// Complete setup
router.post('/setup/complete', authenticateToken, async (req, res) => {
  try {
          const companyId = req.user.company_id;
    
    // Mark setup as complete in the companies table
    const result = await pgPool.query(
      'UPDATE companies SET setup_completed = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, name, setup_completed',
      [companyId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json({
      success: true,
      message: 'Setup completed successfully',
      company: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error completing setup:', error);
    res.status(500).json({ error: 'Failed to complete setup' });
  }
});

// Create divisions from CSV (silent creation for setup wizard)
router.post('/setup/csv/create-divisions', authenticateToken, async (req, res) => {
  try {
    const { companyId, divisionNames } = req.body;
    const userId = req.user.id;
    
    if (!companyId || !divisionNames || !Array.isArray(divisionNames)) {
      return res.status(400).json({ error: 'Company ID and division names array are required' });
    }
    
    const createdDivisions = [];
    
    for (const divisionName of divisionNames) {
      if (divisionName && divisionName.trim()) {
        try {
          const result = await pgPool.query(
            'INSERT INTO divisions (company_id, name, description, created_by, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id, name',
            [companyId, divisionName.trim(), `Division created from CSV import`, userId]
          );
          createdDivisions.push(result.rows[0]);
        } catch (error) {
          // If division already exists, skip it
          if (error.code === '23505') { // Unique constraint violation
            console.log(`Division "${divisionName}" already exists, skipping`);
            continue;
          }
          throw error;
        }
      }
    }
    
    res.json({
      success: true,
      message: `Created ${createdDivisions.length} divisions`,
      divisions: createdDivisions
    });
  } catch (error) {
    console.error('[API] Error creating divisions from CSV:', error);
    res.status(500).json({ error: 'Failed to create divisions from CSV' });
  }
});

// Create clusters from CSV (silent creation for setup wizard)
router.post('/setup/csv/create-clusters', authenticateToken, async (req, res) => {
  try {
    const { companyId, divisionNames, clusterNames } = req.body;
    const userId = req.user.id;
    
    if (!companyId || !clusterNames || !Array.isArray(clusterNames)) {
      return res.status(400).json({ error: 'Company ID and cluster names array are required' });
    }
    
    const createdClusters = [];
    
    // Handle different scenarios based on whether division names are provided
    if (divisionNames && Array.isArray(divisionNames) && divisionNames.length > 0) {
      // Scenario 1: Division names provided - create clusters for specific divisions
      const divisionsResult = await pgPool.query(
        'SELECT id, name FROM divisions WHERE company_id = $1 AND name = ANY($2)',
        [companyId, divisionNames]
      );
      const divisions = divisionsResult.rows;
      
              // Create clusters for each matching division
      for (const division of divisions) {
        for (const clusterName of clusterNames) {
          if (clusterName && clusterName.trim()) {
            try {
              const result = await pgPool.query(
                'INSERT INTO clusters (company_id, division_id, name, description, created_by, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, name, division_id',
                [companyId, division.id, clusterName.trim(), `Cluster created from CSV import`, userId]
              );
              createdClusters.push(result.rows[0]);
            } catch (error) {
              // If cluster already exists for this division, skip it
              if (error.code === '23505') { // Unique constraint violation
                console.log(`Cluster "${clusterName}" already exists for division "${division.name}", skipping`);
                continue;
              }
              throw error;
            }
          }
        }
      }
    } else {
      // Scenario 2: No division names provided - create clusters for all divisions
      // This is for division-level CSV without division column
      const divisionsResult = await pgPool.query(
        'SELECT id, name FROM divisions WHERE company_id = $1',
        [companyId]
      );
      const divisions = divisionsResult.rows;
      
      if (divisions.length === 0) {
        // No divisions exist yet - create a default division first
        const defaultDivisionResult = await pgPool.query(
          'INSERT INTO divisions (company_id, name, description, created_by, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id, name',
          [companyId, 'Default Division', 'Default division created for cluster import', userId]
        );
        divisions.push(defaultDivisionResult.rows[0]);
      }
      
      // Create clusters for each division
      for (const division of divisions) {
        for (const clusterName of clusterNames) {
          if (clusterName && clusterName.trim()) {
            try {
              const result = await pgPool.query(
                'INSERT INTO clusters (company_id, division_id, name, description, created_by, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, name, division_id',
                [companyId, division.id, clusterName.trim(), `Cluster created from CSV import`, userId]
              );
              createdClusters.push(result.rows[0]);
            } catch (error) {
              // If cluster already exists for this division, skip it
              if (error.code === '23505') { // Unique constraint violation
                console.log(`Cluster "${clusterName}" already exists for division "${division.name}", skipping`);
                continue;
              }
              throw error;
            }
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: `Created ${createdClusters.length} clusters`,
      clusters: createdClusters
    });
  } catch (error) {
    console.error('[API] Error creating clusters from CSV:', error);
    res.status(500).json({ error: 'Failed to create clusters from CSV' });
  }
});

/**
 * Get organization structure configuration
 * @route GET /organization-structure-config
 * @returns {object} Organization structure configuration
 */
router.get('/organization-structure-config', authenticateToken, async (req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT value FROM company_settings 
      WHERE company_id = $1 AND key = 'organization_structure_config'
    `, [req.user.company_id]);



    if (result.rows.length === 0) {
      // Return default configuration
      const defaultConfig = {
        hasMultipleDivisions: false,
        hasMultipleClusters: false,
        importLevel: 'company',
        csvUploadType: null,
        divisionCsvType: null,
        setupFlow: {
          skipDivisionStep: false,
          skipClusterStep: false,
          divisionValue: null,
          clusterValue: null,
          requiresCsvUpload: false,
          csvStructure: {
            hasDivisionColumn: false,
            hasClusterColumn: false,
          },
        }
      };

      return res.json({
        status: 'ok',
        config: defaultConfig,
        timestamp: new Date().toISOString()
      });
    }

    // JSONB values are automatically parsed by PostgreSQL, so we can use them directly
    const config = result.rows[0].value;
    
    res.json({
      status: 'ok',
      config: config,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch organization structure configuration', { error: err.message });
  }
});

/**
 * Save organization structure configuration
 * @route POST /organization-structure-config
 * @returns {object} Success response
 */
router.post('/organization-structure-config', authenticateToken, async (req, res) => {
  try {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return sendError(res, 400, 'Invalid configuration data');
    }

    // Validate required fields
    const requiredFields = ['hasMultipleDivisions', 'hasMultipleClusters', 'importLevel'];
    for (const field of requiredFields) {
      if (config[field] === undefined) {
        return sendError(res, 400, `Missing required field: ${field}`);
      }
    }

    // Save to company_settings table
    await pgPool.query(`
      INSERT INTO company_settings (company_id, key, value, updated_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (company_id, key)
      DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP, updated_by = $4
    `, [req.user.company_id, 'organization_structure_config', JSON.stringify(config), req.user.id]);

    res.json({
      status: 'ok',
      message: 'Organization structure configuration saved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to save organization structure configuration', { error: err.message });
  }
});

/**
 * Get S&OP cycle configurations
 * @route GET /sop-cycle-configs
 * @returns {object} List of S&OP cycle configurations
 */
router.get('/sop-cycle-configs', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const divisionId = req.query.divisionId ? parseInt(req.query.divisionId) : null;
    
    let query = `
      SELECT 
        sc.*,
        d.name as division_name
      FROM sop_cycle_configs sc
      LEFT JOIN divisions d ON sc.division_id = d.id
      WHERE sc.company_id = $1
    `;
    const params = [companyId];
    
    if (divisionId) {
      query += ' AND sc.division_id = $2';
      params.push(divisionId);
    }
    
    query += ' ORDER BY sc.created_at DESC';
    
    const result = await pgPool.query(query, params);
    
    res.json({
      status: 'ok',
      configs: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch S&OP cycle configurations', { error: err.message });
  }
});

/**
 * Create S&OP cycle configuration
 * @route POST /sop-cycle-configs
 * @returns {object} Created configuration
 */
router.post('/sop-cycle-configs', authenticateToken, async (req, res) => {
  try {
    const {
      divisionId,
      frequency,
      startDay,
      startMonth,
      cutOffDays,
      description,
      autoGenerate,
      generateFromDate,
      generateCount,
      workingDaysSettings,
      workingDaysConfig
    } = req.body;
    
    const companyId = req.user.company_id;
    const userId = req.user.id;
    
    // Validate required fields
    if (!frequency || !startDay || !generateFromDate) {
      return sendError(res, 400, 'Frequency, start day, and generate from date are required');
    }
    
    // Validate frequency
    if (!['weekly', 'monthly', 'quarterly', 'yearly'].includes(frequency)) {
      return sendError(res, 400, 'Invalid frequency. Must be weekly, monthly, quarterly, or yearly');
    }
    
    // Validate working days settings
    if (workingDaysSettings) {
      if (typeof workingDaysSettings !== 'object') {
        return sendError(res, 400, 'Working days settings must be an object');
      }
      
      if (workingDaysSettings.startDate && typeof workingDaysSettings.startDate.useWorkingDays !== 'boolean') {
        return sendError(res, 400, 'startDate.useWorkingDays must be a boolean');
      }
      
      if (workingDaysSettings.cutOffPeriod && typeof workingDaysSettings.cutOffPeriod.useWorkingDays !== 'boolean') {
        return sendError(res, 400, 'cutOffPeriod.useWorkingDays must be a boolean');
      }
    }
    
    // Validate start day based on frequency
    if (frequency === 'weekly' && (startDay < 1 || startDay > 7)) {
      return sendError(res, 400, 'Start day for weekly cycles must be 1-7 (Monday=1, Sunday=7)');
    }
    if (frequency !== 'weekly' && (startDay < 1 || startDay > 31)) {
      return sendError(res, 400, 'Start day must be 1-31');
    }
    
    // Validate start month for quarterly/yearly
    if ((frequency === 'quarterly' || frequency === 'yearly') && (!startMonth || startMonth < 1 || startMonth > 12)) {
      return sendError(res, 400, 'Start month is required for quarterly and yearly cycles');
    }
    
    // Validate cut-off days based on frequency
    const getMaxCutOffDays = (freq) => {
      switch (freq) {
        case 'weekly':
          return 6; // 7 days - 1 day minimum cycle
        case 'monthly':
          return 27; // 31 days - 4 days minimum cycle (for shortest month)
        case 'quarterly':
          return 88; // 92 days - 4 days minimum cycle
        case 'yearly':
          return 361; // 365 days - 4 days minimum cycle
        default:
          return 30;
      }
    };
    
    const maxCutOffDays = getMaxCutOffDays(frequency);
    if (cutOffDays < 0 || cutOffDays > maxCutOffDays) {
      return sendError(res, 400, `Cut-off days must be 0-${maxCutOffDays} for ${frequency} cycles`);
    }
    
    // Validate working days config if any working days settings are enabled
    const useWorkingDays = workingDaysSettings?.startDate?.useWorkingDays || workingDaysSettings?.cutOffPeriod?.useWorkingDays;
    if (useWorkingDays) {
      if (!workingDaysConfig || typeof workingDaysConfig !== 'object') {
        return sendError(res, 400, 'Working days configuration is required when working days are enabled');
      }
      
      const requiredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const day of requiredDays) {
        if (typeof workingDaysConfig[day] !== 'boolean') {
          return sendError(res, 400, `Working days configuration must include boolean value for ${day}`);
        }
      }
      
      // Validate holidays if provided
      if (workingDaysConfig.holidays && Array.isArray(workingDaysConfig.holidays)) {
        for (const holiday of workingDaysConfig.holidays) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday)) {
            return sendError(res, 400, 'Holiday dates must be in YYYY-MM-DD format');
          }
        }
      }
      
      // Validate holidayObjects if provided
      if (workingDaysConfig.holidayObjects && Array.isArray(workingDaysConfig.holidayObjects)) {
        for (const holiday of workingDaysConfig.holidayObjects) {
          if (!holiday.name || !holiday.startDate || !holiday.endDate) {
            return sendError(res, 400, 'Holiday objects must include name, startDate, and endDate');
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(holiday.endDate)) {
            return sendError(res, 400, 'Holiday dates must be in YYYY-MM-DD format');
          }
        }
      }
    }
    
    // Check for existing configuration with same division and frequency
    const existingResult = await pgPool.query(
      'SELECT id FROM sop_cycle_configs WHERE company_id = $1 AND division_id IS NOT DISTINCT FROM $2 AND frequency = $3',
      [companyId, divisionId || null, frequency]
    );
    
    if (existingResult.rows.length > 0) {
      return sendError(res, 409, 'Configuration already exists for this division and frequency');
    }
    
    // Insert configuration
    const result = await pgPool.query(`
      INSERT INTO sop_cycle_configs (
        company_id, division_id, frequency, start_day, start_month, cut_off_days,
        description, auto_generate, generate_from_date, generate_count, 
        working_days_settings, working_days_config, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      companyId, divisionId || null, frequency, startDay, startMonth || null,
      cutOffDays || 3, description || null, autoGenerate !== false,
      generateFromDate, generateCount || 12, 
      workingDaysSettings ? JSON.stringify(workingDaysSettings) : null,
      useWorkingDays ? JSON.stringify(workingDaysConfig) : null,
      userId, userId
    ]);
    
    res.json({
      status: 'ok',
      config: result.rows[0],
      message: 'S&OP cycle configuration created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to create S&OP cycle configuration', { error: err.message });
  }
});

/**
 * Generate S&OP cycles from configuration
 * @route POST /sop-cycle-configs/:configId/generate
 * @returns {object} Generation result
 */
router.post('/sop-cycle-configs/:configId/generate', authenticateToken, async (req, res) => {
  try {
    const configId = parseInt(req.params.configId);
    const userId = req.user.id;
    
    if (!configId) {
      return sendError(res, 400, 'Invalid configuration ID');
    }
    
    // Verify configuration exists and user has access
    const configResult = await pgPool.query(
      'SELECT * FROM sop_cycle_configs WHERE id = $1 AND company_id = $2',
      [configId, req.user.company_id]
    );
    
    if (configResult.rows.length === 0) {
      return sendError(res, 404, 'Configuration not found');
    }
    
    // Generate cycles using the helper function
    const generateResult = await pgPool.query(
      'SELECT generate_sop_cycles_from_config($1, $2) as cycles_created',
      [configId, userId]
    );
    
    const cyclesCreated = generateResult.rows[0].cycles_created;
    
    res.json({
      status: 'ok',
      message: `Generated ${cyclesCreated} S&OP cycles`,
      cyclesCreated,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to generate S&OP cycles', { error: err.message });
  }
});

/**
 * Get S&OP cycles with enhanced information
 * @route GET /sop-cycles
 * @returns {object} List of S&OP cycles
 */
router.get('/sop-cycles', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const divisionId = req.query.divisionId ? parseInt(req.query.divisionId) : null;
    const status = req.query.status;
    const current = req.query.current === 'true';
    
    let query = `
      SELECT 
        sc.*,
        d.name as division_name,
        scc.frequency as config_frequency,
        CASE 
          WHEN sc.cut_off_date <= CURRENT_DATE THEN 'locked'
          WHEN sc.end_date <= CURRENT_DATE THEN 'completed'
          WHEN sc.start_date <= CURRENT_DATE AND sc.end_date > CURRENT_DATE THEN 'active'
          ELSE 'upcoming'
        END as cycle_status
      FROM sop_cycles sc
      LEFT JOIN divisions d ON sc.division_id = d.id
      LEFT JOIN sop_cycle_configs scc ON sc.config_id = scc.id
      WHERE sc.company_id = $1
    `;
    const params = [companyId];
    let paramIndex = 1;
    
    if (divisionId) {
      paramIndex++;
      query += ` AND sc.division_id = $${paramIndex}`;
      params.push(divisionId);
    }
    
    if (status) {
      paramIndex++;
      query += ` AND sc.status = $${paramIndex}`;
      params.push(status);
    }
    
    if (current) {
      paramIndex++;
      query += ` AND sc.is_current = $${paramIndex}`;
      params.push(true);
    }
    
    query += ' ORDER BY sc.start_date DESC';
    
    const result = await pgPool.query(query, params);
    
    res.json({
      status: 'ok',
      cycles: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch S&OP cycles', { error: err.message });
  }
});

/**
 * Create S&OP cycle
 * @route POST /sop-cycles
 * @returns {object} Created cycle
 */
router.post('/sop-cycles', authenticateToken, async (req, res) => {
  try {
    const {
      divisionId,
      configId,
      name,
      description,
      startDate,
      endDate,
      cutOffDate
    } = req.body;
    
    const companyId = req.user.company_id;
    const userId = req.user.id;
    
    // Validate required fields
    if (!name || !startDate || !endDate || !cutOffDate) {
      return sendError(res, 400, 'Name, start date, end date, and cut-off date are required');
    }
    
    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      return sendError(res, 400, 'Start date must be before end date');
    }
    
    if (new Date(cutOffDate) >= new Date(endDate)) {
      return sendError(res, 400, 'Cut-off date must be before end date');
    }
    
    // Insert cycle
    const result = await pgPool.query(`
      INSERT INTO sop_cycles (
        company_id, division_id, config_id, name, description,
        start_date, end_date, cut_off_date, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      companyId, divisionId || null, configId || null, name, description || null,
      startDate, endDate, cutOffDate, userId, userId
    ]);
    
    res.json({
      status: 'ok',
      cycle: result.rows[0],
      message: 'S&OP cycle created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to create S&OP cycle', { error: err.message });
  }
});

/**
 * Update S&OP cycle status
 * @route PUT /sop-cycles/:cycleId/status
 * @returns {object} Updated cycle
 */
router.put('/sop-cycles/:cycleId/status', authenticateToken, async (req, res) => {
  try {
    const cycleId = parseInt(req.params.cycleId);
    const { status, isCurrent } = req.body;
    const userId = req.user.id;
    
    if (!cycleId) {
      return sendError(res, 400, 'Invalid cycle ID');
    }
    
    // Verify cycle exists and user has access
    const cycleResult = await pgPool.query(
      'SELECT * FROM sop_cycles WHERE id = $1 AND company_id = $2',
      [cycleId, req.user.company_id]
    );
    
    if (cycleResult.rows.length === 0) {
      return sendError(res, 404, 'Cycle not found');
    }
    
    // Update cycle
    const updateFields = [];
    const params = [cycleId, userId];
    let paramIndex = 2;
    
    if (status) {
      paramIndex++;
      updateFields.push(`status = $${paramIndex}`);
      params.push(status);
    }
    
    if (isCurrent !== undefined) {
      paramIndex++;
      updateFields.push(`is_current = $${paramIndex}`);
      params.push(isCurrent);
    }
    
    if (updateFields.length === 0) {
      return sendError(res, 400, 'No fields to update');
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateFields.push(`updated_by = $2`);
    
    const result = await pgPool.query(`
      UPDATE sop_cycles 
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `, params);
    
    res.json({
      status: 'ok',
      cycle: result.rows[0],
      message: 'S&OP cycle updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to update S&OP cycle', { error: err.message });
  }
});

/**
 * Get S&OP cycle permissions
 * @route GET /sop-cycles/:cycleId/permissions
 * @returns {object} List of permissions
 */
router.get('/sop-cycles/:cycleId/permissions', authenticateToken, async (req, res) => {
  try {
    const cycleId = parseInt(req.params.cycleId);
    
    if (!cycleId) {
      return sendError(res, 400, 'Invalid cycle ID');
    }
    
    // Verify cycle exists and user has access
    const cycleResult = await pgPool.query(
      'SELECT * FROM sop_cycles WHERE id = $1 AND company_id = $2',
      [cycleId, req.user.company_id]
    );
    
    if (cycleResult.rows.length === 0) {
      return sendError(res, 404, 'Cycle not found');
    }
    
    // Get permissions
    const result = await pgPool.query(`
      SELECT 
        scp.*,
        u.username,
        u.first_name,
        u.last_name
      FROM sop_cycle_permissions scp
      JOIN users u ON scp.user_id = u.id
      WHERE scp.cycle_id = $1
      ORDER BY scp.granted_at DESC
    `, [cycleId]);
    
    res.json({
      status: 'ok',
      permissions: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch S&OP cycle permissions', { error: err.message });
  }
});

/**
 * Grant S&OP cycle permission
 * @route POST /sop-cycles/:cycleId/permissions
 * @returns {object} Created permission
 */
router.post('/sop-cycles/:cycleId/permissions', authenticateToken, async (req, res) => {
  try {
    const cycleId = parseInt(req.params.cycleId);
    const { userId, permissionType, expiresAt } = req.body;
    const grantedBy = req.user.id;
    
    if (!cycleId || !userId || !permissionType) {
      return sendError(res, 400, 'Cycle ID, user ID, and permission type are required');
    }
    
    // Validate permission type
    if (!['view', 'edit', 'approve', 'admin'].includes(permissionType)) {
      return sendError(res, 400, 'Invalid permission type');
    }
    
    // Verify cycle exists and user has access
    const cycleResult = await pgPool.query(
      'SELECT * FROM sop_cycles WHERE id = $1 AND company_id = $2',
      [cycleId, req.user.company_id]
    );
    
    if (cycleResult.rows.length === 0) {
      return sendError(res, 404, 'Cycle not found');
    }
    
    // Insert permission
    const result = await pgPool.query(`
      INSERT INTO sop_cycle_permissions (
        company_id, cycle_id, user_id, permission_type, granted_by, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (cycle_id, user_id, permission_type) 
      DO UPDATE SET 
        granted_at = CURRENT_TIMESTAMP,
        granted_by = $5,
        expires_at = $6
      RETURNING *
    `, [req.user.company_id, cycleId, userId, permissionType, grantedBy, expiresAt || null]);
    
    res.json({
      status: 'ok',
      permission: result.rows[0],
      message: 'Permission granted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, 500, 'Failed to grant permission', { error: err.message });
  }
});

export default router;