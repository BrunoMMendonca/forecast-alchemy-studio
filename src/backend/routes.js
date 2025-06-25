import express from 'express';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { callGrokAPI } from './grokService.js';
import { applyTransformations, detectColumnRoles, normalizeAndPivotData, findField, autoDetectSeparator, transposeData, parseCsvWithHeaders } from './utils.js';
import { optimizeParametersWithAI, getModelRecommendation } from './aiOptimizationService.js';
import crypto from 'crypto';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to discard old files with the same hash
function discardOldFilesWithHash(csvHash) {
  const files = fs.readdirSync(UPLOADS_DIR);
  for (const file of files) {
    if (file.endsWith('.json') || file.endsWith('.csv')) {
      const filePath = path.join(UPLOADS_DIR, file);
      try {
        if (file.endsWith('.json')) {
          const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (jsonData.csvHash && jsonData.csvHash === csvHash) {
            const newPath = filePath.replace(/\.json$/, '_Discarded.json');
            fs.renameSync(filePath, newPath);
          }
        } else if (file.endsWith('.csv')) {
          // For CSV, try to match by timestamp in filename (Original_CSV_Upload-<timestamp>.csv)
          const match = file.match(/Original_CSV_Upload-(\d+)\.csv/);
          if (match) {
            const timestamp = match[1];
            // See if any JSON with this hash has this timestamp
            for (const jsonFile of files) {
              if (jsonFile.endsWith('.json')) {
                const jsonPath = path.join(UPLOADS_DIR, jsonFile);
                try {
                  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                  if (jsonData.csvHash === csvHash && jsonFile.includes(timestamp)) {
                    const newPath = filePath.replace(/\.csv$/, '_Discarded.csv');
                    fs.renameSync(filePath, newPath);
                  }
                } catch {}
              }
            }
          }
        }
      } catch {}
    }
  }
}

const ALL_MODELS = [
  { id: 'moving_average', parameters: { window: 3 } },
  { id: 'simple_exponential_smoothing', parameters: { alpha: 0.3 } },
  { id: 'double_exponential_smoothing', parameters: { alpha: 0.3, beta: 0.1 } },
  { id: 'linear_trend', parameters: {} },
  { id: 'seasonal_moving_average', parameters: { window: 3, seasonalPeriods: 12 }, isSeasonal: true },
  { id: 'holt_winters', parameters: { alpha: 0.3, beta: 0.1, gamma: 0.1, seasonalPeriods: 12 }, isSeasonal: true },
  { id: 'seasonal_naive', parameters: {}, isSeasonal: true }
];

const JOB_PRIORITIES = {
  SETUP: 1,
  DATA_CLEANING: 2,
  INITIAL_IMPORT: 3
};

const isModelOptimizable = (modelName, modelsConfig) => {
    const model = modelsConfig.find(m => m.id === modelName);
    return model && model.parameters && Object.keys(model.parameters).length > 0;
};

function getPriorityFromReason(reason) {
  if (reason === 'settings_change' || reason === 'config') {
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

// Read AI instructions from files
const aiInstructionsSmall = fs.readFileSync(path.join(__dirname, 'config/CSVImport/ai_csv_instructions_small.txt'), 'utf-8');
const aiInstructionsLarge = fs.readFileSync(path.join(__dirname, 'config/CSVImport/ai_csv_instructions_large.txt'), 'utf-8');

router.post('/grok-transform', async (req, res) => {
  try {
    const { csvData, reasoningEnabled } = req.body;
    //console.Log(`[LOG] /grok-transform received reasoningEnabled: ${reasoningEnabled}`);
    if (!csvData) {
      return res.status(400).json({ error: 'Missing csvData or instructions' });
    }
    //console.Log('grok-transform received instructions:', aiInstructionsSmall.substring(0, 200) + '...');
    const { data, headers } = parseCsvWithHeaders(csvData);

    const sanitizedCsvData = data.map(row => {
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
    });
  } catch (error) {
    console.error('Error in grok-transform:', error);
    res.status(500).json({ error: error.message });
  }
});

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

    const prompt = `
Context: You are processing a large CSV file of ${Math.round(fileSize / 1024)} KB.
Sample Data (first 15 records): 
${JSON.stringify(csvChunk, null, 2)}

Instructions: ${aiInstructionsLarge}

Output Format: ${outputFormat}
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
    const reasoning = parsedResponse.reasoning || 'No reasoning provided';
    
    // Handle potentially nested config object
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
    });
  } catch (error) {
    console.error('Error in grok-generate-config:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/apply-config', async (req, res) => {
  try {
    const { csvData, config } = req.body;
    if (!csvData || !config) {
      return res.status(400).json({ error: 'Missing csvData or config' });
    }

    //console.Log('apply-config received config:', JSON.stringify(config, null, 2));

    // Use the new robust parser
    const { data } = parseCsvWithHeaders(csvData);

    const { data: transformedData, columns } = applyTransformations(data, config);
    // Get column roles as objects first
    const columnRolesObjects = detectColumnRoles(columns);
    // Extract just the role strings for the frontend
    const columnRoles = columnRolesObjects.map(obj => obj.role);

    const fileName = `processed-data-${Date.now()}.json`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify({ data: transformedData, columns }, null, 2));
    
    const skuCount = transformedData.length;
    const materialCodeKey = columns[0];
    const skuList = Array.from(new Set(transformedData.map(row => row[materialCodeKey]).filter(Boolean)));
    const dateRange = columns && columns.length > 1 ? [columns[1], columns[columns.length - 1]] : ["N/A", "N/A"];

    res.status(200).json({
      message: 'Configuration applied and data saved successfully',
      filePath: `uploads/${fileName}`,
      summary: {
        skuCount,
        dateRange,
        totalPeriods: columns ? columns.length - 1 : 0,
      },
      skuList: skuList,
      columns: columns, 
      previewData: transformedData.slice(0, 10),
      columnRoles: columnRoles
    });
  } catch (error) {
    console.error('Error applying configuration:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: 'An unexpected error occurred while applying the configuration.', details: error.message });
  }
});

router.get('/processed-data/:fileName', (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(UPLOADS_DIR, fileName);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/jobs', (req, res) => {
  try {
    const { data, models, skus, reason, method = 'grid', filePath, batchId } = req.body;
    //console.Log('[Job Creation] Request:', { skus, models, filePath, reason, method, batchId });
    const userId = 'default_user';
    const priority = getPriorityFromReason(reason);
    let jobsCreated = 0;
    let jobsSkipped = 0;
    if (skus && Array.isArray(skus) && skus.length > 0) {
      const insertStmt = db.prepare("INSERT INTO jobs (userId, sku, modelId, method, payload, status, reason, batchId, priority, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      for (const sku of skus) {
        for (const modelId of models) {
          if (method === 'grid' && !isModelOptimizable(modelId, ALL_MODELS)) {
            jobsSkipped++;
            //console.Log(`[Job Creation] Skipped job for SKU: ${sku}, Model: ${modelId} (not optimizable)`);
            continue;
          }
          const payload = JSON.stringify({ skuData: [], businessContext: null });
          const jobData = { filePath, modelTypes: [modelId], optimizationType: method };
          //console.Log('[Job Creation] Received batchId:', batchId);
          //console.Log('[Job Creation] Inserting job with batchId:', batchId);
          insertStmt.run(userId, sku, modelId, method, payload, 'pending', reason || 'manual_trigger', batchId, priority, JSON.stringify(jobData));
          //console.Log(`[Job Creation] Inserted job with batchId: ${batchId}`);
          jobsCreated++;
          //console.Log(`[Job Creation] Created job for SKU: ${sku}, Model: ${modelId}, File: ${filePath}, Batch: ${batchId}`);
        }
      }
      insertStmt.finalize();
      //console.Log(`[Job Creation] Finished: ${jobsCreated} jobs created, ${jobsSkipped} skipped.`);
      res.status(201).json({ message: `Successfully created ${jobsCreated} jobs`, jobsCreated, jobsCancelled: 0, jobsSkipped, skusProcessed: skus.length, modelsPerSku: models.length, priority });
      return;
    }
  } catch (error) {
    console.error('Error in jobs post:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/status', (req, res) => {
  const userId = 'default_user';
  db.all("SELECT * FROM jobs WHERE userId = ? ORDER BY method DESC, priority ASC, sku ASC, createdAt ASC", [userId], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to get job status' });
    }
    //console.log('[Job Status] Returning jobs:', rows.map(j => ({ id: j.id, batchId: j.batchId })));
    res.json(rows || []);
  });
});

router.post('/jobs/reset', (req, res) => {
    const userId = 'default_user';
    db.run('DELETE FROM jobs WHERE userId = ?', [userId], function(err) {
        if (err) {
            console.error('Failed to reset jobs:', err);
            return res.status(500).json({ error: 'Failed to reset jobs' });
        }
        res.status(200).json({ message: 'All jobs have been reset.', deletedCount: this.changes });
    });
});

router.post('/jobs/clear-completed', (req, res) => {
    const userId = 'default_user';
    db.run("DELETE FROM jobs WHERE status = 'completed' AND userId = ?", [userId], function(err) {
        if (err) {
            console.error('Failed to clear completed jobs:', err);
            return res.status(500).json({ error: 'Failed to clear completed jobs' });
        }
        res.status(200).json({ message: 'Completed jobs have been cleared.', deletedCount: this.changes });
    });
});

router.post('/jobs/clear-pending', (req, res) => {
    const userId = 'default_user';
    db.run("DELETE FROM jobs WHERE status = 'pending' AND userId = ?", [userId], function(err) {
        if (err) {
            console.error('Failed to clear pending jobs:', err);
            return res.status(500).json({ error: 'Failed to clear pending jobs' });
        }
        res.status(200).json({ message: 'Pending jobs have been cleared.', deletedCount: this.changes });
    });
});

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to register user' });
            }
            res.status(201).json({ message: 'User registered successfully', userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to register user due to a server error' });
    }
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id }, 'your_jwt_secret', { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    });
});

router.post('/process-manual-import', async (req, res) => {
  try {
    const { headers, data, mappings, dateFormat, transpose, finalColumnRoles, originalCsvData, originalCsvString } = req.body;

    // Debug log for received mappings
    //console.Log('process-manual-import received mappings:', mappings);
    if (finalColumnRoles) {
      //console.Log('process-manual-import received finalColumnRoles:', finalColumnRoles);
    }

    // Generate single timestamp for both files
    const timestamp = Date.now();

    // Save original CSV data first (for detection logic)
    const csvFileName = `Original_CSV_Upload-${timestamp}.csv`;
    const csvFilePath = path.join(UPLOADS_DIR, csvFileName);
    let csvHash = '';
    
    // Use raw CSV string if provided, otherwise reconstruct from originalCsvData
    if (originalCsvString) {
      // Hash the raw CSV string directly (this matches the frontend hash)
      csvHash = crypto.createHash('sha256').update(originalCsvString, 'utf8').digest('hex').slice(0, 30);
      fs.writeFileSync(csvFilePath, originalCsvString);
      console.log('Saved original CSV from raw string:', csvFileName);
    } else if (originalCsvData && Array.isArray(originalCsvData) && originalCsvData.length > 0) {
      // Fallback: Convert array of objects back to CSV format
      const csvHeaders = Object.keys(originalCsvData[0]);
      const csvContent = [
        csvHeaders.join(','),
        ...originalCsvData.map(row => csvHeaders.map(header => row[header]).join(','))
      ].join('\n');
      csvHash = crypto.createHash('sha256').update(csvContent, 'utf8').digest('hex').slice(0, 30);
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

    // Log the output columns for debugging
    //console.Log('process-manual-import output columns:', columns);
    //console.Log('process-manual-import received finalColumnRoles:', finalColumnRoles);

    if (!finalColumnRoles || finalColumnRoles.length !== columns.length) {
      throw new Error('finalColumnRoles length does not match normalized columns length');
    }

    const columnRoles = finalColumnRoles;

    // Extract summary information
    const skuList = Array.from(new Set(transformedData.map(row => row['Material Code']).filter(Boolean)));
    const skuCount = skuList.length;
    const dateList = transformedData.map(row => row['Date']).filter(Boolean);
    const uniqueDates = Array.from(new Set(dateList)).sort();
    let dateRange = ["N/A", "N/A"];
    if (uniqueDates.length > 0) {
      dateRange = [uniqueDates[0], uniqueDates[uniqueDates.length - 1]];
    }
    const totalPeriods = uniqueDates.length;
    const datasetName = `Dataset ${new Date().toISOString().slice(0,10)} - From ${dateRange[0]} to ${dateRange[1]} (${skuCount} products)`;

    // Save the processed data to a file
    const fileName = `Processed_Historical_Data_Manual-${timestamp}.json`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    
    const dataToSave = {
      data: transformedData,
      columns: columns,
      columnRoles: columnRoles,
      source: 'manual-import',
      timestamp: new Date().toISOString(),
      summary: {
        skuCount,
        dateRange,
        totalPeriods,
      },
      name: datasetName, // Use correct name
      csvHash // Save the hash for duplicate detection
    };
    
    if (csvHash) {
      discardOldFilesWithHash(csvHash);
    }
    
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));

    const result = {
      success: true,
      filePath: `uploads/${fileName}`,
      summary: {
        skuCount: skuCount,
        dateRange,
        totalPeriods: totalPeriods,
      },
      skuList: skuList,
      columns: columns,
      previewData: transformedData.slice(0, 10),
      columnRoles: columnRoles
    };

    console.log('Manual import processed successfully:', {
      filePath: result.filePath,
      skuCount: result.summary.skuCount,
      totalPeriods: result.summary.totalPeriods
    });

    res.json(result);
  } catch (error) {
    console.error('Error processing manual import:', error.message, error.stack);
    res.status(500).json({ error: 'An unexpected error occurred during manual processing.', details: error.message, stack: error.stack });
  }
});

router.post('/generate-preview', (req, res) => {
  try {
    const { csvData, transposed } = req.body;
    //console.Log('[LOG] /generate-preview called.');
    //console.Log(`[LOG] csvData length: ${csvData ? csvData.length : 0}, transposed: ${transposed}`);
    
    // Use the new robust parser
    let { data, headers } = parseCsvWithHeaders(csvData);

    if (transposed) {
      //console.Log('[LOG] Transposing data...');
      const transposedResult = transposeData(data, headers);
      data = transposedResult.data;
      headers = transposedResult.headers;
      //console.Log(`[LOG] Transposed. New headers:`, headers.slice(0, 5));
      //console.Log(`[LOG] Transposed. New data sample:`, data.slice(0, 2));
    }
    
    // Get column roles as objects first
    const columnRolesObjects = detectColumnRoles(headers);
    // Extract just the role strings for the frontend
    const columnRoles = columnRolesObjects.map(obj => obj.role);

    //console.Log(`[LOG] Sending response with ${headers.length} headers and ${data.slice(0, 100).length} previewRows.`);
    res.json({
      headers: headers.slice(0, 50),
      previewRows: data.slice(0, 100),
      columnRoles,
      transposed: !!transposed
    });
  } catch (error) {
    console.error('Error in generate-preview:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/load-processed-data', (req, res) => {
  try {
    const { filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath parameter is required' });
    }

    // Construct the full path to the file
    const fullPath = path.join(__dirname, '../../', filePath);
    
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

    res.json(data);
  } catch (error) {
    console.error('Error loading processed data:', error);
    res.status(500).json({ error: 'Failed to load processed data' });
  }
});

// New: AI Parameter Optimization endpoint
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
});

// New: AI Model Recommendation endpoint
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
});

// Endpoint to save cleaned data from manual edits or UI cleaning
router.post('/save-cleaned-data', (req, res) => {
  try {
    const { data, columns } = req.body;
    const fileName = `processed-data-manual-${Date.now()}.json`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify({ data, columns }, null, 2));
    res.status(200).json({ filePath: `uploads/${fileName}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save cleaned data', details: error.message });
  }
});

router.post('/process-ai-import', async (req, res) => {
  try {
    const { transformedData, columns, columnRoles, finalColumnRoles, originalCsvData, originalCsvString } = req.body;
    
    if (!transformedData || !Array.isArray(transformedData) || transformedData.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid transformed data' });
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid columns' });
    }

    //console.Log('process-ai-import received:', {
    //  dataLength: transformedData.length,
    //  columns: columns,
    //  columnRoles: columnRoles
    //});

    // Generate single timestamp for both files
    const timestamp = Date.now();

    // Save original CSV data first (for detection logic)
    const csvFileName = `Original_CSV_Upload-${timestamp}.csv`;
    const csvFilePath = path.join(UPLOADS_DIR, csvFileName);
    let csvHash = '';
    
    // Use raw CSV string if provided, otherwise reconstruct from originalCsvData
    if (originalCsvString) {
      // Hash the raw CSV string directly (this matches the frontend hash)
      csvHash = crypto.createHash('sha256').update(originalCsvString, 'utf8').digest('hex').slice(0, 30);
      fs.writeFileSync(csvFilePath, originalCsvString);
      console.log('Saved original CSV from raw string:', csvFileName);
    } else if (originalCsvData && Array.isArray(originalCsvData) && originalCsvData.length > 0) {
      // Fallback: Convert array of objects back to CSV format
      const csvHeaders = Object.keys(originalCsvData[0]);
      const csvContent = [
        csvHeaders.join(','),
        ...originalCsvData.map(row => csvHeaders.map(header => row[header]).join(','))
      ].join('\n');
      csvHash = crypto.createHash('sha256').update(csvContent, 'utf8').digest('hex').slice(0, 30);
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

    // Save the transformed data to a file
    const fileName = `Processed_Historical_Data_AI-${timestamp}.json`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    
    const dataToSave = {
      data: longFormatData,
      columns: outputColumns,
      columnRoles: outputColumnRoles,
      source: 'ai-import',
      timestamp: new Date().toISOString(),
      summary: {
        skuCount: skuList.length,
        dateRange,
        totalPeriods: dateColumns.length,
      },
      name: fileName, // Default name, can be updated later via /save-dataset-name
      csvHash // Save the hash for duplicate detection
    };
    
    if (csvHash) {
      discardOldFilesWithHash(csvHash);
    }
    
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));

    const result = {
      success: true,
      filePath: `uploads/${fileName}`,
      summary: {
        skuCount: skuList.length,
        dateRange,
        totalPeriods: dateColumns.length,
      },
      skuList: skuList,
      columns: outputColumns,
      previewData: longFormatData.slice(0, 10),
      columnRoles: outputColumnRoles
    };

    //console.Log('AI import processed successfully:', {
    //  filePath: result.filePath,
    //  skuCount: result.summary.skuCount,
    //  totalPeriods: result.summary.totalPeriods
    //});

    res.json(result);
  } catch (error) {
    console.error('Error in process-ai-import:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate file hash
function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// Helper function to extract timestamp from filename
function extractTimestamp(filename) {
  const match = filename.match(/(\d{13,})/);
  return match ? parseInt(match[1]) : 0;
}

// Endpoint to detect existing data and return the latest cleaned data
router.get('/detect-existing-data', async (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const datasets = [];

    // Group files by timestamp
    const fileGroups = {};

    files.forEach(file => {
      // Match JSON files with our naming pattern
      const jsonMatch = file.match(/Processed_Historical_Data_(AI|Manual)-(\d+)\.json/);
      if (jsonMatch) {
        const [, type, timestamp] = jsonMatch;
        if (!fileGroups[timestamp]) {
          fileGroups[timestamp] = { json: null, csv: null, type: null };
        }
        fileGroups[timestamp].json = file;
        fileGroups[timestamp].type = type;
      }

      // Match CSV files with our naming pattern
      const csvMatch = file.match(/Original_CSV_Upload-(\d+)\.csv/);
      if (csvMatch) {
        const [, timestamp] = csvMatch;
        if (!fileGroups[timestamp]) {
          fileGroups[timestamp] = { json: null, csv: null, type: null };
        }
        fileGroups[timestamp].csv = file;
      }
    });

    // Process each group that has both CSV and JSON
    for (const [timestamp, group] of Object.entries(fileGroups)) {
      if (group.json && group.csv) {
        try {
          const jsonPath = path.join(UPLOADS_DIR, group.json);
          const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          
          if (jsonData.summary && jsonData.name) {
            datasets.push({
              id: timestamp,
              name: jsonData.name,
              type: group.type === 'AI' ? 'AI Import' : 'Manual Import',
              summary: jsonData.summary,
              filename: group.json,
              timestamp: parseInt(timestamp)
            });
          }
        } catch (error) {
          console.error(`Error processing dataset ${timestamp}:`, error);
        }
      }
    }

    // Sort by timestamp (newest first)
    datasets.sort((a, b) => b.timestamp - a.timestamp);

    //console.Log('Detected datasets:', datasets);
    res.json({ datasets });
  } catch (error) {
    console.error('Error detecting existing data:', error);
    res.status(500).json({ error: 'Failed to detect existing data' });
  }
});

// Endpoint to update the dataset name in a cleaned JSON file
router.post('/save-dataset-name', (req, res) => {
  try {
    const { filePath, name } = req.body;
    if (!filePath || !name) {
      return res.status(400).json({ error: 'filePath and name are required' });
    }
    const fullPath = path.join(__dirname, '../../', filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const fileJson = JSON.parse(fileContent);
    fileJson.name = name;
    fs.writeFileSync(fullPath, JSON.stringify(fileJson, null, 2));
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving dataset name:', error);
    res.status(500).json({ error: 'Failed to save dataset name', details: error.message });
  }
});

// Endpoint to check for duplicate CSV uploads by hash
router.post('/check-csv-duplicate', async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData) {
      return res.status(400).json({ error: 'Missing csvData' });
    }
    // Compute SHA-256 hash of the raw CSV data
    const hash = crypto.createHash('sha256').update(csvData, 'utf8').digest('hex').slice(0, 30);
    const files = fs.readdirSync(UPLOADS_DIR);
    let foundDataset = null;
    // Look for a JSON file with this hash in its metadata
    for (const file of files) {
      if (file.endsWith('.json')) {
        const jsonPath = path.join(UPLOADS_DIR, file);
        try {
          const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          if (jsonData.csvHash && jsonData.csvHash === hash) {
            foundDataset = {
              name: jsonData.name,
              summary: jsonData.summary,
              filename: file,
              hash,
            };
            break;
          }
        } catch (e) { /* ignore parse errors */ }
      }
    }
    if (foundDataset) {
      return res.json({ duplicate: true, existingDataset: foundDataset });
    }
    // Optionally, also check for CSV files with the hash in their filename
    // (if you want to prevent re-upload of the exact same CSV file)
    res.json({ duplicate: false, hash });
  } catch (error) {
    console.error('Error in /check-csv-duplicate:', error);
    res.status(500).json({ error: 'Failed to check for duplicate CSV' });
  }
});

export default router;
