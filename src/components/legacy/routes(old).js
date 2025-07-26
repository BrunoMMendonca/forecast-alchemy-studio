import express from 'express';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { pgPool, createDataset, insertTimeSeriesData, getDatasetMetadata, getTimeSeriesData, findDatasetByHash } from './db.js';
import { callGrokAPI } from './grokService.js';
import { applyTransformations, detectColumnRoles, normalizeAndPivotData, findField, autoDetectSeparator, transposeData, parseCsvWithHeaders, parseDateWithFormat, parseNumberWithFormat } from './utils.js';
import { optimizeParametersWithAI, getModelRecommendation } from './aiOptimizationService.js';
import crypto from 'crypto';
import { dirname } from 'path';
import { MODEL_METADATA } from './models/ModelMetadata.js';
import { inferDateFrequency } from './utils.js';
import { modelFactory } from './models/ModelFactory.js';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { sha256 } from 'js-sha256';const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);const router = express.Router();// --- DEBUG LOGGING FOR $2 PARAMETER QUERIES ---
function debugQuery(query, params) {
  console.log('[DEBUG SQL]', query.replace(/\s+/g, ' ').trim());
  console.log('[DEBUG PARAMS]', params);
}// Database health check endpoint// Set hardcoded company and user for now
const companyId = 1;
const userId = 1;router.get('/health', (req, res) => {
  pgPool.query('SELECT 1 as test', (err, result) => {
    if (err) {
      console.error('Database health check failed:', err);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Database connection failed',
        error: err.message,
        code: err.code 
      });
    }
    res.json({ 
      status: 'ok', 
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    });
  });
});// Database schema check endpoint
router.get('/schema', (req, res) => {
  pgPool.query(    SELECT column_name, data_type      FROM information_schema.columns      WHERE table_name = 'optimization_jobs'      ORDER BY ordinal_position  , (err, result) => {
    if (err) {
      console.error('Schema check failed:', err);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Schema check failed',
        error: err.message,
        code: err.code 
      });
    }
    res.json({ 
      status: 'ok', 
      table: 'optimization_jobs',
      columns: result.rows,
      timestamp: new Date().toISOString()
    });
  });
});// Settings endpoint
router.get('/settings', (req, res) => {
  pgPool.query(    SELECT key, value FROM user_settings WHERE company_id = 1 AND user_id = 1  , (err, result) => {
    if (err) {
      console.error('Settings query failed:', err);
      // If settings table doesn't exist, return empty settings
      if (err.code === '42P01') {
        console.log('Settings table not found, returning empty settings');
        return res.json({});
      }
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }// Convert rows to key-value object
const settings = {};
result.rows.forEach(row => {
  settings[row.key] = row.value;
});

res.json(settings);  });
});// Update settings endpoint
router.post('/settings', (req, res) => {
  const { key, value } = req.body;  if (!key) {
    return res.status(400).json({ error: 'Key is required' });
  }  debugQuery(    INSERT INTO settings (key, value)      VALUES ($1, $2)      ON CONFLICT (key)      DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP  , [key, value]);
  pgPool.query(    INSERT INTO settings (key, value)      VALUES ($1, $2)      ON CONFLICT (key)      DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP  , [key, value], (err, result) => {
    if (err) {
      console.error('Settings update failed:', err);
      return res.status(500).json({ error: 'Failed to update settings' });
    }res.json({ success: true, key, value });  });
});// Track recent no-results logs to avoid spam
const recentNoResultsLogs = new Set();const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}const JOB_PRIORITIES = {
  SETUP: 1,
  DATA_CLEANING: 2,
  INITIAL_IMPORT: 3
};function getPriorityFromReason(reason) {
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
}// Read AI instructions from files
const aiInstructionsSmall = fs.readFileSync(path.join(__dirname, 'config/CSVImport/ai_csv_instructions_small.txt'), 'utf-8');
const aiInstructionsLarge = fs.readFileSync(path.join(__dirname, 'config/CSVImport/ai_csv_instructions_large.txt'), 'utf-8');router.post('/grok-transform', async (req, res) => {
  try {
    const { csvData, reasoningEnabled } = req.body;
    //console.Log([LOG] /grok-transform received reasoningEnabled: ${reasoningEnabled});
    if (!csvData) {
      return res.status(400).json({ error: 'Missing csvData or instructions' });
    }
    //console.Log('grok-transform received instructions:', aiInstructionsSmall.substring(0, 200) + '...');
    const { data, headers } = parseCsvWithHeaders(csvData);const sanitizedCsvData = data.map(row => {
  const sanitizedRow = {};
  for (const [key, value] of Object.entries(row)) {
    let sanitizedValue = value;
    if (value !== null && value !== undefined) {
      sanitizedValue = String(value)
        .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    }
    sanitizedRow[key] = sanitizedValue;
  }
  return sanitizedRow;
});

const outputFormat = reasoningEnabled 
  ? `{
      "reasoning": "Detailed explanation of how you followed the instructions to transform the data, including what patterns you detected and what specific transformations you applied",
      "data": "[transformed CSV data as array of objects]"
    }`
  : `{
      "data": "[transformed CSV data as array of objects]"
    }`;
  
// Send to Grok-3 API
const prompt = `CSV Data (first 5 rows):\n${JSON.stringify(sanitizedCsvData.slice(0, 5), null, 2)}\n\nInstructions:\n${aiInstructionsSmall}\n\nOutput Format:\n${outputFormat}`;
//console.Log('Final prompt being sent to AI:', prompt);
const response = await callGrokAPI(prompt, 4000, reasoningEnabled);
//console.Log('Raw Grok-3 Response (/grok-transform):', response);
let parsedResponse;
try {
  parsedResponse = JSON.parse(response);
} catch (parseError) {
  //console.Log('Direct JSON parse failed, trying extraction methods...');
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    parsedResponse = JSON.parse(jsonMatch[0]);
  } else {
    return res.status(500).json({ error: 'Failed to parse Grok response as JSON' });
  }
}

const reasoning = parsedResponse.reasoning || 'No reasoning provided';
const transformedData = parsedResponse.data || parsedResponse;

let columns = [];
if (Array.isArray(transformedData) && transformedData.length > 0) {
  columns = Object.keys(transformedData[0]);
}

// Get column roles as objects first
const columnRolesObjects = detectColumnRoles(columns);
// Extract just the role strings for the frontend
const columnRoles = columnRolesObjects.map(obj => obj.role);

res.json({ 
  transformedData,
  columns,
  reasoning,
  columnRoles,
  originalResponse: response
});  } catch (error) {
    console.error('Error in grok-transform:', error);
    res.status(500).json({ error: error.message });
  }
});router.post('/grok-generate-config', async (req, res) => {
  try {
    const { csvChunk, fileSize, reasoningEnabled } = req.body;
    if (!csvChunk) {
      return res.status(400).json({ error: 'Missing csvChunk or instructions' });
    }const outputFormat = reasoningEnabled
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

const prompt = `Context: You are processing a large CSV file of ${Math.round(fileSize / 1024)} KB.
Sample Data (first 15 records): 
${JSON.stringify(csvChunk, null, 2)}Instructions: ${aiInstructionsLarge}Output Format: ${outputFormat}
`;
    const response = await callGrokAPI(prompt, 2000, reasoningEnabled);
    //console.Log('Raw Grok-3 Response (/grok-generate-config):', response);
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch (parseError) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
            return res.status(500).json({ error: 'Failed to parse Grok response as JSON configuration' });
        }
    }
    const reasoning = parsedResponse.reasoning || 'No reasoning provided';// Handle potentially nested config object
let config = parsedResponse;
if (config.config) {
  config = config.config;
} else if (config.data && config.data.config) {
  config = config.data.config;
}

//console.Log('Generated config:', JSON.stringify(config, null, 2));
res.json({ 
  config, 
  reasoning,
  originalResponse: response
});  } catch (error) {
    console.error('Error in grok-generate-config:', error);
    res.status(500).json({ error: error.message });
  }
});router.post('/apply-config', async (req, res) => {
  try {
    const { csvData, config } = req.body;
    if (!csvData || !config) {
      return res.status(400).json({ error: 'Missing csvData or config' });
    }//console.Log('apply-config received config:', JSON.stringify(config, null, 2));

// Use the new robust parser
const { data } = parseCsvWithHeaders(csvData);

const { data: transformedData, columns } = applyTransformations(data, config);
// Get column roles as objects first
const columnRolesObjects = detectColumnRoles(columns);
// Extract just the role strings for the frontend
const columnRoles = columnRolesObjects.map(obj => obj.role);

const fileName = `processed-data-${Date.now()}.json`;
const datasetIdentifier = path.join(UPLOADS_DIR, fileName);
fs.writeFileSync(datasetIdentifier, JSON.stringify({ data: transformedData, columns }, null, 2));

const skuCount = transformedData.length;
const materialCodeKey = columns[0];
const skuList = Array.from(new Set(transformedData.map(row => row[materialCodeKey]).filter(Boolean)));
const dateRange = columns && columns.length > 1 ? [columns[1], columns[columns.length - 1]] : ["N/A", "N/A"];

res.status(200).json({
  message: 'Configuration applied and data saved successfully',
  datasetIdentifier: `uploads/${fileName}`,
  summary: {
    skuCount,
    dateRange,
    totalPeriods: columns ? columns.length - 1 : 0,
  },
  skuList: skuList,
  columns: columns, 
  previewData: transformedData.slice(0, 10),
  columnRoles: columnRoles
});  } catch (error) {
    console.error('Error applying configuration:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: 'An unexpected error occurred while applying the configuration.', details: error.message });
  }
});router.get('/processed-data/:fileName', (req, res) => {
  const { fileName } = req.params;
  const datasetIdentifier = path.join(UPLOADS_DIR, fileName);
  if (fs.existsSync(datasetIdentifier)) {
    res.sendFile(datasetIdentifier);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});router.post('/jobs', async (req, res) => {
  try {
    let { data, models, skus, reason, method = 'grid', datasetIdentifier, batchId, optimizationHash: frontendHash, metricWeights } = req.body;// Support both old datasetIdentifier and new datasetIdentifier for backward compatibility
const effectiveDatasetIdentifier = datasetIdentifier;

console.log(`[Job Creation] Creating jobs for ${skus?.length || 0} SKUs, ${models?.length || 0} models, method: ${method}, datasetIdentifier: ${effectiveDatasetIdentifier}`);
console.log(`[Job Creation] Frontend provided optimizationHash: ${frontendHash ? 'Yes' : 'No'}`);
console.log(`[Job Creation] Frontend provided metricWeights: ${metricWeights ? 'Yes' : 'No'}`);

// Set hardcoded company and user for now
const companyId = 1;
const userId = 1;

// ===== COMPREHENSIVE VALIDATION =====

// 1. Validate required fields
if (!skus || !Array.isArray(skus) || skus.length === 0) {
  console.log('[Job Creation]  Validation failed: skus array is required and must not be empty');
  return res.status(400).json({ 
    error: 'skus array is required and must not be empty',
    details: { received: skus }
  });
}

if (!models || !Array.isArray(models) || models.length === 0) {
  console.log('[Job Creation]  Validation failed: models array is required and must not be empty');
  return res.status(400).json({ 
    error: 'models array is required and must not be empty',
    details: { received: models }
  });
}

if (!effectiveDatasetIdentifier) {
  console.log('[Job Creation]  Validation failed: datasetIdentifier is required');
  return res.status(400).json({ 
    error: 'datasetIdentifier is required',
    details: { received: datasetIdentifier }
  });
}

// 2. Validate datasetIdentifier format and existence
let datasetId = null;
if (effectiveDatasetIdentifier.startsWith('dataset_')) {
  datasetId = parseInt(effectiveDatasetIdentifier.replace('dataset_', ''));
  if (isNaN(datasetId)) {
    console.log('[Job Creation]  Validation failed: Invalid dataset ID format');
    return res.status(400).json({ 
      error: 'Invalid dataset ID format. Expected dataset_XX where XX is a number',
      details: { received: effectiveDatasetIdentifier }
    });
  }
  
  // Check if dataset exists
  try {
    const metadata = await getDatasetMetadata(datasetId);
    if (!metadata) {
      console.log(`[Job Creation]  Validation failed: Dataset ${datasetId} not found`);
      return res.status(404).json({ 
        error: `Dataset ${datasetId} not found`,
        details: { datasetId, datasetIdentifier: effectiveDatasetIdentifier }
      });
    }
    console.log(`[Job Creation]  Dataset ${datasetId} exists: ${metadata.name}`);
  } catch (error) {
    console.log(`[Job Creation]  Validation failed: Error checking dataset ${datasetId}:`, error.message);
    return res.status(500).json({ 
      error: `Error checking dataset existence: ${error.message}`,
      details: { datasetId, datasetIdentifier: effectiveDatasetIdentifier }
    });
  }
} else if (effectiveDatasetIdentifier.startsWith('uploads/')) {
  // Legacy file-based validation
  const resolvedPath = effectiveDatasetIdentifier.startsWith(UPLOADS_DIR) ? effectiveDatasetIdentifier : path.join(UPLOADS_DIR, path.basename(effectiveDatasetIdentifier));
  if (!fs.existsSync(resolvedPath)) {
    console.log(`[Job Creation]  Validation failed: File does not exist: ${resolvedPath}`);
    return res.status(404).json({ 
      error: `Dataset file not found: ${effectiveDatasetIdentifier}`,
      details: { resolvedPath }
    });
  }
  console.log(`[Job Creation]  Legacy file exists: ${resolvedPath}`);
} else {
  console.log('[Job Creation]  Validation failed: Invalid datasetIdentifier format');
  return res.status(400).json({ 
    error: 'Invalid datasetIdentifier format. Expected dataset_XX or uploads/filename',
    details: { received: effectiveDatasetIdentifier }
  });
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
  console.log('[Job Creation]  Validation failed: Some SKUs not found in database');
  return res.status(400).json({ 
    error: 'Some SKUs not found in database',
    details: { missingSkus, validSkus: skuValidationResults.filter(result => result.exists) }
  });
}
console.log(`[Job Creation]  All ${skus.length} SKUs exist in database`);

// 4. Validate data availability for database datasets
if (datasetId) {
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
    console.log('[Job Creation]  Validation failed: Some SKUs have no data');
    return res.status(400).json({ 
      error: 'Some SKUs have no data in the dataset',
      details: { skusWithoutData, skusWithData: dataValidationResults.filter(result => result.hasData) }
    });
  }
  console.log(`[Job Creation]  All ${skus.length} SKUs have data in dataset ${datasetId}`);
}

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
  console.log('[Job Creation]  Validation failed: Some models are invalid');
  return res.status(400).json({ 
    error: 'Some models are invalid or not found',
    details: { invalidModels, validModels: modelValidationResults.filter(result => result.valid) }
  });
}
console.log(`[Job Creation]  All ${models.length} models are valid`);

console.log('[Job Creation]  All validation passed, proceeding with job creation');

// --- JOB CREATION LOGIC (updated for company_id, user_id, sku_id) ---

const priority = getPriorityFromReason(reason);
let jobsCreated = 0;
let jobsMerged = 0;

// Get model data requirements for eligibility filtering
const requirements = modelFactory.getModelDataRequirements();
const validationRatio = 0.2; // Match frontend default

// Get seasonal period from dataset metadata first, then global settings, then default
let seasonalPeriod = 12; // Default fallback
try {
  // First, try to get from dataset metadata if we have a dataset ID
  if (datasetId) {
    const metadata = await getDatasetMetadata(datasetId);
    if (metadata && metadata.metadata && metadata.metadata.summary && metadata.metadata.summary.frequency) {
      const frequency = metadata.metadata.summary.frequency;
      seasonalPeriod = getSeasonalPeriodsFromFrequency(frequency);
      console.log(`[Job Creation] Using seasonal period ${seasonalPeriod} from dataset ${datasetId} frequency: ${frequency}`);
    }
  }
  // If no dataset frequency, try global settings
  if (seasonalPeriod === 12) {
    const seasonalResult = await pgPool.query(`
      SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_seasonalPeriods'
    `);
    if (seasonalResult.rows.length > 0) {
      seasonalPeriod = parseInt(seasonalResult.rows[0].value);
      console.log(`[Job Creation] Using seasonal period ${seasonalPeriod} from global settings`);
    }
  }
} catch (e) {
  console.warn('[Job Creation] Could not get seasonal period from user_settings, using default:', e.message);
}
      
for (const sku of skus) {
  // Note: Data filtering will be handled by the worker, not during job creation
  // The worker will load the data from datasetIdentifier and filter by SKU
  console.log(`[Job Creation] Creating jobs for SKU: ${sku} (data filtering will be done by worker)`);
  
  // Include all models - the worker will filter based on actual data availability
  const eligibleModels = models;
  
  // Generate optimizationId per SKU (not per job) - all models for this SKU share the same optimizationId
  const optimizationId = uuidv4();

  // Create jobs for all eligible models (including non-optimizable ones)
  for (const modelId of eligibleModels) {
    // Check if model should be included in grid search using the model's own method
    const modelClass = modelFactory.getModelClass(modelId);
    if (method === 'grid' && modelClass && !modelClass.shouldIncludeInGridSearch()) {
      jobsMerged++;
      console.log(`[Job Creation] Merged job for SKU: ${sku}, Model: ${modelId} (model opted out of grid search)`);
      continue;
    }
    if (method === 'grid' && modelClass) {
      console.log(`[Job Creation] Model ${modelId} shouldIncludeInGridSearch(): ${modelClass.shouldIncludeInGridSearch()}`);
    }
    
    // Generate optimization hash for this specific model
    // Always generate hash for the specific model being processed
    const optimizationHash = generateOptimizationHash(sku, modelId, method, effectiveDatasetIdentifier, {}, metricWeights);
    
    // Check if a job with the same hash already exists
    try {
      const existingJob = await checkExistingOptimizationJob(optimizationHash, userId);
      if (existingJob) {
        if (existingJob.status === 'pending' || existingJob.status === 'running') {
          jobsMerged++;
          console.log(`[Job Creation] Merged job for SKU: ${sku}, Model: ${modelId} (duplicate job ${existingJob.id} already ${existingJob.status})`);
          console.log(`[Job Creation] DEBUG: batchId for merged job: "${batchId}"`);
          
          // Insert a merged job record for UI tracking
          const payload = JSON.stringify({ skuData: [], businessContext: null });
          const jobData = { modelTypes: [modelId], optimizationType: method, name: '', sku };
          
          // Extract dataset ID from datasetIdentifier if it's in dataset_XX format
          let datasetId = null;
          if (effectiveDatasetIdentifier && effectiveDatasetIdentifier.startsWith('dataset_')) {
            datasetId = parseInt(effectiveDatasetIdentifier.replace('dataset_', ''));
          }
          
          const insertQuery = `
            INSERT INTO optimization_jobs (
              company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, 
              batch_id, priority, result, optimization_id, optimization_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
            companyId, userId, skuId, sku, datasetId, method, payload, 'merged', 
            reason || 'manual_trigger', batchId, priority, 
            jobDataString, optimizationId, optimizationHash
          ]);
          
          continue;
        } else if (existingJob.status === 'completed') {
          jobsMerged++;
          console.log(`[Job Creation] Merged job for SKU: ${sku}, Model: ${modelId} (duplicate job ${existingJob.id} already completed)`);
          console.log(`[Job Creation] DEBUG: batchId for merged job: "${batchId}"`);
          
          // Insert a merged job record for UI tracking
          const payload = JSON.stringify({ skuData: [], businessContext: null });
          const jobData = { modelTypes: [modelId], optimizationType: method, name: '', sku };
          
          // Extract dataset ID from datasetIdentifier if it's in dataset_XX format
          let datasetId = null;
          if (effectiveDatasetIdentifier && effectiveDatasetIdentifier.startsWith('dataset_')) {
            datasetId = parseInt(effectiveDatasetIdentifier.replace('dataset_', ''));
          }
          
          const insertQuery = `
            INSERT INTO optimization_jobs (
              company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, 
              batch_id, priority, result, optimization_id, optimization_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
            companyId, userId, skuId, sku, datasetId, method, payload, 'merged', 
            reason || 'manual_trigger', batchId, priority, 
            jobDataString, optimizationId, optimizationHash
          ]);
          
          continue;
        }
        // If failed or cancelled, we can create a new job
        console.log(`[Job Creation] Creating new job for SKU: ${sku}, Model: ${modelId} (previous job ${existingJob.id} was ${existingJob.status})`);
      }
    } catch (error) {
      console.warn(`[Job Creation] Error checking for existing job: ${error.message}`);
      // Continue with job creation if we can't check for duplicates
    }
    
    const payload = JSON.stringify({ skuData: [], businessContext: null });

    // Read friendly dataset name from processed file or database if available
    let friendlyName = '';
    
    // Check if datasetIdentifier is a dataset ID
    if (effectiveDatasetIdentifier && effectiveDatasetIdentifier.startsWith('dataset_')) {
      try {
        const datasetId = parseInt(effectiveDatasetIdentifier.replace('dataset_', ''));
        const metadata = await getDatasetMetadata(datasetId);
        if (metadata && metadata.name) {
          friendlyName = metadata.name;
        }
      } catch (e) {
        console.warn(`Could not get dataset name for ID ${effectiveDatasetIdentifier}:`, e.message);
      }
    } else {
      // Fallback to file reading for legacy support
      let resolvedPath = effectiveDatasetIdentifier;
      if (effectiveDatasetIdentifier && !effectiveDatasetIdentifier.startsWith(UPLOADS_DIR)) {
        resolvedPath = path.join(UPLOADS_DIR, path.basename(effectiveDatasetIdentifier));
      }
      try {
        if (resolvedPath && fs.existsSync(resolvedPath)) {
          const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
          const data = JSON.parse(fileContent);
          if (data && data.name) {
            friendlyName = data.name;
          }
        }
      } catch (e) {
        // Ignore errors, fallback below
      }
    }
    
    if (!friendlyName && effectiveDatasetIdentifier) {
      friendlyName = (effectiveDatasetIdentifier.split('/').pop() || '').replace(/\.(csv|json)$/i, '');
    }

    // Include datasetIdentifier in jobData for worker to use
    const jobData = { 
      modelTypes: [modelId], 
      optimizationType: method, 
      name: friendlyName, 
      sku,
      datasetIdentifier: effectiveDatasetIdentifier 
    };
    
    // Extract dataset ID from datasetIdentifier if it's in dataset_XX format
    let datasetId = null;
    if (effectiveDatasetIdentifier && effectiveDatasetIdentifier.startsWith('dataset_')) {
      datasetId = parseInt(effectiveDatasetIdentifier.replace('dataset_', ''));
    }
    
    // Insert job with correct schema
    const insertQuery = `
      INSERT INTO optimization_jobs (
        company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, 
        batch_id, priority, result, optimization_id, optimization_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        companyId, userId, skuId, sku, datasetId, method, payload, 'pending', 
        reason || 'manual_trigger', batchId, priority, 
        jobDataString, optimizationId, optimizationHash
      ]);
    
    jobsCreated++;
    console.log(`[Job Creation] Created job for SKU: ${sku}, Model: ${modelId}, Hash: ${optimizationHash.slice(0, 8)}...`);
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
return;  }
} catch (error) {
  console.error('Error in jobs post:', error.message, error.stack);
  res.status(500).json({ error: error.message });
}
});router.get('/jobs/status', (req, res) => {
  const userId = 1; // or whatever your test user's id is
  const companyId = 1; // or get from request/context
  pgPool.query(    SELECT * FROM optimization_jobs WHERE company_id = $1 AND user_id = $2 ORDER BY method DESC, priority ASC, sku_id ASC, created_at ASC  , [companyId, userId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      // If database table doesn't exist, return empty response instead of error
      if (err.code === '42P01') { // relation does not exist
        console.log('Database tables not initialized yet, returning empty optimization job status');
        return res.json([]);
      }
      return res.status(500).json({ error: 'Failed to get optimization job status' });
    }
    // Explicitly include optimizationId in each job object
    const jobsWithOptimizationId = result.rows.map(job => ({ ...job, optimizationId: job.optimizationId }));
    res.json(jobsWithOptimizationId);
  });
});// New endpoint to get optimization-level status grouped by SKU and batchId
router.get('/optimizations/status', (req, res) => {
  const companyId = 1; // Default company for now
  const userId = 1; // or whatever your test user's id is
  pgPool.query(    SELECT j.*, s.description AS sku_description     FROM optimization_jobs j     LEFT JOIN skus s ON j.sku_id = s.id     WHERE j.company_id = $1 AND j.user_id = $2     ORDER BY j.method DESC, j.priority ASC, j.sku_id ASC, j.created_at ASC  , [companyId, userId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      // If database table doesn't exist, return empty response instead of error
      if (err.code === '42P01') { // relation does not exist
        console.log('Database tables not initialized yet, returning empty optimization status');
        return res.json({});
      }
      return res.status(500).json({ error: 'Failed to get optimization status' });
    }if (result.rows.length === 0) {
  return res.json([]);
}

// Build a map of SKU descriptions from the joined results
const skuDescriptions = {};
result.rows.forEach(job => {
  if (job.sku_id && job.sku_description) {
    skuDescriptions[job.sku_id] = job.sku_description;
  }
});

// Group jobs by SKU first, then by batchId
const skuGroups = {};
result.rows.forEach(job => {
  const sku = job.sku_id;
  const batchId = job.batch_id;
  if (!sku || !batchId) return;

  if (!skuGroups[sku]) {
    skuGroups[sku] = {
      sku,
      skuDescription: skuDescriptions[sku] || '',
      datasetIdentifier: job.dataset_id ? `dataset_${job.dataset_id}` : '',
      batches: {},
      totalJobs: 0,
      pendingJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      mergedJobs: 0,
      progress: 0,
      isOptimizing: false,
      methods: new Set(),
      models: new Set()
    };
  }

  if (!skuGroups[sku].batches[batchId]) {
    const batchTimestamp = Number(batchId.split('-').pop());
    skuGroups[sku].batches[batchId] = {
      batchId,
      batchTimestamp,
      sku: job.sku_id,
      skuDescription: skuDescriptions[sku] || '',
      datasetIdentifier: job.dataset_id ? `dataset_${job.dataset_id}` : '',
      reason: job.reason,
      priority: job.priority,
      createdAt: job.created_at,
      optimizations: {},
      totalJobs: 0,
      pendingJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      mergedJobs: 0,
      progress: 0,
      isOptimizing: false,
      methods: new Set(),
      models: new Set()
    };
  }

  // --- Add pretty names for model and method ---
  const modelClass = modelFactory.getModelClass(job.model_id);
  const modelDisplayName = modelClass?.metadata?.displayName || job.model_id || 'Unknown Model';
  const modelShortName = modelClass?.metadata?.shortName || (job.model_id ? job.model_id.toUpperCase() : 'UNKNOWN');

  const methodMeta = methodPrettyNames[job.method] || {};
  const methodDisplayName = methodMeta.displayName || job.method || 'Unknown Method';
  const methodShortName = methodMeta.shortName || (job.method ? job.method.toUpperCase() : 'UNKNOWN');

  const batch = skuGroups[sku].batches[batchId];
  const optimizationId = job.optimization_id;
  
  // Group by optimizationId within the batch
  if (!batch.optimizations[optimizationId]) {
    batch.optimizations[optimizationId] = {
      optimizationId,
      modelId: job.model_id,
      modelDisplayName,
      modelShortName,
      method: job.method,
      methodDisplayName,
      methodShortName,
      reason: job.reason,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      progress: 0,
      jobs: []
    };
  }

  batch.optimizations[optimizationId].jobs.push({
    ...job,
    modelDisplayName,
    modelShortName,
    methodDisplayName,
    methodShortName,
  });
  
  batch.totalJobs++;
  if (job.method) batch.methods.add(job.method);
  if (job.model_id) batch.models.add(job.model_id);

  // Update SKU-level counters
  skuGroups[sku].totalJobs++;
  if (job.method) skuGroups[sku].methods.add(job.method);
  if (job.model_id) skuGroups[sku].models.add(job.model_id);

  switch (job.status) {
    case 'pending':
      batch.pendingJobs++;
      skuGroups[sku].pendingJobs++;
      break;
    case 'running':
      batch.runningJobs++;
      skuGroups[sku].runningJobs++;
      break;
    case 'completed':
      batch.completedJobs++;
      skuGroups[sku].completedJobs++;
      break;
    case 'failed':
      batch.failedJobs++;
      skuGroups[sku].failedJobs++;
      break;
    case 'cancelled':
      batch.cancelledJobs++;
      skuGroups[sku].cancelledJobs++;
      break;
    case 'merged':
      batch.mergedJobs++;
      skuGroups[sku].mergedJobs++;
      break;
  }
});

// Calculate progress and status for each optimization, batch, and SKU
Object.values(skuGroups).forEach(skuGroup => {
  Object.values(skuGroup.batches).forEach(batch => {
    // Calculate progress for each optimization within the batch
    Object.values(batch.optimizations).forEach(optimization => {
      const optimizationJobs = optimization.jobs;
      const totalJobs = optimizationJobs.length;
      const completedJobs = optimizationJobs.filter(job => job.status === 'completed').length;
      const failedJobs = optimizationJobs.filter(job => job.status === 'failed').length;
      const cancelledJobs = optimizationJobs.filter(job => job.status === 'cancelled').length;
      
      const totalProcessable = totalJobs - cancelledJobs;
      optimization.progress = totalProcessable > 0 ? Math.round(((completedJobs + failedJobs) / totalProcessable) * 100) : 0;
      
      // Update optimization status based on job statuses
      if (optimizationJobs.some(job => job.status === 'running')) {
        optimization.status = 'running';
      } else if (optimizationJobs.some(job => job.status === 'pending')) {
        optimization.status = 'pending';
      } else if (optimizationJobs.every(job => job.status === 'completed')) {
        optimization.status = 'completed';
      } else if (optimizationJobs.some(job => job.status === 'failed')) {
        optimization.status = 'failed';
      } else if (optimizationJobs.every(job => job.status === 'cancelled')) {
        optimization.status = 'cancelled';
      }
    });

    // Calculate batch-level progress
    const totalProcessable = batch.totalJobs - batch.cancelledJobs;
    batch.progress = totalProcessable > 0 ? Math.round(((batch.completedJobs + batch.failedJobs) / totalProcessable) * 100) : 0;
    batch.isOptimizing = batch.pendingJobs > 0 || batch.runningJobs > 0;
    batch.methods = Array.from(batch.methods);
    batch.models = Array.from(batch.models);
  });

  // Calculate SKU-level progress
  const totalProcessable = skuGroup.totalJobs - skuGroup.cancelledJobs;
  skuGroup.progress = totalProcessable > 0 ? Math.round(((skuGroup.completedJobs + skuGroup.failedJobs) / totalProcessable) * 100) : 0;
  skuGroup.isOptimizing = skuGroup.pendingJobs > 0 || skuGroup.runningJobs > 0;
  skuGroup.methods = Array.from(skuGroup.methods);
  skuGroup.models = Array.from(skuGroup.models);
});

// Debug logging removed to reduce console noise

res.json(Object.values(skuGroups));  });
});// New endpoint to cancel an entire optimization
router.post('/optimizations/:optimizationId/cancel', (req, res) => {
  const { optimizationId } = req.params;
  const userId = 1; // or whatever your test user's id is  pgPool.query(    UPDATE optimization_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP     WHERE optimization_id = $1 AND user_id = $2 AND status IN ('pending', 'running')  , [optimizationId, userId], (err, result) => {
    if (err) {
      console.error('Failed to cancel optimization:', err);
      return res.status(500).json({ error: 'Failed to cancel optimization' });
    }
    res.status(200).json({ 
      message: 'Optimization cancelled successfully.', 
      cancelledJobs: result.rowCount 
    });
  });
});// New endpoint to pause an entire optimization
router.post('/optimizations/:optimizationId/pause', (req, res) => {
  const { optimizationId } = req.params;
  const userId = 1; // or whatever your test user's id is  pgPool.query(    UPDATE optimization_jobs SET status = 'pending', updated_at = CURRENT_TIMESTAMP     WHERE optimization_id = $1 AND user_id = $2 AND status = 'running'  , [optimizationId, userId], (err, result) => {
    if (err) {
      console.error('Failed to pause optimization:', err);
      return res.status(500).json({ error: 'Failed to pause optimization' });
    }
    res.status(200).json({ 
      message: 'Optimization paused successfully.', 
      pausedJobs: result.rowCount 
    });
  });
});// New endpoint to resume an entire optimization
router.post('/optimizations/:optimizationId/resume', (req, res) => {
  const { optimizationId } = req.params;
  const userId = 1; // or whatever your test user's id is  // This will be handled by the worker when it picks up the next pending job
  res.status(200).json({ 
    message: 'Optimization will resume when worker processes pending jobs.' 
  });
});router.post('/jobs/reset', (req, res) => {
    const userId = 1; // or whatever your test user's id is
    const companyId = 1; // or get from request/context
    pgPool.query(      DELETE FROM optimization_jobs WHERE user_id = $1 AND company_id = $2    , [userId, companyId], (err, result) => {
        if (err) {
            console.error('Failed to reset optimization jobs:', err);
            return res.status(500).json({ error: 'Failed to reset optimization jobs' });
        }
        res.status(200).json({ message: 'All optimization jobs have been reset.', deletedCount: result.rowCount });
    });
});router.post('/jobs/clear-completed', (req, res) => {
    const userId = 1; // or whatever your test user's id is
    const companyId = 1; // or get from request/context
    pgPool.query(      DELETE FROM optimization_jobs WHERE status = 'completed' AND user_id = $1 AND company_id = $2    , [userId, companyId], (err, result) => {
        if (err) {
            console.error('Failed to clear completed optimization jobs:', err);
            return res.status(500).json({ error: 'Failed to clear completed optimization jobs' });
        }
        res.status(200).json({ message: 'Completed jobs have been cleared.', deletedCount: result.rowCount });
    });
});router.post('/jobs/clear-pending', (req, res) => {
    const userId = 1; // or whatever your test user's id is
    const companyId = 1; // or get from request/context
    pgPool.query(      DELETE FROM optimization_jobs WHERE status = 'pending' AND user_id = $1 AND company_id = $2    , [userId, companyId], (err, result) => {
        if (err) {
            console.error('Failed to clear pending optimization jobs:', err);
            return res.status(500).json({ error: 'Failed to clear pending optimization jobs' });
        }
        res.status(200).json({ message: 'Pending jobs have been cleared.', deletedCount: result.rowCount });
    });
});router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        pgPool.query(          INSERT INTO users (username, password) VALUES ($1, $2)        , [username, hashedPassword], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to register user' });
            }
            res.status(201).json({ message: 'User registered successfully', userId: result.rows[0].id });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to register user due to a server error' });
    }
});router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    pgPool.query(      SELECT * FROM users WHERE username = $1    , [username], async (err, result) => {
        if (err || result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id }, 'your_jwt_secret', { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    });
});router.post('/process-manual-import', async (req, res) => {
  try {
    const { headers, data, mappings, dateFormat, transpose, finalColumnRoles, originalCsvData, originalCsvString } = req.body;// Debug log for received mappings
//console.Log('process-manual-import received mappings:', mappings);
if (finalColumnRoles) {
  //console.Log('process-manual-import received finalColumnRoles:', finalColumnRoles);
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
  console.log('Saved original CSV from raw string:', csvFileName);
} else if (originalCsvData && Array.isArray(originalCsvData) && originalCsvData.length > 0) {
  const csvHeaders = Object.keys(originalCsvData[0]);
  const csvContent = [
    csvHeaders.join(','),
    ...originalCsvData.map(row => csvHeaders.map(header => row[header]).join(','))
  ].join('\n');
  fs.writeFileSync(csvFilePath, csvContent);
  console.log('Saved original CSV from reconstructed data:', csvFileName);
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
const companyId = 1; // Default company for now
const uploadedBy = 1; // Default user for now

// Extract summary information
const skuList = Array.from(new Set(transformedData.map(row => row['Material Code']).filter(Boolean)));
const skuCount = skuList.length;

// Ensure all SKUs exist in the skus table
for (const skuCode of skuList) {
  await pgPool.query(
    'INSERT INTO skus (company_id, sku_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [companyId, skuCode]
  );
}
console.log(`[process-manual-import] Ensured ${skuCount} SKUs exist in database`);

const dateList = transformedData.map(row => row['Date']).filter(Boolean);
const uniqueDates = Array.from(new Set(dateList)).sort();
let dateRange = ["N/A", "N/A"];
if (uniqueDates.length > 0) {
  dateRange = [uniqueDates[0], uniqueDates[uniqueDates.length - 1]];
}
const totalPeriods = uniqueDates.length;
const frequency = inferDateFrequency(uniqueDates);
console.log('[process-manual-import] Inferred frequency:', frequency, 'from dates:', uniqueDates);
const datasetName = `Dataset ${new Date().toISOString().slice(0,10)} - From ${dateRange[0]} to ${dateRange[1]} (${skuCount} products)`;

// Auto-update global frequency setting if enabled
pgPool.query(`
  SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_autoDetectFrequency'
`, [], (err, result) => {
  if (!err && result.rows.length > 0) {
    try {
      const autoDetectEnabled = JSON.parse(result.rows[0].value);
      if (autoDetectEnabled) {
        const seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);
        debugQuery(`
          INSERT INTO settings (key, value, description, updated_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        `, ['global_frequency', frequency, 'Data frequency (auto-detected from dataset)']);
        pgPool.query(`
          INSERT INTO settings (key, value, description, updated_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        `, ['global_frequency', frequency, 'Data frequency (auto-detected from dataset)'], (err, result) => {
            if (err) console.error('Failed to update frequency setting:', err);
            else console.log('Auto-updated frequency setting to:', frequency);
          });
        debugQuery(`
          INSERT INTO settings (key, value, description, updated_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        `, ['global_seasonalPeriods', seasonalPeriods, 'Seasonal periods (auto-calculated from frequency)']);
        pgPool.query(`
          INSERT INTO settings (key, value, description, updated_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        `, ['global_seasonalPeriods', seasonalPeriods, 'Seasonal periods (auto-calculated from frequency)'], (err, result) => {
            if (err) console.error('Failed to update seasonal periods setting:', err);
            else console.log('Auto-updated seasonal periods setting to:', seasonalPeriods);
          });
      }
    } catch (e) {
      console.error('Error parsing autoDetectFrequency setting:', e);
    }
  }
});

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
  datasetName,
  `uploads/${csvFileName}`, // Store path to original audit file
  uploadedBy,
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

await insertTimeSeriesData(datasetId, timeSeriesRows);

console.log(`Inserted ${timeSeriesRows.length} time series rows for dataset ${datasetId}`);

const result = {
  success: true,
  datasetId: datasetId,
  datasetIdentifier: `dataset_${datasetId}`, // Use dataset ID format for consistency
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

console.log('Manual import processed successfully:', {
  datasetId: result.datasetId,
  datasetIdentifier: result.datasetIdentifier,
  skuCount: result.summary.skuCount,
  totalPeriods: result.summary.totalPeriods
});

res.json(result);  } catch (error) {
    console.error('Error processing manual import:', error.message, error.stack);
    res.status(500).json({ error: 'An unexpected error occurred during manual processing.', details: error.message, stack: error.stack });
  }
});router.post('/generate-preview', (req, res) => {
  try {
    const { csvData, transposed, separator: requestedSeparator, dateFormat: requestedDateFormat, numberFormat: requestedNumberFormat } = req.body;// Debug: Log received config and first few lines of CSV
console.log(' [generate-preview] Received:', {
  separator: requestedSeparator,
  dateFormat: requestedDateFormat,
  numberFormat: requestedNumberFormat,
  transposed: transposed
});
if (csvData) {
  console.log(' [generate-preview] First 5 lines of CSV:', csvData.split('\n').slice(0, 5));
}

// Use the new robust parser with the requested separator
let { data, headers, separator } = parseCsvWithHeaders(csvData, requestedSeparator);

// Debug: Log detected headers
console.log(' [generate-preview] Detected headers:', headers);

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
console.log(' [generate-preview] Detected column roles:', columnRoles);
console.log(' [generate-preview] Headers:', headers);

// Process preview data to show how dates would be interpreted with the selected format
const processedPreviewRows = data.slice(0, 100).map((row, rowIdx) => {
  const processedRow = {};
  headers.forEach((header, index) => {
    const value = row[header];
    const role = columnRoles[index];

    if (role === 'Date') {
      // For date columns, validate the cell value (sales numbers) against number format
      const parsedNumber = parseNumberWithFormat(value, requestedNumberFormat);
      if (!isNaN(parsedNumber)) {
        processedRow[header] = parsedNumber;
      } else {
        processedRow[header] = ` Invalid (${requestedNumberFormat})`;
      }
    } else if (role === 'Material Code' || role === 'Description') {
      // For Material Code and Description columns, show original value
      processedRow[header] = value;
    } else if (role === header) {
      // For columns that are mapped as their own name (text fields like "Marca")
      // Show the original value
      processedRow[header] = value;
    } else {
      // For other columns (aggregatable fields), try to parse as number
      const parsedNumber = parseNumberWithFormat(value, requestedNumberFormat);
      if (!isNaN(parsedNumber)) {
        processedRow[header] = parsedNumber;
      } else {
        processedRow[header] = ` Invalid (${requestedNumberFormat})`;
      }
    }
  });
  return processedRow;
});

// Create processed headers array to show invalid date formats in headers
// This is only for display - the data structure keeps original header names
const processedHeaders = headers.map((header, index) => {
  const role = columnRoles[index];
  if (role === 'Date') {
    const isHeaderValid = parseDateWithFormat(header, requestedDateFormat) !== null;
    if (!isHeaderValid) {
      return ` Invalid (${requestedDateFormat})`;
    }
  }
  return header;
});

res.json({
  headers: processedHeaders.slice(0, 50),
  originalHeaders: headers.slice(0, 50), // Add original headers for data access
  previewRows: processedPreviewRows,
  columnRoles,
  separator,
  transposed: !!transposed,
  dateFormat: requestedDateFormat,
  numberFormat: requestedNumberFormat
});

// Debug: Log what we're sending back
console.log(' [generate-preview] Sending response with processed data:');
console.log(' [generate-preview] First row preview data:', processedPreviewRows[0]);
console.log(' [generate-preview] Date columns in first row:', Object.keys(processedPreviewRows[0]).filter(key => 
  columnRoles[processedHeaders.indexOf(key)] === 'Date'
).map(key => `${key}: ${processedPreviewRows[0][key]}`));  } catch (error) {
    console.error('Error in generate-preview:', error);
    res.status(500).json({ error: error.message });
  }
});router.get('/load-processed-data', async (req, res) => {
  try {
    const { datasetIdentifier, datasetId, sku } = req.query;if (!datasetIdentifier && !datasetId) {
  return res.status(400).json({ error: 'Either datasetIdentifier or datasetId parameter is required' });
}

// If datasetId is provided, load from database
if (datasetId) {
  try {
    const id = parseInt(datasetId);
    console.log(' [load-processed-data] Loading dataset with ID:', id, sku ? `for SKU: ${sku}` : '');
    
    const metadata = await getDatasetMetadata(id);
    console.log(' [load-processed-data] Metadata result:', metadata ? 'found' : 'not found');
    
    if (!metadata) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    
    // Load time series data, optionally filtered by SKU
    let timeSeriesData;
    if (sku) {
      timeSeriesData = await getTimeSeriesData(id, sku);
      console.log(' [load-processed-data] Time series data for SKU result:', timeSeriesData ? `${timeSeriesData.length} rows` : 'not found');
    } else {
      timeSeriesData = await getTimeSeriesData(id);
      console.log(' [load-processed-data] Time series data result:', timeSeriesData ? `${timeSeriesData.length} rows` : 'not found');
    }
    
    if (!timeSeriesData || timeSeriesData.length === 0) {
      return res.status(404).json({ error: sku ? `No time series data found for dataset and SKU ${sku}` : 'No time series data found for dataset' });
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
    return;
  } catch (error) {
    console.error('Error loading data from database:', error);
    return res.status(500).json({ error: 'Failed to load data from database' });
  }
}

// Fallback to file loading for legacy support
if (!datasetIdentifier) {
  return res.status(400).json({ error: 'datasetIdentifier parameter is required when datasetId is not provided' });
}

// Construct the full path to the file
const fullPath = path.join(__dirname, '../../', datasetIdentifier);

// Security check: ensure the path is within the uploads directory
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fullPath.startsWith(uploadsDir)) {
  return res.status(403).json({ error: 'Access denied: file path is outside uploads directory' });
}

// Check if file exists
if (!fs.existsSync(fullPath)) {
  return res.status(404).json({ error: 'File not found' });
}

// Read and parse the JSON file
const fileContent = fs.readFileSync(fullPath, 'utf-8');
const data = JSON.parse(fileContent);

res.json(data);  } catch (error) {
    console.error('Error loading processed data:', error);
    res.status(500).json({ error: 'Failed to load processed data' });
  }
});// New: AI Parameter Optimization endpoint
router.post('/ai-optimize', async (req, res) => {
  try {
    const { modelType, historicalData, currentParameters, seasonalPeriod, targetMetric, businessContext, gridBaseline, aiEnabled } = req.body;
    if (!aiEnabled) {
      return res.status(200).json({ message: 'AI optimization is disabled. No optimization performed.' });
    }
    const result = await optimizeParametersWithAI(
      modelType,
      historicalData,
      currentParameters,
      seasonalPeriod,
      targetMetric,
      businessContext,
      gridBaseline
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});// New: AI Model Recommendation endpoint
router.post('/ai-model-recommendation', async (req, res) => {
  try {
    const { historicalData, dataFrequency, businessContext, aiEnabled } = req.body;
    if (!aiEnabled) {
      return res.status(200).json({ message: 'AI model recommendation is disabled. No recommendation performed.' });
    }
    const result = await getModelRecommendation(
      historicalData,
      dataFrequency,
      businessContext
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});// Endpoint to save cleaned data from manual edits or UI cleaning
router.post('/save-cleaned-data', async (req, res) => {
  try {
    const { cleaningMetadata, datasetIdentifier, canonicalFilePath } = req.body;// Support both old canonicalFilePath and new datasetIdentifier for backward compatibility
const effectiveDatasetIdentifier = datasetIdentifier || canonicalFilePath;

if (!effectiveDatasetIdentifier) {
  return res.status(400).json({ 
    error: 'Missing datasetIdentifier',
    details: 'datasetIdentifier is required for metadata-based cleaning'
  });
}

// Extract dataset ID from datasetIdentifier (assuming format like "dataset_15" or similar)
const datasetIdMatch = effectiveDatasetIdentifier.match(/dataset_(\d+)/);
if (!datasetIdMatch) {
  return res.status(400).json({ 
    error: 'Invalid datasetIdentifier format', 
    details: 'Expected datasetIdentifier to contain dataset ID (e.g., dataset_15)'
  });
}

const datasetId = parseInt(datasetIdMatch[1]);

// Update the cleaning metadata in the database
const updateQuery = `
  UPDATE datasets 
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb), 
    '{cleaningMetadata}', 
    $1::jsonb
  )
  WHERE id = $2
`;

const cleaningMetadataToSave = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  operations: cleaningMetadata.operations || [],
  activeCorrections: cleaningMetadata.activeCorrections || {}
};

const result = await pgPool.query(updateQuery, [JSON.stringify(cleaningMetadataToSave), datasetId]);

if (result.rowCount === 0) {
  return res.status(404).json({ 
    error: 'Dataset not found',
    details: `Dataset with ID ${datasetId} not found`
  });
}

console.log(`[save-cleaned-data] Updated cleaning metadata for dataset ID: ${datasetId}`);

// Return success with the datasetIdentifier
res.status(200).json({ 
  success: true,
  datasetIdentifier: effectiveDatasetIdentifier,
  datasetId: datasetId,
  message: 'Cleaning metadata saved successfully'
});  } catch (error) {
    console.error('[save-cleaned-data] Error:', error);
    res.status(500).json({ 
      error: 'Failed to save cleaned data', 
      details: error.message 
    });
  }
});router.post('/process-ai-import', async (req, res) => {
  try {
    const { transformedData, columns, columnRoles, finalColumnRoles, originalCsvData, originalCsvString } = req.body;if (!transformedData || !Array.isArray(transformedData) || transformedData.length === 0) {
  return res.status(400).json({ error: 'Missing or invalid transformed data' });
}

if (!columns || !Array.isArray(columns) || columns.length === 0) {
  return res.status(400).json({ error: 'Missing or invalid columns' });
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
  console.log('Saved original CSV from raw string:', csvFileName);
} else if (originalCsvData && Array.isArray(originalCsvData) && originalCsvData.length > 0) {
  const csvHeaders = Object.keys(originalCsvData[0]);
  const csvContent = [
    csvHeaders.join(','),
    ...originalCsvData.map(row => csvHeaders.map(header => row[header]).join(','))
  ].join('\n');
  fs.writeFileSync(csvFilePath, csvContent);
  console.log('Saved original CSV from reconstructed data:', csvFileName);
}

// Transform AI wide format to long format (matching manual flow)
const materialCodeKey = columns[0] || 'Material Code';
const descriptionKey = columns.find(col => col === 'Description');

// Identify date columns (all columns except Material Code, Description, and categorical columns)
const dateColumns = columns.filter(col => {
  if (col === materialCodeKey || col === 'Description') return false;
  if (columnRoles && columnRoles[columns.indexOf(col)] === 'Ignore') return false;
  // Check if it's a date format (YYYY-MM-DD)
  return /^\d{4}-\d{2}-\d{2}$/.test(col);
});

// Identify categorical columns (non-date, non-ignored columns)
const categoricalColumns = columns.filter(col => {
  if (col === materialCodeKey || col === 'Description') return false;
  if (columnRoles && columnRoles[columns.indexOf(col)] === 'Ignore') return false;
  return !dateColumns.includes(col);
});

// Transform to long format
const longFormatData = [];
for (const row of transformedData) {
  for (const dateCol of dateColumns) {
    const entry = {
      'Material Code': row[materialCodeKey],
      'Date': dateCol,
      'Sales': Number(row[dateCol]) || 0
    };
    
    // Add Description if present
    if (descriptionKey && row[descriptionKey]) {
      entry['Description'] = row[descriptionKey];
    }
    
    // Add categorical columns
    for (const catCol of categoricalColumns) {
      entry[catCol] = row[catCol];
    }
    
    if (entry['Material Code'] && entry['Date']) {
      longFormatData.push(entry);
    }
  }
}

// Build output columns (matching manual flow)
const outputColumns = [
  'Material Code',
  ...(descriptionKey ? ['Description'] : []),
  ...categoricalColumns,
  'Date',
  'Sales'
];

// Use finalColumnRoles from frontend if provided and valid
if (!finalColumnRoles || finalColumnRoles.length !== outputColumns.length) {
  throw new Error('finalColumnRoles length does not match normalized columns length');
}
const outputColumnRoles = finalColumnRoles;

// Extract summary information
const skuList = Array.from(new Set(longFormatData.map(row => row['Material Code']).filter(Boolean)));

// Determine date range from the date columns
const dateRange = dateColumns.length > 0 ? [dateColumns[0], dateColumns[dateColumns.length - 1]] : ["N/A", "N/A"];

// Infer frequency from date columns
const frequency = inferDateFrequency(dateColumns);
console.log('[process-ai-import] Inferred frequency:', frequency, 'from dates:', dateColumns);

// Auto-update global frequency setting if enabled
pgPool.query(`
  SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_autoDetectFrequency'
`, [], (err, result) => {
  if (!err && result.rows.length > 0) {
    try {
      const autoDetectEnabled = JSON.parse(result.rows[0].value);
      if (autoDetectEnabled) {
        const seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);
        debugQuery(`
          INSERT INTO settings (key, value, description, updated_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        `, ['global_frequency', frequency, 'Data frequency (auto-detected from dataset)']);
        pgPool.query(`
          INSERT INTO settings (key, value, description, updated_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        `, ['global_frequency', frequency, 'Data frequency (auto-detected from dataset)'], (err, result) => {
            if (err) console.error('Failed to update frequency setting:', err);
            else console.log('Auto-updated frequency setting to:', frequency);
          });
        debugQuery(`
          INSERT INTO settings (key, value, description, updated_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        `, ['global_seasonalPeriods', seasonalPeriods, 'Seasonal periods (auto-calculated from frequency)']);
        pgPool.query(`
          INSERT INTO settings (key, value, description, updated_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        `, ['global_seasonalPeriods', seasonalPeriods, 'Seasonal periods (auto-calculated from frequency)'], (err, result) => {
            if (err) console.error('Failed to update seasonal periods setting:', err);
            else console.log('Auto-updated seasonal periods setting to:', seasonalPeriods);
          });
      }
    } catch (e) {
      console.error('Error parsing autoDetectFrequency setting:', e);
    }
  }
});

// Create dataset record in database
const companyId = 1; // Default company for now
const uploadedBy = 1; // Default user for now
const datasetName = `Dataset ${new Date().toISOString().slice(0,10)} - From ${dateRange[0]} to ${dateRange[1]} (${skuList.length} products)`;

const metadata = {
  columns: outputColumns,
  columnRoles: outputColumnRoles,
  source: 'ai-import',
  summary: {
    skuCount: skuList.length,
    dateRange,
    totalPeriods: dateColumns.length,
    frequency,
  },
  csvHash: csvHash
};

const datasetId = await createDataset(
  companyId,
  datasetName,
  `uploads/${csvFileName}`, // Store path to original audit file
  uploadedBy,
  metadata
);

// Convert long format data to time series format and insert into database
const timeSeriesRows = longFormatData.map(row => {
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

await insertTimeSeriesData(datasetId, timeSeriesRows);

console.log(`Inserted ${timeSeriesRows.length} time series rows for dataset ${datasetId}`);

const result = {
  success: true,
  datasetId: datasetId,
  datasetIdentifier: `dataset_${datasetId}`, // Use dataset ID format for consistency
  summary: {
    skuCount: skuList.length,
    dateRange,
    totalPeriods: dateColumns.length,
    frequency,
  },
  skuList: skuList,
  columns: outputColumns,
  previewData: longFormatData.slice(0, 10),
  columnRoles: outputColumnRoles
};

//console.Log('AI import processed successfully:', {
//  datasetIdentifier: result.datasetIdentifier,
//  skuCount: result.summary.skuCount,
//  totalPeriods: result.summary.totalPeriods
//});

res.json(result);  } catch (error) {
    console.error('Error in process-ai-import:', error);
    res.status(500).json({ error: error.message });
  }
});// Endpoint to detect existing data and return the latest cleaned data
router.get('/detect-existing-data', async (req, res) => {
  try {
    // Query all datasets from the database
    const query =       SELECT id, name, file_path, metadata, uploaded_at       FROM datasets       ORDER BY uploaded_at DESC    ;
    const result = await pgPool.query(query);
    const datasets = result.rows.map(row => {
      let summary = {};
      let type = 'Manual Import';
      let source = 'database';
      let filename = row.file_path || '';
      if (row.metadata) {
        try {
          const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          summary = meta.summary || {};
          if (meta.source) type = meta.source === 'ai-import' ? 'AI Import' : 'Manual Import';
          if (meta.source) source = meta.source;
        } catch (e) {
          // ignore parse errors
        }
      }
      return {
        id: row.id,
        name: row.name,
        type,
        summary,
        filename,
        timestamp: row.uploaded_at ? new Date(row.uploaded_at).getTime() : null,
        source
      };
    });
    res.json({ datasets });
  } catch (error) {
    console.error('Error detecting existing data:', error);
    res.status(500).json({ error: 'Failed to detect existing data' });
  }
});// Endpoint to delete a dataset and all its associated data
router.delete('/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params;
    const id = parseInt(datasetId);if (isNaN(id)) {
  return res.status(400).json({ error: 'Invalid dataset ID' });
}

console.log(` [DELETE] Deleting dataset ID: ${id}`);

// Start a transaction to ensure data consistency
const client = await pgPool.connect();

try {
  await client.query('BEGIN');
  
  // Delete time series data first (foreign key constraint)
  const timeSeriesResult = await client.query(
    'DELETE FROM time_series_data WHERE company_id = 1 AND dataset_id = $1',
    [id]
  );
  console.log(` [DELETE] Deleted ${timeSeriesResult.rowCount} time series records`);
  
  // Delete jobs associated with this dataset
  const jobsResult = await client.query(
    'DELETE FROM optimization_jobs WHERE dataset_id = $1',
    [id]
  );
  console.log(` [DELETE] Deleted ${jobsResult.rowCount} job records`);
  
  // Finally delete the dataset
  const datasetResult = await client.query(
    'DELETE FROM datasets WHERE company_id = 1 AND id = $1',
    [id]
  );
  
  if (datasetResult.rowCount === 0) {
    await client.query('ROLLBACK');
    return res.status(404).json({ error: 'Dataset not found' });
  }
  
  await client.query('COMMIT');
  
  console.log(` [DELETE] Successfully deleted dataset ID: ${id}`);
  res.json({ 
    success: true, 
    message: `Dataset ${id} deleted successfully`,
    deletedTimeSeriesRecords: timeSeriesResult.rowCount,
    deletedJobRecords: jobsResult.rowCount
  });
  
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}  } catch (error) {
    console.error('Error deleting dataset:', error);
    res.status(500).json({ error: 'Failed to delete dataset', details: error.message });
  }
});// Helper to get default/baseline result for non-optimizable models
function getDefaultResultForModel(model, sku, batchId, datasetIdentifier) {
  return {
    modelType: model.id,
    displayName: model.displayName || model.id,
    category: model.category || 'Other',
    description: model.description || '',
    isSeasonal: model.isSeasonal || false,
    sku,
    batchId,
    datasetIdentifier,
    methods: [
      {
        method: 'grid',
        bestResult: {
          accuracy: null,
          parameters: model.defaultParameters || {},
          mape: null,
          rmse: null,
          mae: null,
          jobId: null,
          sku,
          batchId,
          datasetIdentifier,
          created_at: null,
          completed_at: null,
          compositeScore: null,
          isDefault: true, // Mark as default/baseline
          note: 'This model uses default parameters optimized for general use.'
        }
      }
    ]
  };
}// Add this helper at the top of the file or near extractBestResultsPerModelMethod
function safeMetric(val, max) {
  if (val === null || val === undefined || val === "" || isNaN(Number(val))) return max;
  return Number(val);
}// In extractBestResultsPerModelMethod, after collecting bestResultsMap, add all non-optimizable models as baselines if not already present
function extractBestResultsPerModelMethod(jobs, modelMetadataMap, weights = { mape: 0.4, rmse: 0.3, mae: 0.2, accuracy: 0.1 }) {
  const bestResultsMap = {};  for (const job of jobs) {
    const resultData = JSON.parse(job.result || '{}');
    const method = job.method;
    const batchId = job.batchId;
    const datasetIdentifier = job.dataset_id ? dataset_${job.dataset_id} : '';if (resultData.results && Array.isArray(resultData.results)) {
  for (const modelResult of resultData.results) {
    if (!modelResult.success) continue;
    
    const modelType = modelResult.modelType;
    const sku = job.sku;
    const modelInfo = modelMetadataMap.get(modelType) || {};
    
    // --- GROUP BY modelType, method, sku, batchId (or datasetIdentifier) ---
    const groupKey = `${modelType}__${method}__${sku}__${batchId || datasetIdentifier}`;

    if (!bestResultsMap[groupKey]) {
      bestResultsMap[groupKey] = {
        modelType,
        displayName: modelInfo.displayName || modelType,
        category: modelInfo.category || 'Unknown',
        description: modelInfo.description || '',
        isSeasonal: modelInfo.isSeasonal || false,
        method,
        sku,
        batchId,
        datasetIdentifier,
        allResults: []
      };
    }
    
    bestResultsMap[groupKey].allResults.push({
      accuracy: modelResult.accuracy,
      parameters: modelResult.parameters,
      mape: modelResult.mape,
      rmse: modelResult.rmse,
      mae: modelResult.mae,
      jobId: job.id,
      sku,
      batchId,
      datasetIdentifier,
      created_at: job.created_at,
      completed_at: job.completed_at
    });
  }
}  }  // For each group, compute composite score and select best
  Object.values(bestResultsMap).forEach(group => {
    const results = group.allResults;
      if (!results.length) return;
    const maxMAPE = Math.max(...results.map(r => r.mape || 0), 1);
      const maxRMSE = Math.max(...results.map(r => r.rmse || 0), 1);
      const maxMAE = Math.max(...results.map(r => r.mae || 0), 1);
      results.forEach(r => {
        // Use safeMetric for all metrics
        const mape = safeMetric(r.mape, maxMAPE);
        const rmse = safeMetric(r.rmse, maxRMSE);
        const mae  = safeMetric(r.mae, maxMAE);
        const accuracy = safeMetric(r.accuracy, 0); // for accuracy, missing = 0 (worst)    const normAccuracy = Math.max(0, Math.min(1, accuracy / 100));
    const normMAPE = Math.max(0, Math.min(1, 1 - (mape / maxMAPE)));
    const normRMSE = Math.max(0, Math.min(1, 1 - (rmse / maxRMSE)));
    const normMAE = Math.max(0, Math.min(1, 1 - (mae / maxMAE)));
    r.compositeScore =
      (weights.mape * normMAPE) +
      (weights.rmse * normRMSE) +
      (weights.mae * normMAE) +
      (weights.accuracy * normAccuracy);
  });
  // Pick the result with the highest composite score
  const best = results.reduce((best, curr) =>
    (curr.compositeScore > (best.compositeScore || -Infinity)) ? curr : best, results[0]);
group.bestResult = best;  });  // Convert to array format
  const results = Object.values(bestResultsMap).map(group => ({
    modelType: group.modelType,
    displayName: group.displayName,
    category: group.category,
    description: group.description,
    isSeasonal: group.isSeasonal,
    sku: group.sku,
    batchId: group.batchId,
    datasetIdentifier: group.datasetIdentifier,
    methods: [
      {
        method: group.method,
        bestResult: group.bestResult
      }
    ]
  }));  // Add models that should be included in grid search but are missing from results
  const allModelIds = Array.from(modelMetadataMap.keys());
   for (const modelId of allModelIds) {
    const model = modelMetadataMap.get(modelId);
    // Check if model should be included in grid search using the model's own method
    const modelClass = modelFactory.getModelClass(modelId);
    if (!modelClass || !modelClass.shouldIncludeInGridSearch()) {
      continue; // Skip models that opt out of grid search
    }
    const seenCombos = new Set(results.map(r => ${r.modelType}|${r.sku}|${r.batchId}|${r.datasetIdentifier}));
      for (const job of jobs) {
        const comboKey = ${modelId}|${job.sku}|${job.batchId}|${job.dataset_id ? dataset_${job.dataset_id} : ''};
        if (!seenCombos.has(comboKey)) {
        results.push(getDefaultResultForModel(model, job.sku, job.batchId, job.dataset_id ? dataset_${job.dataset_id} : ''));
      }
    }
  }  // After building results array, ensure every model is represented for each (sku, datasetIdentifier, batchId) combo
  // Use MODEL_METADATA to get the full list of models
  // Collect all unique (sku, datasetIdentifier, batchId) combos from jobs
  const combos = [];
  for (const job of jobs) {
    const sku = job.sku;
    const batchId = job.batchId;
    const datasetIdentifier = job.dataset_id ? dataset_${job.dataset_id} : '';
    combos.push({ sku, batchId, datasetIdentifier });
  }
  // For each combo, ensure every model/method is present
  const seenCombos = new Set(results.map(r => ${r.modelType}|${r.sku}|${r.batchId}|${r.datasetIdentifier}|${r.methods[0]?.method}));
  for (const { sku, batchId, datasetIdentifier } of combos) {
    for (const modelId of allModelIds) {
      const model = modelMetadataMap.get(modelId);
      for (const method of ['grid', 'ai']) {
        const comboKey = ${modelId}|${sku}|${batchId}|${datasetIdentifier}|${method};
        if (!seenCombos.has(comboKey)) {
          results.push({
            modelType: model.id,
            displayName: model.displayName || model.id,
            category: model.category || 'Other',
            description: model.description || '',
            isSeasonal: model.isSeasonal || false,
            sku,
            batchId,
            datasetIdentifier,
            methods: [
              {
                method,
                bestResult: {
                  accuracy: null,
                  parameters: [],
                  mape: null,
                  rmse: null,
                  mae: null,
                  jobId: null,
                  sku,
                  batchId,
                  datasetIdentifier,
                  created_at: null,
                  completed_at: null,
                  compositeScore: null,
                  status: 'ineligible',
                  reason: 'No result available for this model/method (ineligible, failed, or not run)'
                }
              }
            ]
          });
          seenCombos.add(comboKey); // Prevent duplicates
        }
      }
    }
  }
  return results;
}// Get optimization results summary with model metadata
router.get('/jobs/results-summary', (req, res) => {
    const userId = 1; // or whatever your test user's id is
    const { method } = req.query;// Validate method parameter
if (method && !['grid', 'ai', 'all'].includes(method)) {
    return res.status(400).json({ error: 'Method must be "grid", "ai", or "all"' });
}

// Build query based on method filter
let query = "SELECT * FROM optimization_jobs WHERE status = 'completed' AND user_id = $1 AND result IS NOT NULL";
let params = [userId];

if (method && method !== 'all') {
    query += " AND method = $2";
    params.push(method);
}

query += " ORDER BY created_at DESC";

debugQuery(query, params);
pgPool.query(query, params, (err, result) => {
    if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch optimization results' });
    }
    
    if (result.rows.length === 0) {
        // Return an empty summary object instead of an error
        return res.json({
            totalJobs: 0,
            totalResults: 0,
            modelBreakdown: {},
            categoryBreakdown: {},
            seasonalVsNonSeasonal: { seasonal: 0, nonSeasonal: 0 },
            methodBreakdown: { grid: 0, ai: 0 },
            averageMetrics: { accuracy: 0, mape: 0, rmse: 0, mae: 0 },
            bestResults: [],
            bestResultsPerModelMethod: []
        });
    }
    
    try {
        // Create a lookup map for model metadata
        const modelMetadataMap = new Map();
        MODEL_METADATA.forEach(model => {
            modelMetadataMap.set(model.id, model);
        });
        
        const summary = {
            totalJobs: result.rows.length,
            totalResults: 0,
            modelBreakdown: {},
            categoryBreakdown: {},
            seasonalVsNonSeasonal: { seasonal: 0, nonSeasonal: 0 },
            methodBreakdown: { grid: 0, ai: 0 },
            averageMetrics: { accuracy: 0, mape: 0, rmse: 0, mae: 0 },
            bestResults: [],
            bestResultsPerModelMethod: extractBestResultsPerModelMethod(result.rows, modelMetadataMap, weights)
        };
        
        let totalAccuracy = 0;
        let totalMape = 0;
        let totalRmse = 0;
        let totalMae = 0;
        let successfulResults = 0;
        
        for (const job of result.rows) {
            const resultData = JSON.parse(job.result || '{}');
            summary.methodBreakdown[job.method] = (summary.methodBreakdown[job.method] || 0) + 1;
            
            // Extract individual model results from the optimization result
            if (resultData.results && Array.isArray(resultData.results)) {
                for (const modelResult of resultData.results) {
                    summary.totalResults++;
                    
                    // Get model metadata for enhanced information
                    const modelInfo = modelMetadataMap.get(modelResult.modelType) || {};
                    
                    // Model breakdown
                    if (!summary.modelBreakdown[modelResult.modelType]) {
                        summary.modelBreakdown[modelResult.modelType] = {
                            displayName: modelInfo.displayName || modelResult.modelType,
                            category: modelInfo.category || 'Unknown',
                            description: modelInfo.description || '',
                            isSeasonal: modelInfo.isSeasonal || false,
                            count: 0,
                            successfulCount: 0,
                            averageAccuracy: 0,
                            bestAccuracy: 0,
                            totalAccuracy: 0
                        };
                    }
                    
                    const modelStats = summary.modelBreakdown[modelResult.modelType];
                    modelStats.count++;
                    
                    if (modelResult.success) {
                        modelStats.successfulCount++;
                        modelStats.totalAccuracy += modelResult.accuracy;
                        modelStats.averageAccuracy = modelStats.totalAccuracy / modelStats.successfulCount;
                        modelStats.bestAccuracy = Math.max(modelStats.bestAccuracy, modelResult.accuracy);
                        
                        // Global averages
                        totalAccuracy += modelResult.accuracy;
                        totalMape += modelResult.mape;
                        totalRmse += modelResult.rmse;
                        totalMae += modelResult.mae;
                        successfulResults++;
                    }
                    
                    // Category breakdown
                    const category = modelInfo.category || 'Unknown';
                    if (!summary.categoryBreakdown[category]) {
                        summary.categoryBreakdown[category] = {
                            count: 0,
                            successfulCount: 0,
                            averageAccuracy: 0,
                            totalAccuracy: 0
                        };
                    }
                    
                    const categoryStats = summary.categoryBreakdown[category];
                    categoryStats.count++;
                    if (modelResult.success) {
                        categoryStats.successfulCount++;
                        categoryStats.totalAccuracy += modelResult.accuracy;
                        categoryStats.averageAccuracy = categoryStats.totalAccuracy / categoryStats.successfulCount;
                    }
                    
                    // Seasonal vs Non-seasonal
                    if (modelInfo.isSeasonal) {
                        summary.seasonalVsNonSeasonal.seasonal++;
                    } else {
                        summary.seasonalVsNonSeasonal.nonSeasonal++;
                    }
                    
                    // Track best results
                    if (modelResult.success && modelResult.accuracy > 0) {
                        summary.bestResults.push({
                            modelType: modelResult.modelType,
                            modelDisplayName: modelInfo.displayName || modelResult.modelType,
                            modelCategory: modelInfo.category || 'Unknown',
                            accuracy: modelResult.accuracy,
                            parameters: modelResult.parameters,
                            jobId: job.id,
                            sku: job.sku,
                            method: job.method
                        });
                    }
                }
            }
        }
        
        // Calculate global averages
        if (successfulResults > 0) {
            summary.averageMetrics.accuracy = totalAccuracy / successfulResults;
            summary.averageMetrics.mape = totalMape / successfulResults;
            summary.averageMetrics.rmse = totalRmse / successfulResults;
            summary.averageMetrics.mae = totalMae / successfulResults;
        }
        
        // Sort best results by accuracy
        summary.bestResults.sort((a, b) => b.accuracy - a.accuracy);
        summary.bestResults = summary.bestResults.slice(0, 10); // Top 10
        
        res.json(summary);
        
    } catch (error) {
        console.error('Error processing optimization results summary:', error);
        res.status(500).json({ error: 'Failed to process optimization results summary', details: error.message });
    }
});});// Add endpoint to get available models
router.get('/models', (req, res) => {
  try {
    const seasonalPeriod = req.query.seasonalPeriod ? parseInt(req.query.seasonalPeriod) : 12;
    const models = modelFactory.getAllModelInfo();// Add data requirements to each model
const requirements = modelFactory.getModelDataRequirements(seasonalPeriod);
const enhancedModels = models.map(model => ({
  ...model,
  dataRequirements: requirements[model.id] || {
    minObservations: 5,
    description: 'Requires at least 5 observations',
    isSeasonal: false
  }
}));

res.json(enhancedModels);  } catch (error) {
    console.error('[API] Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});// Add rate limiter for forecast results endpoint
const forecastResultsLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});// New endpoint: Get best results per model and method
router.get('/jobs/best-results-per-model', forecastResultsLimiter, (req, res) => {
    const userId = 1; // or whatever your test user's id is
    const { method, datasetIdentifier, sku } = req.query;
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
    // Build query based on method filter and datasetIdentifier filter
    let query = "SELECT * FROM optimization_jobs WHERE status = 'completed' AND user_id = $1 AND result IS NOT NULL";
    let params = [userId];
    let paramIndex = 2;
    if (method && method !== 'all') {
        query +=  AND method = $${paramIndex};
        params.push(method);
        paramIndex++;
    }
    if (datasetIdentifier) {
        // Extract dataset ID from datasetIdentifier if it's in dataset_XX format
        const datasetIdMatch = datasetIdentifier.match(/dataset_(\d+)/);
        if (datasetIdMatch) {
            const datasetId = parseInt(datasetIdMatch[1]);
            query +=  AND dataset_id = $${paramIndex};
            params.push(datasetId);
            paramIndex++;
        } else {
            // Fallback to file_path for backward compatibility
            query +=  AND file_path = $${paramIndex};
            params.push(datasetIdentifier);
            paramIndex++;
        }
    }
    if (sku) {
        query +=  AND sku = $${paramIndex};
        params.push(sku);
        paramIndex++;
    }
    query += " ORDER BY created_at DESC";
    debugQuery(query, params);
    pgPool.query(query, params, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch optimization results' });
        }    if (result.rows.length > 0) {
        // Jobs found, continue processing
    } else {
        // Only log once per unique request to avoid spam
        const requestKey = `${datasetIdentifier}-${sku}-${method}`;
        if (!recentNoResultsLogs.has(requestKey)) {
            console.log(`[API] Debug: No jobs found with criteria: datasetIdentifier='${datasetIdentifier}', sku='${sku}', method='${method}'`);
            recentNoResultsLogs.add(requestKey);
            // Clear after 30 seconds to allow retry logging
            setTimeout(() => recentNoResultsLogs.delete(requestKey), 30000);
        }
    }
    
    if (result.rows.length === 0) {
        // Return empty results instead of 404 to avoid console errors
        return res.json({
            totalJobs: 0,
            bestResultsPerModelMethod: [],
            timestamp: new Date().toISOString()
        });
    }
    try {
        // Create a lookup map for model metadata
        const modelMetadataMap = new Map();
        MODEL_METADATA.forEach(model => {
            modelMetadataMap.set(model.id, model);
        });
        const bestResultsPerModelMethod = extractBestResultsPerModelMethod(result.rows, modelMetadataMap, weights);
        const response = {
            totalJobs: result.rows.length,
            bestResultsPerModelMethod,
            timestamp: new Date().toISOString()
        };
        console.log(`[Backend] Returning ${bestResultsPerModelMethod.length} results for datasetIdentifier: ${datasetIdentifier}, sku: ${sku}`);
        if (bestResultsPerModelMethod.length > 0) {
            console.log(`[Backend] Sample result:`, {
                modelType: bestResultsPerModelMethod[0].modelType,
                sku: bestResultsPerModelMethod[0].sku,
                datasetIdentifier: bestResultsPerModelMethod[0].datasetIdentifier,
                methodsCount: bestResultsPerModelMethod[0].methods?.length,
                hasBestResult: bestResultsPerModelMethod[0].methods?.some(m => m.bestResult?.compositeScore !== null)
            });
        }
        res.json(response);
    } catch (error) {
        console.error('Error processing best results per model:', error);
        res.status(500).json({ error: 'Failed to process best results per model', details: error.message });
    }
});});// Get model data requirements
router.get('/models/data-requirements', (req, res) => {
  try {
    const seasonalPeriod = req.query.seasonalPeriod ? parseInt(req.query.seasonalPeriod) : 12;
    const requirements = modelFactory.getModelDataRequirements(seasonalPeriod);
    res.json(requirements);
  } catch (error) {
    console.error('[API] Error fetching model data requirements:', error);
    res.status(500).json({ error: 'Failed to fetch model data requirements' });
  }
});// Check model compatibility with data
router.post('/models/check-compatibility', (req, res) => {
  try {
    const { modelTypes, dataLength, seasonalPeriod = 12 } = req.body;if (!modelTypes || !Array.isArray(modelTypes)) {
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

res.json(compatibility);  } catch (error) {
    console.error('[API] Error checking model compatibility:', error);
    res.status(500).json({ error: 'Failed to check model compatibility' });
  }
});// Export optimization results as CSV
router.get('/jobs/export-results', (req, res) => {
    const userId = 1; // or whatever your test user's id is
    const { method, format = 'csv', datasetIdentifier, sku } = req.query;// Get metric weights from query parameters (same as used in best result calculation)
const mapeWeight = parseFloat(req.query.mapeWeight) || 0.4;
const rmseWeight = parseFloat(req.query.rmseWeight) || 0.3;
const maeWeight = parseFloat(req.query.maeWeight) || 0.2;
const accuracyWeight = parseFloat(req.query.accuracyWeight) || 0.1;
const weights = { mape: mapeWeight, rmse: rmseWeight, mae: maeWeight, accuracy: accuracyWeight };
// Validate method parameter
if (method && !['grid', 'ai', 'all'].includes(method)) {
    return res.status(400).json({ error: 'Method must be "grid", "ai", or "all"' });
}

// Build query based on method filter and datasetIdentifier filter
let query = "SELECT * FROM optimization_jobs WHERE status = 'completed' AND user_id = $1 AND result IS NOT NULL";
let params = [userId];

if (method && method !== 'all') {
    query += " AND method = $2";
    params.push(method);
}

// Add datasetIdentifier filter if specified
if (datasetIdentifier) {
    // Extract dataset ID from datasetIdentifier if it's in dataset_XX format
    const datasetIdMatch = datasetIdentifier.match(/dataset_(\d+)/);
    if (datasetIdMatch) {
        const datasetId = parseInt(datasetIdMatch[1]);
        query += " AND dataset_id = $3";
        params.push(datasetId);
    } else {
        // Fallback to file_path for backward compatibility
        query += " AND file_path = $3";
        params.push(datasetIdentifier);
    }
}

// Add SKU filter if specified
if (sku) {
    query += " AND sku = $4";
    params.push(sku);
}

query += " ORDER BY created_at DESC";

debugQuery(query, params);
pgPool.query(query, params, (err, result) => {
    if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch optimization results' });
    }
    
    if (result.rows.length === 0) {
        const filterMessage = datasetIdentifier ? ` for dataset: ${datasetIdentifier}` : '';
        return res.status(404).json({ error: `No completed optimization jobs found${filterMessage}` });
    }
    
    try {
        const results = [];
        
        // Create a lookup map for model metadata
        const modelMetadataMap = new Map();
        MODEL_METADATA.forEach(model => {
            modelMetadataMap.set(model.id, model);
        });
        
        // Group results by job to calculate normalization factors per job
        const jobResultsMap = new Map();
        
        for (const job of result.rows) {
            const jobData = JSON.parse(job.data || '{}');
            const resultData = JSON.parse(job.result || '{}');
            
            // Extract individual model results from the optimization result
            if (resultData.results && Array.isArray(resultData.results)) {
                const jobResults = [];
                
                for (const modelResult of resultData.results) {
                    // Get model metadata for enhanced information
                    const modelInfo = modelMetadataMap.get(modelResult.modelType) || {};
                    
                    jobResults.push({
                        // Job metadata
                        jobId: job.id,
                        sku: job.sku,
                        modelId: job.modelId,
                        method: job.method,
                        reason: job.reason,
                        batchId: job.batchId,
                        created_at: job.created_at,
                        completed_at: job.completed_at,
                        duration: job.completed_at ? 
                            Math.round((new Date(job.completed_at) - new Date(job.created_at)) / 1000) : null,
                        
                        // Model result data
                        modelType: modelResult.modelType,
                        modelDisplayName: modelInfo.displayName || modelResult.modelType,
                        modelCategory: modelInfo.category || 'Unknown',
                        modelDescription: modelInfo.description || '',
                        isSeasonal: modelInfo.isSeasonal || false,
                        parameters: JSON.stringify(modelResult.parameters),
                        accuracy: modelResult.accuracy,
                        mape: modelResult.mape,
                        rmse: modelResult.rmse,
                        mae: modelResult.mae,
                        success: modelResult.success,
                        error: modelResult.error,
                        
                        // Training data info
                        trainingDataSize: resultData.trainingDataSize,
                        validationDataSize: resultData.validationDataSize,
                        
                        // Best result info (will be calculated later with current weights)
                        isBestResult: false,
                            // Dataset info
                            datasetIdentifier: job.datasetIdentifier || '',
                            datasetName: jobData.name || ''
                    });
              }
                
                jobResultsMap.set(job.id, jobResults);
            }
        }
        
        // Calculate normalization factors and composite scores for each job
        for (const [jobId, jobResults] of jobResultsMap) {
            if (jobResults.length === 0) continue;
            
            // Find max values for normalization (avoid division by zero)
            const maxMAPE = Math.max(...jobResults.map(r => r.mape || 0), 1);
            const maxRMSE = Math.max(...jobResults.map(r => r.rmse || 0), 1);
            const maxMAE = Math.max(...jobResults.map(r => r.mae || 0), 1);
            
            // Calculate normalized metrics and composite scores
            jobResults.forEach(result => {
                // Use safeMetric for all metrics
                const mape = safeMetric(result.mape, maxMAPE);
                const rmse = safeMetric(result.rmse, maxRMSE);
                const mae  = safeMetric(result.mae, maxMAE);
                const accuracy = safeMetric(result.accuracy, 0); // for accuracy, missing = 0 (worst)

                result.normAccuracy = Math.max(0, Math.min(1, accuracy / 100));
                result.normMAPE = Math.max(0, Math.min(1, 1 - (mape / maxMAPE)));
                result.normRMSE = Math.max(0, Math.min(1, 1 - (rmse / maxRMSE)));
                result.normMAE = Math.max(0, Math.min(1, 1 - (mae / maxMAE)));
                // Composite score using the weights
                result.compositeScore = 
                    (weights.mape * result.normMAPE) +
                    (weights.rmse * result.normRMSE) +
                    (weights.mae * result.normMAE) +
                    (weights.accuracy * result.normAccuracy);
            });
            
            // Find the best result for this job using current weights
            const bestResult = jobResults.reduce((best, curr) =>
                (curr.compositeScore > (best.compositeScore || -Infinity)) ? curr : best, jobResults[0]);
            
            // Mark the best result
            jobResults.forEach(result => {
                result.isBestResult = result === bestResult;
            });
            
            
            // Add all results from this job to the main results array
            results.push(...jobResults);
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'No optimization results found in completed jobs' });
        }

        // Filter to only best results if requested
        const bestOnly = req.query.bestOnly === 'true';
        const filteredResults = bestOnly ? results.filter(r => r.isBestResult) : results;

        // Generate CSV content with enhanced model information and normalized metrics
        const csvHeaders = [
            'Dataset Name',
            'Job ID', 'SKU', 'Model ID', 'Model Display Name', 'Model Category', 'Model Description', 
            'Is Seasonal', 'Method', 'Reason', 'Batch ID',
            'Created At', 'Completed At', 'Duration (seconds)',
            'Parameters', 'Accuracy (%)', 'MAPE', 'RMSE', 'MAE',
            'Normalized Accuracy', 'Normalized MAPE', 'Normalized RMSE', 'Normalized MAE',
            'Composite Score', 'MAPE Weight', 'RMSE Weight', 'MAE Weight', 'Accuracy Weight',
            'Success', 'Error', 'Training Data Size', 'Validation Data Size', 'Is Best Result'
        ];
        
        const csvRows = filteredResults.map(result => {
            // For ARIMA/SARIMA, if parameters include 'auto: true' and also fitted p/d/q (and for SARIMA: P/D/Q/s), export those instead of just 'auto'
            let paramObj;
            try {
              paramObj = typeof result.parameters === 'string' ? JSON.parse(result.parameters) : result.parameters;
            } catch (e) {
              paramObj = result.parameters;
            }
            if ((result.modelId === 'arima' || result.modelId === 'sarima') && paramObj && paramObj.auto === true) {
              // Remove 'auto' and 'verbose', keep only numeric params
              const filtered = {};
              for (const key of Object.keys(paramObj)) {
                if (['p','d','q','P','D','Q','s'].includes(key) && typeof paramObj[key] === 'number') {
                  filtered[key] = paramObj[key];
                }
              }
              // If we found any numeric params, use them; else fallback to original
              result.parameters = Object.keys(filtered).length > 0 ? JSON.stringify(filtered) : result.parameters;
            }
            return [
              // ... existing code ...
            result.datasetName || (result.datasetIdentifier ? (result.datasetIdentifier.split('/').pop() || '').replace(/\.(csv|json)$/i, '') : ''),
            result.jobId,
            result.sku,
            result.modelId,
            result.modelDisplayName,
            result.modelCategory,
            result.modelDescription,
            result.isSeasonal ? 'Yes' : 'No',
            result.method,
            result.reason,
            result.batchId,
            result.created_at,
            result.completed_at,
            result.duration,
            result.parameters,
            result.accuracy,
            result.mape,
            result.rmse,
            result.mae,
            result.normAccuracy?.toFixed(4) || '',
            result.normMAPE?.toFixed(4) || '',
            result.normRMSE?.toFixed(4) || '',
            result.normMAE?.toFixed(4) || '',
            result.compositeScore?.toFixed(4) || '',
            weights.mape,
            weights.rmse,
            weights.mae,
            weights.accuracy,
            result.success,
            result.error,
            result.trainingDataSize,
            result.validationDataSize,
            result.isBestResult
            ];
        });
        
        getCsvSeparator((separator) => {
          const csvContent = [
                csvHeaders.join(separator),
                ...csvRows.map(row => row.map(cell => {
                    // Escape separators and quotes in CSV
                    if (typeof cell === 'string' && (cell.includes(separator) || cell.includes('"') || cell.includes('\n'))) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
                }).join(separator))
            ].join('\n');
        
        // Set response headers for CSV download
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const methodSuffix = method && method !== 'all' ? `-${method}` : '';
        const filename = `optimization-results${methodSuffix}-${timestamp}.csv`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
        });
        
    } catch (error) {
        console.error('Error processing optimization results:', error);
        res.status(500).json({ error: 'Failed to process optimization results', details: error.message });
    }
});});// Settings endpoints
router.get('/settings', (req, res) => {
  const userId = 1; // or whatever your test user's id is
  pgPool.query(    SELECT key, value, description FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key LIKE 'global_%'  , [], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to get settings' });
    }// Convert rows to settings object
const settings = {};
result.rows.forEach(row => {
  try {
    settings[row.key] = JSON.parse(row.value);
  } catch (e) {
    settings[row.key] = row.value;
  }
});

// Provide defaults for missing settings
const defaultSettings = {
  global_frequency: settings.global_frequency || 'monthly',
  global_seasonalPeriods: settings.global_seasonalPeriods || 12,
  global_autoDetectFrequency: settings.global_autoDetectFrequency !== false, // default to true
  global_csvSeparator: settings.global_csvSeparator || ','
};

res.json(defaultSettings);  });
});router.post('/settings', (req, res) => {
  const userId = 1; // or whatever your test user's id is
  const { frequency, seasonalPeriods, autoDetectFrequency, csvSeparator } = req.body;  const settingsToUpdate = [
    { key: 'global_frequency', value: JSON.stringify(frequency), description: 'Data frequency (daily, weekly, monthly, quarterly, yearly)' },
    { key: 'global_seasonalPeriods', value: JSON.stringify(seasonalPeriods), description: 'Number of periods in each season' },
    { key: 'global_autoDetectFrequency', value: JSON.stringify(autoDetectFrequency), description: 'Whether to automatically detect frequency from dataset' },
    { key: 'global_csvSeparator', value: JSON.stringify(csvSeparator), description: 'Default CSV separator for import/export' }
  ];  let completed = 0;
  let hasError = false;  settingsToUpdate.forEach(setting => {
    pgPool.query(      INSERT INTO settings (key, value, description, updated_at)        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)               ON CONFLICT (key)                DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP    , [setting.key, setting.value, setting.description], (err, result) => {
        if (err) {
          console.error('Database error:', err);
          hasError = true;
        }
        completed++;    if (completed === settingsToUpdate.length) {
      if (hasError) {
        res.status(500).json({ error: 'Failed to update settings' });
      } else {
        res.json({ success: true, message: 'Settings updated successfully' });
      }
    }
  });  });
});// Helper function to get seasonal periods from frequency
function getSeasonalPeriodsFromFrequency(frequency) {
  switch (frequency) {
    case 'daily': return 7; // weekly seasonality
    case 'weekly': return 52; // yearly seasonality
    case 'monthly': return 12; // yearly seasonality
    case 'quarterly': return 4; // yearly seasonality
    case 'yearly': return 1; // no seasonality
    default: return 12; // default to monthly
  }
}// Helper function to get CSV separator from user_settings
function getCsvSeparator(callback) {
  pgPool.query(    SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_csvSeparator'  , [], (err, result) => {
    if (err || result.rows.length === 0) {
      callback(','); // default to comma
    } else {
      try {
        const separator = JSON.parse(result.rows[0].value);
        callback(separator);
      } catch (e) {
        callback(','); // fallback to comma
      }
    }
  });
}// Endpoint to update frequency in dataset summary
router.post('/update-dataset-frequency', async (req, res) => {
  const { datasetIdentifier, frequency } = req.body;  // Support both old datasetIdentifier and new datasetIdentifier for backward compatibility
  const effectiveDatasetIdentifier = datasetIdentifier;  if (!effectiveDatasetIdentifier || !frequency) return res.status(400).json({ error: 'Missing datasetIdentifier or frequency' });  try {
    // Extract dataset ID from datasetIdentifier (assuming format like "dataset_15" or similar)
    const datasetIdMatch = effectiveDatasetIdentifier.match(/dataset_(\d+)/);
    if (!datasetIdMatch) {
      return res.status(400).json({ error: 'Invalid datasetIdentifier format. Expected dataset ID.' });
    }const datasetId = parseInt(datasetIdMatch[1]);

// Update dataset metadata with new frequency
const updateQuery = `
  UPDATE datasets 
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb), 
    '{summary,frequency}', 
    $1::jsonb
  )
  WHERE id = $2
`;

const result = await pgPool.query(updateQuery, [JSON.stringify(frequency), datasetId]);

if (result.rowCount === 0) {
  return res.status(404).json({ error: 'Dataset not found' });
}

res.json({ success: true, frequency });  } catch (err) {
    console.error('Error updating frequency:', err);
    res.status(500).json({ error: 'Failed to update frequency' });
  }
});// Endpoint to re-run auto frequency inference and update summary
router.post('/auto-detect-dataset-frequency', async (req, res) => {
  const { datasetIdentifier} = req.body;  const effectiveDatasetIdentifier = datasetIdentifier;  if (!effectiveDatasetIdentifier) return res.status(400).json({ error: 'Missing datasetIdentifier' });  try {
    // Extract dataset ID from datasetIdentifier (assuming format like "dataset_15" or similar)
    const datasetIdMatch = effectiveDatasetIdentifier.match(/dataset_(\d+)/);
    if (!datasetIdMatch) {
      return res.status(400).json({ error: 'Invalid datasetIdentifier format. Expected dataset ID.' });
    }const datasetId = parseInt(datasetIdMatch[1]);

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
  WHERE id = $2
`;

await pgPool.query(updateQuery, [JSON.stringify(frequency), datasetId]);

res.json({ success: true, frequency });  } catch (err) {
    console.error('Error auto-detecting frequency:', err);
    res.status(500).json({ error: 'Failed to auto-detect frequency' });
  }
});// Enhanced forecast generation endpoint with hierarchical structure
router.post('/forecast/generate', async (req, res) => {
  try {
    const { 
      sku, // Can be string or array of strings
      data, 
      models, 
      forecastPeriods, // Can be number or array of numbers
      datasetIdentifier,
      companyId = 'default_company', // New: company identifier
      method = 'manual' // New: method type (manual, grid, ai)
    } = req.body;if (!sku || !data || !models) {
  return res.status(400).json({ error: 'Missing required fields: sku, data, models' });
}

// Handle multiple SKUs
const skus = Array.isArray(sku) ? sku : [sku];

// Handle multiple forecast periods
const periods = Array.isArray(forecastPeriods) ? forecastPeriods : [forecastPeriods || 12];

// Filter enabled models
const enabledModels = models.filter(m => m.enabled);
if (enabledModels.length === 0) {
  return res.status(400).json({ error: 'No enabled models found' });
}

// Get column mapping from file metadata
let skuColumnName = 'Material Code';
let dateColumnName = 'Date';
let salesColumnName = 'Sales';

if (datasetIdentifier) {
  try {
    const resolvedFilePath = datasetIdentifier.startsWith(UPLOADS_DIR) ? datasetIdentifier : path.join(UPLOADS_DIR, path.basename(datasetIdentifier));
    if (fs.existsSync(resolvedFilePath)) {
      const fileData = JSON.parse(fs.readFileSync(resolvedFilePath, 'utf8'));
      if (fileData.columnRoles && fileData.columns) {
        const materialCodeIndex = fileData.columnRoles.indexOf('Material Code');
        const dateIndex = fileData.columnRoles.indexOf('Date');
        const salesIndex = fileData.columnRoles.indexOf('Sales');
        if (materialCodeIndex !== -1) {
          skuColumnName = fileData.columns[materialCodeIndex];
        }
        if (dateIndex !== -1) {
          dateColumnName = fileData.columns[dateIndex];
        }
        if (salesIndex !== -1) {
          salesColumnName = fileData.columns[salesIndex];
        }
      }
    }
  } catch (error) {
    console.warn('[Forecast API] Could not load column mapping from file:', error.message);
  }
}

// Prepare hierarchical results structure
const results = [];

// Process each SKU
for (const currentSku of skus) {
  // Filter data for the specific SKU
  const skuData = data.filter(d => String(d[skuColumnName] || d['Material Code']) === currentSku);
  if (skuData.length === 0) {
    console.warn(`[Forecast API] No data found for SKU: ${currentSku}`);
    continue;
  }

  // Sort data by date
  const sortedData = skuData.sort((a, b) => 
    new Date(a[dateColumnName] || a['Date']).getTime() - new Date(b[dateColumnName] || b['Date']).getTime()
  );
  
  // Get the last date to generate forecast dates from
  const lastDate = new Date(Math.max(...sortedData.map(d => new Date(d[dateColumnName] || d['Date']).getTime())));
  
  // Detect data frequency
  const frequency = inferDateFrequency(sortedData.map(d => d[dateColumnName] || d['Date']));

  // Process each model
  for (const model of enabledModels) {
    try {
      // Get seasonal period for seasonal models
      const seasonalPeriod = model.parameters?.seasonalPeriod || 
        (model.id.includes('seasonal') || model.id === 'holt_winters' || model.id === 'sarima' ? 12 : 1);
      
      const instance = await modelFactory.createModel(model.id, model.parameters, seasonalPeriod);

      // Train the model
      await instance.train(sortedData);

      // Create method structure
      const methodId = `${method}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const methodResult = {
        methodId,
        methodType: method,
        periods: []
      };

      // Generate forecasts for each period
      for (const period of periods) {
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

          // Calculate accuracy metrics (simplified)
          const recentActual = sortedData.slice(-Math.min(10, sortedData.length)).map(d => d[salesColumnName] || d['Sales']);
          const syntheticPredicted = predictions.slice(0, recentActual.length);
          
          // Simple accuracy calculation (you can enhance this)
          const accuracy = recentActual.length > 0 ? 
            Math.max(0, 100 - Math.abs((recentActual[recentActual.length - 1] - syntheticPredicted[syntheticPredicted.length - 1]) / recentActual[recentActual.length - 1] * 100)) : 
            0;

          // Create period result
          const periodId = `period_${period}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const periodResult = {
            periodId,
            periods: period,
            parameters: model.parameters,
            accuracy,
            generatedAt: new Date().toISOString(),
            predictions: formattedPredictions
          };

          methodResult.periods.push(periodResult);

        } catch (periodError) {
          console.error(`[Forecast API] Error generating forecast for period ${period}:`, periodError.message);
          // Add error period result
          const periodId = `period_${period}_error_${Date.now()}`;
          methodResult.periods.push({
            periodId,
            periods: period,
            parameters: model.parameters,
            error: periodError.message,
            generatedAt: new Date().toISOString(),
            predictions: []
          });
        }
      }

      // Create forecast result
      const forecastResult = {
        sku: currentSku,
        modelId: model.id,
        modelName: model.name || model.id,
        datasetIdentifier,
        companyId,
        methods: [methodResult],
        generatedAt: new Date().toISOString()
      };

      results.push(forecastResult);

    } catch (modelError) {
      console.error(`[Forecast API] Error generating forecasts for model ${model.id}:`, modelError.message);
      
      // Add error result
      results.push({
        sku: currentSku,
        modelId: model.id,
        modelName: model.name || model.id,
        datasetIdentifier,
        companyId,
        methods: [{
          methodId: `${method}_error_${Date.now()}`,
          methodType: method,
          periods: [],
          error: modelError.message
        }],
        generatedAt: new Date().toISOString()
      });
    }
  }
}

res.json({ 
  results,
  metadata: {
    companyId,
    datasetIdentifier,
    totalSKUs: skus.length,
    totalModels: enabledModels.length,
    totalPeriods: periods.length,
    generatedAt: new Date().toISOString()
  }
});  } catch (error) {
    console.error('[Forecast API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});// Endpoint to load cleaning metadata from database
router.get('/load-cleaning-metadata', async (req, res) => {
  try {
    const { datasetIdentifier} = req.query;const effectiveDatasetIdentifier = datasetIdentifier;

console.log('[load-cleaning-metadata] Received request with datasetIdentifier:', effectiveDatasetIdentifier);

if (!effectiveDatasetIdentifier) {
  return res.status(400).json({ 
    error: 'Missing datasetIdentifier parameter',
    details: 'datasetIdentifier is required to load cleaning metadata'
  });
}

// Extract dataset ID from datasetIdentifier (assuming format like "dataset_15" or similar)
const datasetIdMatch = effectiveDatasetIdentifier.match(/dataset_(\d+)/);
if (!datasetIdMatch) {
  console.log('[load-cleaning-metadata] Invalid datasetIdentifier format:', effectiveDatasetIdentifier);
  return res.status(400).json({ 
    error: 'Invalid datasetIdentifier format', 
    details: 'Expected datasetIdentifier to contain dataset ID (e.g., dataset_15)'
  });
}

const datasetId = parseInt(datasetIdMatch[1]);
console.log('[load-cleaning-metadata] Extracted dataset ID:', datasetId);

// Query the dataset metadata from database
const query = `
  SELECT metadata
  FROM datasets
  WHERE id = $1
`;

const result = await pgPool.query(query, [datasetId]);

if (result.rows.length === 0) {
  console.log('[load-cleaning-metadata] Dataset not found with ID:', datasetId);
  return res.status(404).json({ 
    error: 'Dataset not found',
    details: `Dataset with ID ${datasetId} not found`
  });
}

const metadata = result.rows[0].metadata || {};
console.log('[load-cleaning-metadata] Found dataset, metadata keys:', Object.keys(metadata));

// Return the cleaning metadata (or empty object if none exists)
const cleaningMetadata = metadata.cleaningMetadata || {
  version: 1,
  lastUpdated: null,
  operations: [],
  activeCorrections: {}
};

res.status(200).json({ 
  success: true,
  cleaningMetadata,
  datasetIdentifier: datasetIdentifier,
  datasetId: datasetId
});  } catch (error) {
    console.error('[load-cleaning-metadata] Error:', error);
    res.status(500).json({ 
      error: 'Failed to load cleaning metadata', 
      details: error.message 
    });
  }
});// Enhanced forecast store management endpoints
router.post('/forecast/store', async (req, res) => {
  try {
    const { 
      companyId, 
      datasetIdentifier, 
      sku, 
      modelId, 
      methodId, 
      periodId, 
      methodType,
      periods,
      parameters,
      accuracy,
      predictions,
      optimizationId,
      isFinalForecast = false
    } = req.body;if (!companyId || !datasetIdentifier || !sku || !modelId || !methodId || !periodId || !methodType || !periods || !parameters || !predictions) {
  return res.status(400).json({ 
    error: 'Missing required fields: companyId, datasetIdentifier, sku, modelId, methodId, periodId, methodType, periods, parameters, predictions' 
  });
}

// Generate forecast hash for deduplication
const forecastHash = generateForecastHash(companyId, datasetIdentifier, sku, modelId, methodType, periods, parameters, optimizationId);

// Check if forecast with same hash already exists
const existingForecast = await checkExistingForecast(forecastHash);

if (existingForecast) {
  console.log(`[Forecast Store API] Forecast with hash ${forecastHash.slice(0, 8)}... already exists, skipping storage`);
  return res.json({ 
    success: true, 
    message: 'Forecast already exists (deduplicated)',
    existingForecastId: existingForecast.id,
    isFinalForecast: existingForecast.isFinalForecast
  });
}

// If this is a final forecast, first unmark any existing final forecast for this company/datasetIdentifier/SKU
if (isFinalForecast) {
  try {
    await new Promise((resolve, reject) => {
      pgPool.query(`
        UPDATE forecasts 
        SET isFinalForecast = 0, updated_at = CURRENT_TIMESTAMP
        WHERE companyId = $1 AND datasetIdentifier = $2 AND sku = $3 AND isFinalForecast = 1
      `, [companyId, datasetIdentifier, sku], (err, result) => {
        if (err) reject(err);
        resolve({ changes: result.rowCount });
      });
    });
    console.log(`[Forecast Store API] Unmarked existing final forecast for ${companyId}/${datasetIdentifier}/${sku}`);
  } catch (unmarkError) {
    console.error('[Forecast Store API] Error unmarking existing final forecast:', unmarkError);
    // Continue anyway, the unique constraint will handle it
  }
}

// Store in database
const insertStmt = pgPool.query(`
  INSERT INTO forecasts (generated_by, generated_by, 
    companyId, datasetIdentifier, sku, modelId, methodId, periodId, 
    methodType, periods, parameters, predictions, 
    optimizationId, forecastHash, isFinalForecast, generatedAt
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
`, [
  companyId,
  datasetIdentifier,
  sku,
  modelId,
  methodId,
  periodId,
  methodType,
  periods,
  JSON.stringify(parameters),
  
  JSON.stringify(predictions),
  optimizationId || null,
  forecastHash,
  isFinalForecast ? 1 : 0,
  new Date().toISOString()
]);

insertStmt.then(result => {
  if (result.rowCount === 0) {
    if (result.command === 'INSERT') {
      console.error('[Forecast Store API] Unique constraint violation - final forecast already exists for this company/datasetIdentifier/SKU');
      res.status(409).json({ 
        error: 'Final forecast already exists for this company/datasetIdentifier/SKU combination',
        details: 'Only one final forecast allowed per company/datasetIdentifier/SKU'
      });
    } else {
      console.error('[Forecast Store API] Error storing forecast:', result.error);
      res.status(500).json({ error: 'Failed to store forecast' });
    }
  } else {
    res.json({ 
      success: true, 
      message: 'Forecast stored successfully',
      forecastHash: forecastHash.slice(0, 8) + '...',
      isFinalForecast
    });
  }
}).catch(error => {
  console.error('[Forecast Store API] Error:', error);
  res.status(500).json({ error: error.message });
});  } catch (error) {
    console.error('[Forecast Store API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});router.get('/forecast/store', async (req, res) => {
  try {
    const { 
      companyId, 
      datasetIdentifier, 
      sku, 
      modelId, 
      methodId, 
      periodId 
    } = req.query;if (!companyId || !datasetIdentifier) {
  return res.status(400).json({ 
    error: 'Missing required fields: companyId, datasetIdentifier' 
  });
}

// Build query with optional filters
let query = `
  SELECT * FROM forecasts WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1 
  WHERE companyId = $1 AND datasetIdentifier = $2
`;
const params = [companyId, datasetIdentifier];

if (sku) {
  query += ' AND sku = $3';
  params.push(sku);
}
if (modelId) {
  query += ' AND modelId = $4';
  params.push(modelId);
}
if (methodId) {
  query += ' AND methodId = $5';
  params.push(methodId);
}
if (periodId) {
  query += ' AND periodId = $6';
  params.push(periodId);
}

query += ' ORDER BY generatedAt DESC';

const result = await pgPool.query(query, params);

// Parse JSON fields
const parsedForecasts = result.rows.map(forecast => ({
  ...forecast,
  parameters: JSON.parse(forecast.parameters),
  predictions: JSON.parse(forecast.predictions)
}));

res.json({ 
  success: true, 
  forecasts: parsedForecasts,
  count: parsedForecasts.length,
  filters: { companyId, datasetIdentifier, sku, modelId, methodId, periodId }
});  } catch (error) {
    console.error('[Forecast Store API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});// Mark forecast as final (used for demand planning)
router.put('/forecast/store/final', async (req, res) => {
  try {
    const { 
      companyId, 
      datasetIdentifier, 
      sku, 
      modelId, 
      methodId, 
      periodId,
      isFinalForecast = true
    } = req.body;if (!companyId || !datasetIdentifier || !sku) {
  return res.status(400).json({ 
    error: 'Missing required fields: companyId, datasetIdentifier, sku' 
  });
}

// First, unmark all other forecasts for this company/datasetIdentifier/SKU as final
const unmarkQuery = `
  UPDATE forecasts 
  SET isFinalForecast = 0, updated_at = CURRENT_TIMESTAMP
  WHERE companyId = $1 AND datasetIdentifier = $2 AND sku = $3 AND isFinalForecast = 1
`;

const unmarkResult = await new Promise((resolve, reject) => {
  pgPool.query(unmarkQuery, [companyId, datasetIdentifier, sku], (err, result) => {
    if (err) reject(err);
    resolve({ changes: result.rowCount });
  });
});

console.log(`[Forecast Store API] Unmarked ${unmarkResult.changes} existing final forecasts for ${companyId}/${datasetIdentifier}/${sku}`);

// Then mark the specified forecast as final
let markQuery = `
  UPDATE forecasts 
  SET isFinalForecast = $1, updated_at = CURRENT_TIMESTAMP
  WHERE companyId = $2 AND datasetIdentifier = $3 AND sku = $4
`;
const markParams = [isFinalForecast ? 1 : 0, companyId, datasetIdentifier, sku];

if (modelId) {
  markQuery += ' AND modelId = $5';
  markParams.push(modelId);
}
if (methodId) {
  markQuery += ' AND methodId = $6';
  markParams.push(methodId);
}
if (periodId) {
  markQuery += ' AND periodId = $7';
  markParams.push(periodId);
}

const result = await new Promise((resolve, reject) => {
  pgPool.query(markQuery, markParams, (err, result) => {
    if (err) reject(err);
    resolve({ changes: result.rowCount });
  });
});

res.json({ 
  success: true, 
  updatedCount: result.changes,
  message: isFinalForecast ? 'Forecast marked as final' : 'Forecast unmarked as final',
  filters: { companyId, datasetIdentifier, sku, modelId, methodId, periodId }
});  } catch (error) {
    console.error('[Forecast Store API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});// Check final forecast status for a specific company/datasetIdentifier/SKU
router.get('/forecast/store/final/status', async (req, res) => {
  try {
    const { 
      companyId, 
      datasetIdentifier, 
      sku 
    } = req.query;if (!companyId || !datasetIdentifier || !sku) {
  return res.status(400).json({ 
    error: 'Missing required fields: companyId, datasetIdentifier, sku' 
  });
}

const existingFinal = await checkExistingFinalForecast(companyId, datasetIdentifier, sku);

res.json({ 
  success: true, 
  hasFinalForecast: !!existingFinal,
  finalForecast: existingFinal ? {
    id: existingFinal.id,
    modelId: existingFinal.modelId,
    methodType: existingFinal.methodType,
    periods: existingFinal.periods,
    generatedAt: existingFinal.generatedAt
  } : null,
  companyId,
  datasetIdentifier,
  sku
});  } catch (error) {
    console.error('[Forecast Store API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});// Get final forecasts for demand planning
router.get('/forecast/store/final', async (req, res) => {
  try {
    const { 
      companyId, 
      datasetIdentifier, 
      sku 
    } = req.query;if (!companyId) {
  return res.status(400).json({ 
    error: 'Missing required field: companyId' 
  });
}

// Build query to get final forecasts
let query = `
  SELECT * FROM forecasts WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1 
  WHERE companyId = $1 AND isFinalForecast = 1
`;
const params = [companyId];

if (datasetIdentifier) {
  query += ' AND datasetIdentifier = $2';
  params.push(datasetIdentifier);
}
if (sku) {
  query += ' AND sku = $3';
  params.push(sku);
}

query += ' ORDER BY generatedAt DESC';

const result = await pgPool.query(query, params);

// Parse JSON fields and group by SKU
const parsedForecasts = result.rows.map(forecast => ({
  ...forecast,
  parameters: JSON.parse(forecast.parameters),
  predictions: JSON.parse(forecast.predictions)
}));

// Group by SKU for easier consumption
const groupedBySku = {};
parsedForecasts.forEach(forecast => {
  if (!groupedBySku[forecast.sku]) {
    groupedBySku[forecast.sku] = [];
  }
  groupedBySku[forecast.sku].push(forecast);
});

res.json({ 
  success: true, 
  finalForecasts: groupedBySku,
  count: parsedForecasts.length,
  filters: { companyId, datasetIdentifier, sku }
});  } catch (error) {
    console.error('[Forecast Store API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});router.delete('/forecast/store', async (req, res) => {
  try {
    const { 
      companyId, 
      datasetIdentifier, 
      sku, 
      modelId, 
      methodId, 
      periodId 
    } = req.query;if (!companyId || !datasetIdentifier) {
  return res.status(400).json({ 
    error: 'Missing required fields: companyId, datasetIdentifier' 
  });
}

// Build delete query with optional filters
let query = `
  DELETE FROM forecasts 
  WHERE companyId = $1 AND datasetIdentifier = $2
`;
const params = [companyId, datasetIdentifier];

if (sku) {
  query += ' AND sku = $3';
  params.push(sku);
}
if (modelId) {
  query += ' AND modelId = $4';
  params.push(modelId);
}
if (methodId) {
  query += ' AND methodId = $5';
  params.push(methodId);
}
if (periodId) {
  query += ' AND periodId = $6';
  params.push(periodId);
}

const result = await new Promise((resolve, reject) => {
  pgPool.query(query, params, (err, result) => {
    if (err) reject(err);
    resolve({ changes: result.rowCount });
  });
});

res.json({ 
  success: true, 
  deletedCount: result.changes,
  message: 'Forecasts deleted successfully',
  filters: { companyId, datasetIdentifier, sku, modelId, methodId, periodId }
});  } catch (error) {
    console.error('[Forecast Store API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});// Endpoint to get forecasts generated during optimization
router.get('/forecast/optimization/:optimizationId', async (req, res) => {
  try {
    const { optimizationId } = req.params;
    const { sku, datasetIdentifier, companyId = 'default_company' } = req.query;if (!optimizationId || !sku || !datasetIdentifier) {
  return res.status(400).json({ 
    error: 'Missing required fields: optimizationId, sku, datasetIdentifier' 
  });
}

// Get forecasts from database for this optimization ID
const forecasts = await new Promise((resolve, reject) => {
  pgPool.query(`
    SELECT * FROM forecasts WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1 
    WHERE optimizationId = $1 AND sku = $2 AND datasetIdentifier = $3 AND companyId = $4
    ORDER BY modelId, methodType, periods, generatedAt DESC
  `, [optimizationId, sku, datasetIdentifier, companyId], (err, result) => {
    if (err) reject(err);
    resolve(result.rows);
  });
});

if (forecasts.length === 0) {
  return res.status(404).json({ 
    error: 'No forecasts found for this optimization ID' 
  });
}

// Group forecasts by model and method
const groupedForecasts = {};
forecasts.forEach(forecast => {
  const key = `${forecast.modelId}_${forecast.methodType}`;
  if (!groupedForecasts[key]) {
    groupedForecasts[key] = {
      sku: forecast.sku,
      modelId: forecast.modelId,
      modelName: forecast.modelId, // Could be enhanced with model metadata
      datasetIdentifier: forecast.datasetIdentifier,
      companyId: forecast.companyId,
      methods: [{
        methodId: forecast.methodId,
        methodType: forecast.methodType,
        periods: []
      }],
      generatedAt: forecast.generatedAt,
      optimizationId: forecast.optimizationId
    };
  }

  // Add period to the method
  const method = groupedForecasts[key].methods[0];
  method.periods.push({
    periodId: forecast.periodId,
    periods: forecast.periods,
    parameters: JSON.parse(forecast.parameters),
    
    generatedAt: forecast.generatedAt,
    predictions: JSON.parse(forecast.predictions)
  });
});

const result = Object.values(groupedForecasts);

res.json({ 
  success: true, 
  forecasts: result,
  metadata: {
    optimizationId,
    sku,
    datasetIdentifier,
    companyId,
    totalForecasts: result.length,
    generatedAt: new Date().toISOString()
  }
});  } catch (error) {
    console.error('[Forecast API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});// Duplicate save-cleaned-data endpoint removed - using the database-based version aboveconst methodPrettyNames = {
  grid: { displayName: 'Grid Search', shortName: 'Grid' },
  ai: { displayName: 'AI Optimization', shortName: 'AI' },
  // Add more if needed
};// Generate optimization hash for job deduplication
function generateOptimizationHash(sku, modelId, method, datasetIdentifier, parameters = {}, metricWeights = null) {
  // Get default metric weights if not provided
  if (!metricWeights) {
    metricWeights = { mape: 0.4, rmse: 0.3, mae: 0.2, accuracy: 0.1 };
  }  // Create hash input object
  // Note: seasonalPeriod is already included in parameters for seasonal models
  const hashInput = {
    sku,
    modelId,
    method,
    dataHash: datasetIdentifier, // Using datasetIdentifier as data identifier
    parameters: parameters || {},
    metricWeights
  };  // Generate SHA-256 hash using js-sha256 for consistency with frontend
  return sha256(JSON.stringify(hashInput));
}// Generate forecast hash for forecast deduplication
function generateForecastHash(companyId, datasetIdentifier, sku, modelId, methodType, periods, parameters, optimizationId = null) {
  // Create hash input object
  const hashInput = {
    companyId,
    datasetIdentifier,
    sku,
    modelId,
    methodType,
    periods,
    parameters: parameters || {},
    optimizationId
  };  // Generate SHA-256 hash using js-sha256 for consistency
  return sha256(JSON.stringify(hashInput));
}// Check if a job with the same optimization hash already exists
  function checkExistingOptimizationJob(optimizationHash, userId = 'default_user') {
    return new Promise((resolve, reject) => {
      pgPool.query(        SELECT id, status FROM optimization_jobs WHERE optimization_hash = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1      , [optimizationHash, userId], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.rows[0]);
      }
    });
  });
}// Check if a forecast with the same hash already exists
function checkExistingForecast(forecastHash) {
  return new Promise((resolve, reject) => {
          pgPool.query(        SELECT id, isFinalForecast, generatedAt FROM forecasts WHERE company_id = 1 AND forecastHash = $1 ORDER BY generatedAt DESC LIMIT 1      , [forecastHash], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.rows[0]);
      }
    });
  });
}// Check if a final forecast already exists for a company/datasetIdentifier/SKU combination
function checkExistingFinalForecast(companyId, datasetIdentifier, sku) {
  return new Promise((resolve, reject) => {
          pgPool.query(        SELECT id, modelId, methodType, periods, generatedAt FROM forecasts WHERE company_id = $1 AND datasetIdentifier = $2 AND sku = $3 AND isFinalForecast = 1      , [companyId, datasetIdentifier, sku], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.rows[0]);
      }
    });
  });
}// Trend Lines API endpoints
router.post('/trend-lines', async (req, res) => {
  try {
    const trendLine = req.body;// Validate required fields
if (!trendLine.startDate || !trendLine.endDate || !trendLine.datasetIdentifier || !trendLine.sku) {
  return res.status(400).json({ error: 'Missing required fields' });
}

console.log('[TrendLines API] Saving trend line:', trendLine);

// Insert into database using proper transaction
pgPool.query(`
  INSERT INTO trend_lines (
    id, start_index, end_index, start_value, end_value, 
    start_date, end_date, label, created_at, file_path, sku, model_id
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
`, [
  trendLine.id,
  trendLine.startIndex,
  trendLine.endIndex,
  trendLine.startValue,
  trendLine.endValue,
  trendLine.startDate,
  trendLine.endDate,
  trendLine.label,
  trendLine.createdAt,
  trendLine.datasetIdentifier,
  trendLine.sku,
  trendLine.modelId || null
]).then(result => {
  if (result.rowCount === 0) {
    console.error('[TrendLines API] Error saving trend line:', result.error);
    pgPool.query(`ROLLBACK`);
    res.status(500).json({ error: 'Failed to save trend line' });
  } else {
    console.log('[TrendLines API] Trend line saved successfully with ID:', trendLine.id);
    pgPool.query(`COMMIT`);
    res.json({ success: true, id: trendLine.id });
  }
}).catch(error => {
  console.error('[TrendLines API] Error in POST /trend-lines:', error);
  pgPool.query(`ROLLBACK`);
  res.status(500).json({ error: 'Failed to save trend line' });
});  } catch (error) {
    console.error('[TrendLines API] Error in POST /trend-lines:', error);
    pgPool.query(ROLLBACK);
    res.status(500).json({ error: 'Failed to save trend line' });
  }
});router.get('/trend-lines', async (req, res) => {
  try {
    const { datasetIdentifier, sku } = req.query;console.log('[TrendLines API] Loading trend lines for:', { datasetIdentifier, sku });

let query = 'SELECT * FROM trend_lines WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1';
const params = [];

if (datasetIdentifier && sku) {
  query += ' WHERE file_path = $1 AND sku = $2';
  params.push(datasetIdentifier, sku);
} else if (datasetIdentifier) {
  query += ' WHERE file_path = $1';
  params.push(datasetIdentifier);
} else if (sku) {
  query += ' WHERE sku = $1';
  params.push(sku);
}

query += ' ORDER BY created_at DESC';

console.log('[TrendLines API] Query:', query, 'Params:', params);

pgPool.query(query, params, (err, result) => {
  if (err) {
    console.error('[TrendLines API] Error loading trend lines:', err);
    res.status(500).json({ error: 'Failed to load trend lines' });
  } else {
    console.log('[TrendLines API] Loaded trend lines:', result.rows);
    res.json(result.rows || []);
  }
});  } catch (error) {
    console.error('[TrendLines API] Error in GET /trend-lines:', error);
    res.status(500).json({ error: 'Failed to load trend lines' });
  }
});router.delete('/trend-lines/:id', async (req, res) => {
  try {
    const { id } = req.params;console.log('[TrendLines API] Deleting trend line with ID:', id);

pgPool.query(`
  DELETE FROM trend_lines WHERE company_id = 1 AND company_id = 1 AND id = $1
`, [id], (err, result) => {
  if (err) {
    console.error('[TrendLines API] Error deleting trend line:', err);
    res.status(500).json({ error: 'Failed to delete trend line' });
  } else if (result.rowCount === 0) {
    console.log('[TrendLines API] Trend line not found for deletion:', id);
    res.status(404).json({ error: 'Trend line not found' });
  } else {
    console.log('[TrendLines API] Trend line deleted successfully:', id);
    res.json({ success: true });
  }
});  } catch (error) {
    console.error('[TrendLines API] Error in DELETE /trend-lines/:id:', error);
    res.status(500).json({ error: 'Failed to delete trend line' });
  }
});router.delete('/trend-lines', async (req, res) => {
  try {
    const { datasetIdentifier, sku } = req.query;console.log('[TrendLines API] Clearing trend lines for:', { datasetIdentifier, sku });

let query = 'DELETE FROM trend_lines';
const params = [];

if (datasetIdentifier && sku) {
  query += ' WHERE file_path = $1 AND sku = $2';
  params.push(datasetIdentifier, sku);
} else if (datasetIdentifier) {
  query += ' WHERE file_path = $1';
  params.push(datasetIdentifier);
} else if (sku) {
  query += ' WHERE sku = $1';
  params.push(sku);
} else {
  return res.status(400).json({ error: 'Must specify datasetIdentifier or sku' });
}

console.log('[TrendLines API] Clear query:', query, 'Params:', params);

pgPool.query(query, params, (err, result) => {
  if (err) {
    console.error('[TrendLines API] Error clearing trend lines:', err);
    res.status(500).json({ error: 'Failed to clear trend lines' });
  } else {
    console.log('[TrendLines API] Cleared trend lines successfully, deleted:', result.rowCount);
    res.json({ success: true, deleted: result.rowCount });
  }
});  } catch (error) {
    console.error('[TrendLines API] Error in DELETE /trend-lines:', error);
    res.status(500).json({ error: 'Failed to clear trend lines' });
  }
});// Endpoint to rename a dataset in the database
router.post('/datasets/:id/rename', async (req, res) => {
  const datasetId = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (!datasetId || !name) {
    return res.status(400).json({ error: 'datasetId and name are required' });
  }
  try {
    await pgPool.query('UPDATE datasets SET name = $1 WHERE id = $2', [name, datasetId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error renaming dataset:', error);
    res.status(500).json({ error: 'Failed to rename dataset', details: error.message });
  }
});// Forecast persistence endpoints for Zustand sync
router.get('/api/forecasts', async (req, res) => {
  try {
    const { companyId, datasetIdentifier, sku, modelId } = req.query;if (!companyId || !datasetIdentifier || !sku || !modelId) {
  return res.status(400).json({ error: 'Missing required parameters' });
}

// Extract dataset ID from datasetIdentifier
const datasetId = datasetIdentifier.startsWith('dataset_') 
  ? parseInt(datasetIdentifier.replace('dataset_', ''))
  : null;

if (!datasetId) {
  return res.status(400).json({ error: 'Invalid dataset identifier' });
}

// Query forecasts table
const query = `
  SELECT * FROM forecasts WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1 
  WHERE company_id = $1 
    AND dataset_id = $2 
    AND sku_id = (SELECT id FROM skus WHERE company_id = 1 AND company_id = 1 AND company_id = $1 AND sku_code = $3)
    AND model_id = (SELECT id FROM models WHERE company_id = 1 AND company_id = 1 AND company_id = $1 AND name = $4)
    AND is_final_forecast = true
  ORDER BY generated_at DESC 
  LIMIT 1
`;

const result = await pgPool.query(query, [companyId, datasetId, sku, modelId]);

if (result.rows.length === 0) {
  return res.status(404).json({ error: 'Forecast not found' });
}

const forecast = result.rows[0];

// Transform database format to frontend format
const transformedForecast = {
  sku,
  modelId,
  modelName: forecast.model_id,
  datasetIdentifier,
  companyId,
  methods: [{
    methodId: forecast.method,
    methodType: forecast.method_type,
    periods: [{
      periodId: forecast.period_id,
      periods: forecast.periods,
      parameters: forecast.parameters,
      
      mape: forecast.mape,
      rmse: forecast.rmse,
      mae: forecast.mae,
      generatedAt: forecast.generated_at,
      predictions: forecast.predictions
    }],
    
    mape: forecast.mape,
    rmse: forecast.rmse,
    mae: forecast.mae,
    generatedAt: forecast.generated_at
  }],
  generatedAt: forecast.generated_at
};

res.json(transformedForecast);  } catch (error) {
    console.error('Error fetching forecast:', error);
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});router.post('/api/forecasts', async (req, res) => {
  try {
    const { companyId, datasetIdentifier, sku, modelId, forecast } = req.body;if (!companyId || !datasetIdentifier || !sku || !modelId || !forecast) {
  return res.status(400).json({ error: 'Missing required parameters' });
}

// Extract dataset ID from datasetIdentifier
const datasetId = datasetIdentifier.startsWith('dataset_') 
  ? parseInt(datasetIdentifier.replace('dataset_', ''))
  : null;

if (!datasetId) {
  return res.status(400).json({ error: 'Invalid dataset identifier' });
}

// Get or create SKU
let skuResult = await pgPool.query(
  'SELECT id FROM skus WHERE company_id = 1 AND company_id = 1 AND company_id = $1 AND sku_code = $2',
  [companyId, sku]
);

let skuId;
if (skuResult.rows.length === 0) {
  const newSkuResult = await pgPool.query(
    'INSERT INTO skus (company_id, sku_code) VALUES ($1, $2) RETURNING id',
    [companyId, sku]
  );
  skuId = newSkuResult.rows[0].id;
} else {
  skuId = skuResult.rows[0].id;
}

// Get or create model
let modelResult = await pgPool.query(
  'SELECT id FROM models WHERE company_id = 1 AND company_id = 1 AND company_id = $1 AND name = $2',
  [companyId, modelId]
);

let modelId_db;
if (modelResult.rows.length === 0) {
  const newModelResult = await pgPool.query(
    'INSERT INTO models (company_id, name) VALUES ($1, $2) RETURNING id',
    [companyId, modelId]
  );
  modelId_db = newModelResult.rows[0].id;
} else {
  modelId_db = modelResult.rows[0].id;
}

// Save each method as a separate forecast record
const savedForecasts = [];

for (const method of forecast.methods) {
  for (const period of method.periods) {
    const forecastData = {
      company_id: companyId,
      dataset_id: datasetId,
      sku_id: skuId,
      model_id: modelId_db,
      method: method.methodType,
      period_id: period.periodId,
      periods: period.periods,
      parameters: period.parameters,
      
      predictions: period.predictions,
      method_type: method.methodType,
      is_final_forecast: true,
      generated_at: period.generatedAt || new Date().toISOString()
    };
    
    // Upsert forecast (update if exists, insert if not)
    const upsertQuery = `
      INSERT INTO forecasts (generated_by, generated_by, 
        company_id, dataset_id, sku_id, model_id, method, period_id, 
        periods, parameters, accuracy, predictions, method_type, 
        is_final_forecast, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (company_id, dataset_id, sku_id) 
      WHERE is_final_forecast = true
      DO UPDATE SET
        method = EXCLUDED.method,
        period_id = EXCLUDED.period_id,
        periods = EXCLUDED.periods,
        parameters = EXCLUDED.parameters,
        
        predictions = EXCLUDED.predictions,
        method_type = EXCLUDED.method_type,
        generated_at = EXCLUDED.generated_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pgPool.query(upsertQuery, [
      forecastData.company_id,
      forecastData.dataset_id,
      forecastData.sku_id,
      forecastData.model_id,
      forecastData.method,
      forecastData.period_id,
      forecastData.periods,
      JSON.stringify(forecastData.parameters),
      
      JSON.stringify(forecastData.predictions),
      forecastData.method_type,
      forecastData.is_final_forecast,
      forecastData.generated_at
    ]);
    
    savedForecasts.push(result.rows[0]);
  }
}

res.json({ 
  message: 'Forecast saved successfully',
  savedCount: savedForecasts.length,
  forecast: savedForecasts[0] // Return the first one as representative
});  } catch (error) {
    console.error('Error saving forecast:', error);
    res.status(500).json({ error: 'Failed to save forecast' });
  }
});// Batch forecast loading for pre-caching
router.post('/api/forecasts/batch', async (req, res) => {
  try {
    const { requests } = req.body; // Array of { companyId, datasetIdentifier, sku, modelId }if (!Array.isArray(requests) || requests.length === 0) {
  return res.status(400).json({ error: 'Invalid requests array' });
}

const results = [];

for (const request of requests) {
  const { companyId, datasetIdentifier, sku, modelId } = request;
  
  try {
    // Extract dataset ID
    const datasetId = datasetIdentifier.startsWith('dataset_') 
      ? parseInt(datasetIdentifier.replace('dataset_', ''))
      : null;
    
    if (!datasetId) {
      results.push({ ...request, error: 'Invalid dataset identifier' });
      continue;
    }
    
    // Query for forecast
    const query = `
      SELECT * FROM forecasts WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1 
      WHERE company_id = $1 
        AND dataset_id = $2 
        AND sku_id = (SELECT id FROM skus WHERE company_id = 1 AND company_id = 1 AND company_id = $1 AND sku_code = $3)
        AND model_id = (SELECT id FROM models WHERE company_id = 1 AND company_id = 1 AND company_id = $1 AND name = $4)
        AND is_final_forecast = true
      ORDER BY generated_at DESC 
      LIMIT 1
    `;
    
    const result = await pgPool.query(query, [companyId, datasetId, sku, modelId]);
    
    if (result.rows.length > 0) {
      const forecast = result.rows[0];
      const transformedForecast = {
        sku,
        modelId,
        modelName: forecast.model_id,
        datasetIdentifier,
        companyId,
        methods: [{
          methodId: forecast.method,
          methodType: forecast.method_type,
          periods: [{
            periodId: forecast.period_id,
            periods: forecast.periods,
            parameters: forecast.parameters,
            
            mape: forecast.mape,
            rmse: forecast.rmse,
            mae: forecast.mae,
            generatedAt: forecast.generated_at,
            predictions: forecast.predictions
          }],
          
          mape: forecast.mape,
          rmse: forecast.rmse,
          mae: forecast.mae,
          generatedAt: forecast.generated_at
        }],
        generatedAt: forecast.generated_at
      };
      
      results.push({ ...request, forecast: transformedForecast });
    } else {
      results.push({ ...request, forecast: null });
    }
  } catch (error) {
    results.push({ ...request, error: error.message });
  }
}

res.json({ results });  } catch (error) {
    console.error('Error in batch forecast loading:', error);
    res.status(500).json({ error: 'Failed to load forecasts' });
  }
});// Initialize default settings endpoint
router.post('/settings/initialize', async (req, res) => {
  try {
    const defaultSettings = [
      { key: 'global_forecastPeriods', value: '[12]', description: 'Number of periods to forecast (array for multiple periods)' },
      { key: 'global_autoDetectFrequency', value: 'true', description: 'Whether to automatically detect frequency from dataset' },
      { key: 'global_csvSeparator', value: ',', description: 'Default CSV separator for import/export' },
      { key: 'global_companyId', value: 'default_company', description: 'Default company identifier' }
    ];for (const setting of defaultSettings) {
  await pgPool.query(`
    INSERT INTO settings (key, value, description, updated_at) 
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (key) 
    DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
  `, [setting.key, setting.value, setting.description]);
}

console.log(' Default settings initialized successfully');
res.json({ success: true, message: 'Default settings initialized' });  } catch (error) {
    console.error('Error initializing settings:', error);
    res.status(500).json({ error: 'Failed to initialize settings' });
  }
});// Get dataset-specific frequency and seasonal periods
router.get('/dataset/:datasetId/frequency', async (req, res) => {
  try {
    const { datasetId } = req.params;// Get dataset metadata
const metadata = await getDatasetMetadata(parseInt(datasetId));
if (!metadata) {
  return res.status(404).json({ error: 'Dataset not found' });
}

// Extract frequency from metadata
let frequency = 'monthly'; // default
let seasonalPeriods = 12; // default

if (metadata.metadata && metadata.metadata.summary && metadata.metadata.summary.frequency) {
  frequency = metadata.metadata.summary.frequency;
  seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);
}

res.json({
  datasetId: parseInt(datasetId),
  frequency,
  seasonalPeriods,
  autoDetected: !!(metadata.metadata && metadata.metadata.summary && metadata.metadata.summary.frequency)
});  } catch (error) {
    console.error('Error getting dataset frequency:', error);
    res.status(500).json({ error: 'Failed to get dataset frequency' });
  }
});// Update dataset frequency and auto-update global settings
router.post('/dataset/:datasetId/frequency', async (req, res) => {
  try {
    const { datasetId } = req.params;
    const { frequency } = req.body;if (!frequency) {
  return res.status(400).json({ error: 'Frequency is required' });
}

// Calculate seasonal periods from frequency
const seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);

// Update dataset metadata
const updateQuery = `
  UPDATE datasets 
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb), 
    '{summary,frequency}', 
    $1::jsonb
  )
  WHERE id = $2
`;

const result = await pgPool.query(updateQuery, [JSON.stringify(frequency), parseInt(datasetId)]);

if (result.rowCount === 0) {
  return res.status(404).json({ error: 'Dataset not found' });
}

// Note: We do NOT auto-update global settings here
// Dataset frequency is dataset-specific and should not override global preferences
console.log(`Dataset frequency updated to ${frequency} (seasonal periods: ${seasonalPeriods})`);

res.json({ 
  success: true, 
  datasetId: parseInt(datasetId),
  frequency, 
  seasonalPeriods,
  message: `Frequency updated to ${frequency} with ${seasonalPeriods} seasonal periods`
});  } catch (error) {
    console.error('Error updating dataset frequency:', error);
    res.status(500).json({ error: 'Failed to update dataset frequency' });
  }
});// Initialize default settings endpoint
router.post('/settings/initialize', async (req, res) => {
  try {
    const defaultSettings = [
      { key: 'global_forecastPeriods', value: '[12]', description: 'Number of periods to forecast (array for multiple periods)' },
      { key: 'global_autoDetectFrequency', value: 'true', description: 'Whether to automatically detect frequency from dataset' },
      { key: 'global_csvSeparator', value: ',', description: 'Default CSV separator for import/export' },
      { key: 'global_companyId', value: 'default_company', description: 'Default company identifier' }
    ];for (const setting of defaultSettings) {
  await pgPool.query(`
    INSERT INTO settings (key, value, description, updated_at) 
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (key) 
    DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
  `, [setting.key, setting.value, setting.description]);
}

console.log(' Default settings initialized successfully');
res.json({ success: true, message: 'Default settings initialized' });  } catch (error) {
    console.error('Error initializing settings:', error);
    res.status(500).json({ error: 'Failed to initialize settings' });
  }
});// Get dataset-specific frequency and seasonal periods
router.get('/dataset/:datasetId/frequency', async (req, res) => {
  try {
    const { datasetId } = req.params;// Get dataset metadata
const metadata = await getDatasetMetadata(parseInt(datasetId));
if (!metadata) {
  return res.status(404).json({ error: 'Dataset not found' });
}

// Extract frequency from metadata
let frequency = 'monthly'; // default
let seasonalPeriods = 12; // default

if (metadata.metadata && metadata.metadata.summary && metadata.metadata.summary.frequency) {
  frequency = metadata.metadata.summary.frequency;
  seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);
}

res.json({
  datasetId: parseInt(datasetId),
  frequency,
  seasonalPeriods,
  autoDetected: !!(metadata.metadata && metadata.metadata.summary && metadata.metadata.summary.frequency)
});  } catch (error) {
    console.error('Error getting dataset frequency:', error);
    res.status(500).json({ error: 'Failed to get dataset frequency' });
  }
});// Update dataset frequency and auto-update global settings
router.post('/dataset/:datasetId/frequency', async (req, res) => {
  try {
    const { datasetId } = req.params;
    const { frequency } = req.body;if (!frequency) {
  return res.status(400).json({ error: 'Frequency is required' });
}

// Calculate seasonal periods from frequency
const seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);

// Update dataset metadata
const updateQuery = `
  UPDATE datasets 
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb), 
    '{summary,frequency}', 
    $1::jsonb
  )
  WHERE id = $2
`;

const result = await pgPool.query(updateQuery, [JSON.stringify(frequency), parseInt(datasetId)]);

if (result.rowCount === 0) {
  return res.status(404).json({ error: 'Dataset not found' });
}

// Note: We do NOT auto-update global settings here
// Dataset frequency is dataset-specific and should not override global preferences
console.log(`Dataset frequency updated to ${frequency} (seasonal periods: ${seasonalPeriods})`);

res.json({ 
  success: true, 
  datasetId: parseInt(datasetId),
  frequency, 
  seasonalPeriods,
  message: `Frequency updated to ${frequency} with ${seasonalPeriods} seasonal periods`
});  } catch (error) {
    console.error('Error updating dataset frequency:', error);
    res.status(500).json({ error: 'Failed to update dataset frequency' });
  }
});// Auto-detect and update dataset frequency
router.post('/dataset/:datasetId/auto-detect-frequency', async (req, res) => {
  try {
    const { datasetId } = req.params;// Get time series data from database
const timeSeriesData = await getTimeSeriesData(parseInt(datasetId));
if (!timeSeriesData || timeSeriesData.length === 0) {
  return res.status(404).json({ error: 'No time series data found for dataset' });
}

// Extract dates and infer frequency
const dateList = timeSeriesData.map(row => row.date).filter(Boolean);
const uniqueDates = Array.from(new Set(dateList)).sort();
const frequency = inferDateFrequency(uniqueDates);
const seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);

// Update dataset metadata with new frequency
const updateQuery = `
  UPDATE datasets 
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb), 
    '{summary,frequency}', 
    $1::jsonb
  )
  WHERE id = $2
`;

await pgPool.query(updateQuery, [JSON.stringify(frequency), parseInt(datasetId)]);

// Note: We do NOT auto-update global settings here
// Dataset frequency is dataset-specific and should not override global preferences
console.log(`Auto-detected dataset ${datasetId} frequency: ${frequency} (seasonal periods: ${seasonalPeriods})`);

res.json({ 
  success: true, 
  datasetId: parseInt(datasetId),
  frequency, 
  seasonalPeriods,
  message: `Auto-detected frequency: ${frequency} with ${seasonalPeriods} seasonal periods`
});  } catch (error) {
    console.error('Error auto-detecting frequency:', error);
    res.status(500).json({ error: 'Failed to auto-detect frequency' });
  }
});// Add this route near other import-related routes
router.post('/check-csv-duplicate', async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData) return res.status(400).json({ error: 'Missing csvData' });// Compute hash
const csvHash = crypto.createHash('sha256').update(csvData, 'utf8').digest('hex').slice(0, 30);
const companyId = 1; // Or get from session/user

// Check for existing dataset
const existingDataset = await findDatasetByHash(companyId, csvHash);

if (existingDataset) {
  res.json({ duplicate: true, existingDataset });
} else {
  res.json({ duplicate: false });
}  } catch (err) {
    res.status(500).json({ error: 'Failed to check for duplicate', details: err.message });
  }
});export default router;

