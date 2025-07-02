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
import { MODEL_METADATA } from './models/ModelMetadata.js';
import { inferDateFrequency } from './utils.js';
import { modelFactory } from './models/ModelFactory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to discard old files with the same hash
function discardOldFilesWithHash(csvHash, skipFileNames = []) {
  const files = fs.readdirSync(UPLOADS_DIR);
  for (const file of files) {
    if ((file.endsWith('.json') || file.endsWith('.csv')) && file.includes(csvHash.slice(0, 8))) {
      if (skipFileNames.includes(file)) continue;
      const filePath = path.join(UPLOADS_DIR, file);
      // Only add -discarded if not already present
      if (!file.includes('-discarded.')) {
        const newFile = file.replace(/(\.[^.]+)$/, '-discarded$1');
        const newPath = path.join(UPLOADS_DIR, newFile);
            fs.renameSync(filePath, newPath);
        console.log(`Discarded file: ${file} -> ${newFile}`);
                  }
    }
  }
}

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
    let { data, models, skus, reason, method = 'grid', filePath, batchId } = req.body;
    // Standardize filePath to always be 'uploads/filename'
    if (filePath && !filePath.startsWith('uploads/')) {
      filePath = `uploads/${path.basename(filePath)}`;
    }
    console.log(`[Job Creation] Creating jobs for ${skus?.length || 0} SKUs, ${models?.length || 0} models, method: ${method}, filePath: ${filePath}`);
    // Remove or comment out detailed logs
    // console.log(`[Job Creation] 🔍 Creating jobs with filePath: ${filePath}`);
    // console.log(`[Job Creation] 📊 Request details:`, { ... });
    // ...
    // Only keep error logs
    // ... rest of the function unchanged ...
    
    // Check if filePath points to a processed JSON file
    if (filePath) {
      const resolvedPath = filePath.startsWith(UPLOADS_DIR) ? filePath : path.join(UPLOADS_DIR, path.basename(filePath));
      console.log(`[Job Creation] 📁 Resolved file path: ${resolvedPath}`);
      
      if (fs.existsSync(resolvedPath)) {
        try {
          const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
          const fileData = JSON.parse(fileContent);
          console.log(`[Job Creation] ✅ File exists and is valid JSON`);
          console.log(`[Job Creation] 📊 File structure:`, {
            hasData: !!fileData.data,
            dataLength: fileData.data?.length || 0,
            columns: fileData.columns?.length || 0,
            source: fileData.source,
            name: fileData.name
          });
        } catch (e) {
          console.error(`[Job Creation] ❌ File exists but is not valid JSON:`, e.message);
        }
      } else {
        console.error(`[Job Creation] ❌ File does not exist: ${resolvedPath}`);
      }
    }
    
    //console.Log('[Job Creation] Request:', { skus, models, filePath, reason, method, batchId });
    const userId = 'default_user';
    const priority = getPriorityFromReason(reason);
    let jobsCreated = 0;
    let jobsSkipped = 0;
    let jobsFiltered = 0;
    
    if (skus && Array.isArray(skus) && skus.length > 0) {
      const insertStmt = db.prepare("INSERT INTO jobs (userId, sku, modelId, method, payload, status, reason, batchId, priority, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      
      // Get model data requirements for eligibility filtering
      const requirements = modelFactory.getModelDataRequirements();
      const validationRatio = 0.2; // Match frontend default
      
      for (const sku of skus) {
        // Get data for this specific SKU
        let skuData = [];
        if (data && Array.isArray(data)) {
          skuData = data.filter(d => String(d.sku || d['Material Code']) === sku);
        }

        
        // Filter models based on eligibility for this SKU
        const eligibleModels = models.filter(modelId => {
          const req = requirements[modelId];
          if (!req) {
            console.log(`[Job Creation] ${modelId}: No requirements found, including`);
            return true;
          }
          
          const minTrain = Number(req.minObservations);
          const requiredTotal = Math.ceil(minTrain / (1 - validationRatio));
          const isEligible = skuData.length >= requiredTotal;

          console.log(`[Job Creation] ${modelId}: ${skuData.length} data points, requires ${requiredTotal} (${minTrain} training), eligible: ${isEligible}`);
          
          if (!isEligible) {
            jobsFiltered++;
            console.log(`[Job Creation] Filtered out ${modelId} for SKU ${sku}: insufficient data`);
          }
          
          return isEligible;
        });
        

        
        // Create jobs for all eligible models (including non-optimizable ones)
        for (const modelId of eligibleModels) {
          // Check if model should be included in grid search using the model's own method
          const modelClass = modelFactory.getModelClass(modelId);
          if (method === 'grid' && modelClass && !modelClass.shouldIncludeInGridSearch()) {
            jobsSkipped++;
            console.log(`[Job Creation] Skipped job for SKU: ${sku}, Model: ${modelId} (model opted out of grid search)`);
            continue;
          }
          if (method === 'grid' && modelClass) {
            console.log(`[Job Creation] Model ${modelId} shouldIncludeInGridSearch(): ${modelClass.shouldIncludeInGridSearch()}`);
          }
          const payload = JSON.stringify({ skuData: [], businessContext: null });

          // Read friendly dataset name from processed file if available
          let friendlyName = '';
          let resolvedPath = filePath;
          if (filePath && !filePath.startsWith(UPLOADS_DIR)) {
            resolvedPath = path.join(UPLOADS_DIR, path.basename(filePath));
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
          if (!friendlyName && filePath) {
            friendlyName = (filePath.split('/').pop() || '').replace(/\.(csv|json)$/i, '');
          }

          const jobData = { filePath, modelTypes: [modelId], optimizationType: method, name: friendlyName, sku };
          //console.Log('[Job Creation] Received batchId:', batchId);
          //console.Log('[Job Creation] Inserting job with batchId:', batchId);
          insertStmt.run(userId, sku, modelId, method, payload, 'pending', reason || 'manual_trigger', batchId, priority, JSON.stringify(jobData));
          //console.Log(`[Job Creation] Inserted job with batchId: ${batchId}`);
          jobsCreated++;
          //console.Log(`[Job Creation] Created job for SKU: ${sku}, Model: ${modelId}, File: ${filePath}, Batch: ${batchId}`);
        }
      }
      insertStmt.finalize();
      
      res.status(201).json({ 
        message: `Successfully created ${jobsCreated} jobs`, 
        jobsCreated, 
        jobsCancelled: 0, 
        jobsSkipped, 
        jobsFiltered,
        skusProcessed: skus.length, 
        modelsPerSku: models.length, 
        priority 
      });
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
    const frequency = inferDateFrequency(uniqueDates);
    console.log('[process-manual-import] Inferred frequency:', frequency, 'from dates:', uniqueDates);
    const datasetName = `Dataset ${new Date().toISOString().slice(0,10)} - From ${dateRange[0]} to ${dateRange[1]} (${skuCount} products)`;

    // Auto-update global frequency setting if enabled
    db.get("SELECT value FROM settings WHERE key = 'global_autoDetectFrequency'", [], (err, row) => {
      if (!err && row) {
        try {
          const autoDetectEnabled = JSON.parse(row.value);
          if (autoDetectEnabled) {
            const seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);
            db.run(
              "INSERT OR REPLACE INTO settings (key, value, description, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
              ['global_frequency', JSON.stringify(frequency), 'Data frequency (auto-detected from dataset)'],
              (err) => {
                if (err) console.error('Failed to update frequency setting:', err);
                else console.log('Auto-updated frequency setting to:', frequency);
              }
            );
            db.run(
              "INSERT OR REPLACE INTO settings (key, value, description, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
              ['global_seasonalPeriods', JSON.stringify(seasonalPeriods), 'Seasonal periods (auto-calculated from frequency)'],
              (err) => {
                if (err) console.error('Failed to update seasonal periods setting:', err);
                else console.log('Auto-updated seasonal periods setting to:', seasonalPeriods);
              }
            );
          }
        } catch (e) {
          console.error('Error parsing autoDetectFrequency setting:', e);
        }
      }
    });

    // Save the processed data to a file
    const fileName = `${baseName}-${csvHash.slice(0, 8)}-processed.json`;
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
        frequency,
      },
      name: datasetName, // Use correct name
      csvHash // Save the hash for duplicate detection
    };
    
    if (csvHash) {
      discardOldFilesWithHash(csvHash, [fileName, csvFileName]);
    }
    
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));

    const result = {
      success: true,
      filePath: `uploads/${fileName}`,
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
    let { data, headers, separator } = parseCsvWithHeaders(csvData);

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
      separator,
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
    
    // Extract hash from the data to generate proper filename
    // Only consider files matching the new processed file pattern
    let csvHash = '';
    let baseName = '';
    
    const files = fs.readdirSync(UPLOADS_DIR);
    // Only match new processed file pattern
    const processedFiles = files.filter(f => /^Original_CSV_Upload-\d+-[a-f0-9]{8}-processed\.json$/.test(f) && !f.includes('-discarded'));
    
    if (processedFiles.length > 0) {
      // Use the most recent processed file (by timestamp in filename)
      const latestFile = processedFiles.sort((a, b) => {
        // Extract timestamp from filename
        const aMatch = a.match(/^Original_CSV_Upload-(\d+)-[a-f0-9]{8}-processed\.json$/);
        const bMatch = b.match(/^Original_CSV_Upload-(\d+)-[a-f0-9]{8}-processed\.json$/);
        const aTime = aMatch ? parseInt(aMatch[1], 10) : 0;
        const bTime = bMatch ? parseInt(bMatch[1], 10) : 0;
        return aTime - bTime;
      }).pop();
      const filePath = path.join(UPLOADS_DIR, latestFile);
      try {
        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (fileContent.csvHash) {
          csvHash = fileContent.csvHash;
          // Extract baseName from the filename
          const match = latestFile.match(/^Original_CSV_Upload-(\d+)-([a-f0-9]{8})-processed\.json$/);
          if (match) {
            baseName = `Original_CSV_Upload-${match[1]}`;
          }
        }
      } catch (err) {
        console.error('Error reading existing processed file:', err);
      }
    }
    
    // If we couldn't find the hash, generate a new one using the new convention
    if (!csvHash) {
      const dataString = JSON.stringify(data);
      csvHash = crypto.createHash('sha256').update(dataString, 'utf8').digest('hex').slice(0, 30);
      baseName = `Original_CSV_Upload-${Date.now()}`;
    }
    
    // Use the new naming convention
    const fileName = `${baseName}-${csvHash.slice(0, 8)}-cleaning.json`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    
    const dataToSave = {
      data,
      columns,
      csvHash,
      timestamp: new Date().toISOString(),
      source: 'manual-cleaning'
    };
    
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    
    // Return the processed file path, not the cleaning file path
    // The processedDataInfo should always point to the processed file
    const processedFileName = `${baseName}-${csvHash.slice(0, 8)}-processed.json`;
    res.status(200).json({ filePath: `uploads/${processedFileName}` });
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
    db.get("SELECT value FROM settings WHERE key = 'global_autoDetectFrequency'", [], (err, row) => {
      if (!err && row) {
        try {
          const autoDetectEnabled = JSON.parse(row.value);
          if (autoDetectEnabled) {
            const seasonalPeriods = getSeasonalPeriodsFromFrequency(frequency);
            db.run(
              "INSERT OR REPLACE INTO settings (key, value, description, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
              ['global_frequency', JSON.stringify(frequency), 'Data frequency (auto-detected from dataset)'],
              (err) => {
                if (err) console.error('Failed to update frequency setting:', err);
                else console.log('Auto-updated frequency setting to:', frequency);
              }
            );
            db.run(
              "INSERT OR REPLACE INTO settings (key, value, description, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
              ['global_seasonalPeriods', JSON.stringify(seasonalPeriods), 'Seasonal periods (auto-calculated from frequency)'],
              (err) => {
                if (err) console.error('Failed to update seasonal periods setting:', err);
                else console.log('Auto-updated seasonal periods setting to:', seasonalPeriods);
              }
            );
          }
        } catch (e) {
          console.error('Error parsing autoDetectFrequency setting:', e);
        }
      }
    });

    // Save the transformed data to a file
    const fileName = `${baseName}-${csvHash.slice(0, 8)}-processed.json`;
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
        frequency,
      },
      name: fileName, // Default name, can be updated later via /save-dataset-name
      csvHash // Save the hash for duplicate detection
    };
    
    if (csvHash) {
      discardOldFilesWithHash(csvHash, [fileName, csvFileName]);
    }
    
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));

    const result = {
      success: true,
      filePath: `uploads/${fileName}`,
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

    // Group files by hash
    const fileGroups = {};

    files.forEach(file => {
      // Match JSON files with our new naming pattern: <BaseName>-<ShortHash>-processed.json
      const jsonMatch = file.match(/Original_CSV_Upload-(\d+)-([a-f0-9]{8})-processed\.json/);
      if (jsonMatch) {
        const [, timestamp, shortHash] = jsonMatch;
        if (!fileGroups[shortHash]) {
          fileGroups[shortHash] = { json: null, csv: null, timestamp: null };
        }
        fileGroups[shortHash].json = file;
        fileGroups[shortHash].timestamp = timestamp;
      }

      // Match CSV files with our new naming pattern: <BaseName>-<ShortHash>-original.csv
      const csvMatch = file.match(/Original_CSV_Upload-(\d+)-([a-f0-9]{8})-original\.csv/);
      if (csvMatch) {
        const [, timestamp, shortHash] = csvMatch;
        if (!fileGroups[shortHash]) {
          fileGroups[shortHash] = { json: null, csv: null, timestamp: null };
        }
        fileGroups[shortHash].csv = file;
        fileGroups[shortHash].timestamp = timestamp;
      }
    });

    // Process each group that has both CSV and JSON
    for (const [shortHash, group] of Object.entries(fileGroups)) {
      if (group.json && group.csv) {
        try {
          const jsonPath = path.join(UPLOADS_DIR, group.json);
          const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          
          if (jsonData.summary && jsonData.name) {
            datasets.push({
              id: group.timestamp,
              name: jsonData.name,
              type: jsonData.source === 'ai-import' ? 'AI Import' : 'Manual Import',
              summary: jsonData.summary,
              filename: group.json,
              timestamp: parseInt(group.timestamp)
            });
          }
        } catch (error) {
          console.error(`Error processing dataset ${shortHash}:`, error);
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

// Helper to get default/baseline result for non-optimizable models
function getDefaultResultForModel(model, sku, batchId, filePath) {
  return {
    modelType: model.id,
    displayName: model.displayName || model.id,
    category: model.category || 'Other',
    description: model.description || '',
    isSeasonal: model.isSeasonal || false,
    sku,
    batchId,
    filePath,
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
          filePath,
          createdAt: null,
          completedAt: null,
          compositeScore: null,
          isDefault: true, // Mark as default/baseline
          note: 'This model uses default parameters optimized for general use.'
        }
      }
    ]
  };
}

// Add this helper at the top of the file or near extractBestResultsPerModelMethod
function safeMetric(val, max) {
  if (val === null || val === undefined || val === "" || isNaN(Number(val))) return max;
  return Number(val);
}

// In extractBestResultsPerModelMethod, after collecting bestResultsMap, add all non-optimizable models as baselines if not already present
function extractBestResultsPerModelMethod(jobs, modelMetadataMap, weights = { mape: 0.4, rmse: 0.3, mae: 0.2, accuracy: 0.1 }) {
  console.log(`[API] extractBestResultsPerModelMethod called with ${jobs.length} jobs`);
  const bestResultsMap = {};
  
  for (const job of jobs) {
    const resultData = JSON.parse(job.result || '{}');
    const method = job.method;
    const batchId = job.batchId;
    const filePath = (() => {
      try {
        const dataObj = JSON.parse(job.data || '{}');
        return dataObj.filePath || '';
      } catch {
        return '';
      }
    })();

    if (resultData.results && Array.isArray(resultData.results)) {
      for (const modelResult of resultData.results) {
        if (!modelResult.success) continue;
        
        const modelType = modelResult.modelType;
        const sku = job.sku;
        const modelInfo = modelMetadataMap.get(modelType) || {};
        
        // --- GROUP BY modelType, method, sku, batchId (or filePath) ---
        const groupKey = `${modelType}__${method}__${sku}__${batchId || filePath}`;

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
            filePath,
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
          filePath,
          createdAt: job.createdAt,
          completedAt: job.completedAt
        });
      }
    }
  }
  
  // For each group, compute composite score and select best
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
        const accuracy = safeMetric(r.accuracy, 0); // for accuracy, missing = 0 (worst)

        const normAccuracy = Math.max(0, Math.min(1, accuracy / 100));
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
    group.bestResult = best;
  });

  // Convert to array format
  const results = Object.values(bestResultsMap).map(group => ({
    modelType: group.modelType,
    displayName: group.displayName,
    category: group.category,
    description: group.description,
    isSeasonal: group.isSeasonal,
    sku: group.sku,
    batchId: group.batchId,
    filePath: group.filePath,
    methods: [
      {
        method: group.method,
        bestResult: group.bestResult
      }
    ]
  }));

  console.log(`[API] extractBestResultsPerModelMethod returning ${results.length} results:`, results.map(r => ({
    modelType: r.modelType,
    sku: r.sku,
    filePath: r.filePath,
    method: r.methods[0]?.method
  })));

  // Add models that should be included in grid search but are missing from results
  const allModelIds = Array.from(modelMetadataMap.keys());
   for (const modelId of allModelIds) {
    const model = modelMetadataMap.get(modelId);
    // Check if model should be included in grid search using the model's own method
    const modelClass = modelFactory.getModelClass(modelId);
    if (!modelClass || !modelClass.shouldIncludeInGridSearch()) {
      continue; // Skip models that opt out of grid search
    }
    const seenCombos = new Set(results.map(r => `${r.modelType}|${r.sku}|${r.batchId}|${r.filePath}`));
      for (const job of jobs) {
        const comboKey = `${modelId}|${job.sku}|${job.batchId}|${job.data ? JSON.parse(job.data).filePath || '' : ''}`;
        if (!seenCombos.has(comboKey)) {
        results.push(getDefaultResultForModel(model, job.sku, job.batchId, job.data ? JSON.parse(job.data).filePath : ''));
      }
    }
  }

  // After building results array, ensure every model is represented for each (sku, filePath, batchId) combo
  // Use MODEL_METADATA to get the full list of models
  // Collect all unique (sku, filePath, batchId) combos from jobs
  const combos = [];
  for (const job of jobs) {
    const sku = job.sku;
    const batchId = job.batchId;
    const filePath = (() => {
      try {
        const dataObj = JSON.parse(job.data || '{}');
        return dataObj.filePath || '';
      } catch {
        return '';
      }
    })();
    combos.push({ sku, batchId, filePath });
  }
  // For each combo, ensure every model/method is present
  const seenCombos = new Set(results.map(r => `${r.modelType}|${r.sku}|${r.batchId}|${r.filePath}|${r.methods[0]?.method}`));
  for (const { sku, batchId, filePath } of combos) {
    for (const modelId of allModelIds) {
      const model = modelMetadataMap.get(modelId);
      for (const method of ['grid', 'ai']) {
        const comboKey = `${modelId}|${sku}|${batchId}|${filePath}|${method}`;
        if (!seenCombos.has(comboKey)) {
          results.push({
            modelType: model.id,
            displayName: model.displayName || model.id,
            category: model.category || 'Other',
            description: model.description || '',
            isSeasonal: model.isSeasonal || false,
            sku,
            batchId,
            filePath,
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
                  filePath,
                  createdAt: null,
                  completedAt: null,
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
}

// Get optimization results summary with model metadata
router.get('/jobs/results-summary', (req, res) => {
    const userId = 'default_user';
    const { method } = req.query;
    
    // Validate method parameter
    if (method && !['grid', 'ai', 'all'].includes(method)) {
        return res.status(400).json({ error: 'Method must be "grid", "ai", or "all"' });
    }
    
    // Build query based on method filter
    let query = "SELECT * FROM jobs WHERE status = 'completed' AND userId = ? AND result IS NOT NULL";
    let params = [userId];
    
    if (method && method !== 'all') {
        query += " AND method = ?";
        params.push(method);
    }
    
    query += " ORDER BY createdAt DESC";
    
    db.all(query, params, (err, jobs) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch optimization results' });
        }
        
        if (jobs.length === 0) {
            return res.status(404).json({ error: 'No completed optimization jobs found' });
        }
        
        try {
            // Create a lookup map for model metadata
            const modelMetadataMap = new Map();
            MODEL_METADATA.forEach(model => {
                modelMetadataMap.set(model.id, model);
            });
            
            const summary = {
                totalJobs: jobs.length,
                totalResults: 0,
                modelBreakdown: {},
                categoryBreakdown: {},
                seasonalVsNonSeasonal: { seasonal: 0, nonSeasonal: 0 },
                methodBreakdown: { grid: 0, ai: 0 },
                averageMetrics: { accuracy: 0, mape: 0, rmse: 0, mae: 0 },
                bestResults: [],
                bestResultsPerModelMethod: extractBestResultsPerModelMethod(jobs, modelMetadataMap, weights)
            };
            
            let totalAccuracy = 0;
            let totalMape = 0;
            let totalRmse = 0;
            let totalMae = 0;
            let successfulResults = 0;
            
            for (const job of jobs) {
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
    });
});

// Add endpoint to get available models
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

// New endpoint: Get best results per model and method
router.get('/jobs/best-results-per-model', (req, res) => {
    const userId = 'default_user';
    const { method, filePath, sku } = req.query;
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
    // Build query based on method filter and filePath filter
    let query = "SELECT * FROM jobs WHERE status = 'completed' AND userId = ? AND result IS NOT NULL";
    let params = [userId];
    if (method && method !== 'all') {
        query += " AND method = ?";
        params.push(method);
    }
    if (filePath) {
        query += " AND data LIKE ?";
        params.push(`%${filePath}%`);
    }
    if (sku) {
        query += " AND sku = ?";
        params.push(sku);
    }
    query += " ORDER BY createdAt DESC";
    db.all(query, params, (err, jobs) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch optimization results' });
        }
        
        console.log(`[API] best-results-per-model query:`, { method, filePath, sku, query, params });
        console.log(`[API] Found ${jobs.length} jobs for best-results-per-model`);
        if (jobs.length > 0) {
            console.log(`[API] Sample jobs:`, jobs.slice(0, 3).map(j => ({
                id: j.id,
                sku: j.sku,
                method: j.method,
                status: j.status,
                modelId: j.modelId,
                data: j.data ? JSON.parse(j.data).filePath : 'no data'
            })));
        }
        
        if (jobs.length === 0) {
            return res.status(404).json({ error: 'No completed optimization jobs found' });
        }
        try {
            // Create a lookup map for model metadata
            const modelMetadataMap = new Map();
            MODEL_METADATA.forEach(model => {
                modelMetadataMap.set(model.id, model);
            });
            const bestResultsPerModelMethod = extractBestResultsPerModelMethod(jobs, modelMetadataMap, weights);
            res.json({
                totalJobs: jobs.length,
                bestResultsPerModelMethod,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error processing best results per model:', error);
            res.status(500).json({ error: 'Failed to process best results per model', details: error.message });
        }
    });
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

// Export optimization results as CSV
router.get('/jobs/export-results', (req, res) => {
    const userId = 'default_user';
    const { method, format = 'csv', filePath, sku } = req.query;
    
    // Get metric weights from query parameters (same as used in best result calculation)
    const mapeWeight = parseFloat(req.query.mapeWeight) || 0.4;
    const rmseWeight = parseFloat(req.query.rmseWeight) || 0.3;
    const maeWeight = parseFloat(req.query.maeWeight) || 0.2;
    const accuracyWeight = parseFloat(req.query.accuracyWeight) || 0.1;
    const weights = { mape: mapeWeight, rmse: rmseWeight, mae: maeWeight, accuracy: accuracyWeight };

    
    // Validate method parameter
    if (method && !['grid', 'ai', 'all'].includes(method)) {
        return res.status(400).json({ error: 'Method must be "grid", "ai", or "all"' });
    }
    
    // Build query based on method filter and filePath filter
    let query = "SELECT * FROM jobs WHERE status = 'completed' AND userId = ? AND result IS NOT NULL";
    let params = [userId];
    
    if (method && method !== 'all') {
        query += " AND method = ?";
        params.push(method);
    }
    
    // Add filePath filter if specified
    if (filePath) {
        query += " AND data LIKE ?";
        params.push(`%${filePath}%`);
    }
    
    // Add SKU filter if specified
    if (sku) {
        query += " AND sku = ?";
        params.push(sku);
    }
    
    query += " ORDER BY createdAt DESC";
    
    db.all(query, params, (err, jobs) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch optimization results' });
        }
        
        if (jobs.length === 0) {
            const filterMessage = filePath ? ` for dataset: ${filePath}` : '';
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
            
            for (const job of jobs) {
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
                            createdAt: job.createdAt,
                            completedAt: job.completedAt,
                            duration: job.completedAt ? 
                                Math.round((new Date(job.completedAt) - new Date(job.createdAt)) / 1000) : null,
                            
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
                                filePath: jobData.filePath || job.filePath || '',
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
                result.datasetName || (result.filePath ? (result.filePath.split('/').pop() || '').replace(/\.(csv|json)$/i, '') : ''),
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
                result.createdAt,
                result.completedAt,
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
    });
});

// Settings endpoints
router.get('/settings', (req, res) => {
  const userId = 'default_user';
  db.all("SELECT key, value, description FROM settings WHERE key LIKE 'global_%'", [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to get settings' });
    }
    
    // Convert rows to settings object
    const settings = {};
    rows.forEach(row => {
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
    
    res.json(defaultSettings);
  });
});

router.post('/settings', (req, res) => {
  const userId = 'default_user';
  const { frequency, seasonalPeriods, autoDetectFrequency, csvSeparator } = req.body;
  
  const settingsToUpdate = [
    { key: 'global_frequency', value: JSON.stringify(frequency), description: 'Data frequency (daily, weekly, monthly, quarterly, yearly)' },
    { key: 'global_seasonalPeriods', value: JSON.stringify(seasonalPeriods), description: 'Number of periods in each season' },
    { key: 'global_autoDetectFrequency', value: JSON.stringify(autoDetectFrequency), description: 'Whether to automatically detect frequency from dataset' },
    { key: 'global_csvSeparator', value: JSON.stringify(csvSeparator), description: 'Default CSV separator for import/export' }
  ];
  
  let completed = 0;
  let hasError = false;
  
  settingsToUpdate.forEach(setting => {
    db.run(
      "INSERT OR REPLACE INTO settings (key, value, description, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
      [setting.key, setting.value, setting.description],
      (err) => {
        if (err) {
          console.error('Database error:', err);
          hasError = true;
        }
        completed++;
        
        if (completed === settingsToUpdate.length) {
          if (hasError) {
            res.status(500).json({ error: 'Failed to update settings' });
          } else {
            res.json({ success: true, message: 'Settings updated successfully' });
          }
        }
      }
    );
  });
});

// Helper function to get seasonal periods from frequency
function getSeasonalPeriodsFromFrequency(frequency) {
  switch (frequency) {
    case 'daily': return 7; // weekly seasonality
    case 'weekly': return 52; // yearly seasonality
    case 'monthly': return 12; // yearly seasonality
    case 'quarterly': return 4; // yearly seasonality
    case 'yearly': return 1; // no seasonality
    default: return 12; // default to monthly
  }
}

// Helper function to get CSV separator from settings
function getCsvSeparator(callback) {
  db.get("SELECT value FROM settings WHERE key = 'global_csvSeparator'", [], (err, row) => {
    if (err || !row) {
      callback(','); // default to comma
    } else {
      try {
        const separator = JSON.parse(row.value);
        callback(separator);
      } catch (e) {
        callback(','); // fallback to comma
      }
    }
  });
}

// Endpoint to update frequency in dataset summary
router.post('/update-dataset-frequency', async (req, res) => {
  const { filePath, frequency } = req.body;
  if (!filePath || !frequency) return res.status(400).json({ error: 'Missing filePath or frequency' });
  try {
    const fullPath = path.join(UPLOADS_DIR, path.basename(filePath));
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    data.summary = data.summary || {};
    data.summary.frequency = frequency;
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    res.json({ success: true, frequency });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update frequency' });
  }
});

// Endpoint to re-run auto frequency inference and update summary
router.post('/auto-detect-dataset-frequency', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'Missing filePath' });
  try {
    const fullPath = path.join(UPLOADS_DIR, path.basename(filePath));
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    // Try to infer frequency from dates in the data
    const dateList = data.data.map(row => row['Date']).filter(Boolean);
    const uniqueDates = Array.from(new Set(dateList)).sort();
    const frequency = inferDateFrequency(uniqueDates);
    data.summary = data.summary || {};
    data.summary.frequency = frequency;
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    res.json({ success: true, frequency });
  } catch (err) {
    res.status(500).json({ error: 'Failed to auto-detect frequency' });
  }
});

// Endpoint to get the count of processed datasets
router.get('/datasets/count', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    // Only count processed dataset files (ending with -processed.json)
    const processedFiles = files.filter(f => /-processed\.json$/i.test(f));
    res.json({ count: processedFiles.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count datasets', details: error.message });
  }
});

export default router;
