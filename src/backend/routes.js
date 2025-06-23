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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
const aiInstructionsSmall = fs.readFileSync(path.join(__dirname, 'config/ai_csv_instructions_small.txt'), 'utf-8');
const aiInstructionsLarge = fs.readFileSync(path.join(__dirname, 'config/ai_csv_instructions_large.txt'), 'utf-8');

router.post('/grok-transform', async (req, res) => {
  try {
    const { csvData, reasoningEnabled } = req.body;
    console.log(`[LOG] /grok-transform received reasoningEnabled: ${reasoningEnabled}`);
    if (!csvData) {
      return res.status(400).json({ error: 'Missing csvData or instructions' });
    }
    console.log('grok-transform received instructions:', aiInstructionsSmall.substring(0, 200) + '...');
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
    console.log('Final prompt being sent to AI:', prompt);
    const response = await callGrokAPI(prompt, 4000, reasoningEnabled);
    console.log('Raw Grok-3 Response (/grok-transform):', response);
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch (parseError) {
      console.log('Direct JSON parse failed, trying extraction methods...');
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
    console.log('Raw Grok-3 Response (/grok-generate-config):', response);
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
    
    console.log('Generated config:', JSON.stringify(config, null, 2));
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

    console.log('apply-config received config:', JSON.stringify(config, null, 2));

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
    const skuList = transformedData.map(row => row[materialCodeKey]).filter(Boolean);
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
    const { data, models, skus, reason, method = 'grid' } = req.body;
    const userId = 'default_user';
    const priority = getPriorityFromReason(reason);
    let jobsCreated = 0;
    let jobsSkipped = 0;
    if (skus && Array.isArray(skus) && skus.length > 0) {
      const insertStmt = db.prepare("INSERT INTO jobs (userId, sku, modelId, method, payload, status, reason, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      for (const sku of skus) {
        for (const modelId of models) {
          if (method === 'grid' && !isModelOptimizable(modelId, ALL_MODELS)) {
            jobsSkipped++;
            continue;
          }
          const payload = JSON.stringify({ skuData: [], businessContext: null });
          insertStmt.run(userId, sku, modelId, method, payload, 'pending', reason || 'manual_trigger', priority);
          jobsCreated++;
        }
      }
      insertStmt.finalize();
      res.status(201).json({ message: `Successfully created ${jobsCreated} jobs`, jobsCreated, jobsCancelled: 0, jobsSkipped, skusProcessed: skus.length, modelsPerSku: models.length, priority });
      return;
    }
  } catch (error) {
    console.error('Error in jobs post:', error);
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
    const { csvData, mappings, dateRange, dateFormat, transpose } = req.body;
    let parsed = Papa.parse(csvData, { skipEmptyLines: true });
    let data = parsed.data;
    if (transpose) {
      data = data[0].map((_, colIndex) => data.map(row => row[colIndex]));
    }
    const headers = data[0];
    const dataRows = data.slice(1);
    const { data: transformedData, columns } = normalizeAndPivotData(dataRows, mappings, dateRange, dateFormat);
    const fileName = `processed-data-manual-${Date.now()}.json`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify({ data: transformedData, columns }, null, 2));
    const materialCodeKey = columns[0];
    const skuList = transformedData.map(row => row[materialCodeKey]).filter(Boolean);
    res.status(200).json({
      message: 'Manual import processed and data saved successfully',
      filePath: `uploads/${fileName}`,
      summary: {
        skuCount: transformedData.length,
        dateRange: columns.length > 1 ? [columns[1], columns[columns.length - 1]] : ["N/A", "N/A"],
        totalPeriods: columns.length > 1 ? columns.length - 1 : 0,
      },
      skuList: skuList,
      columns: columns,
      previewData: transformedData.slice(0, 10),
    });
  } catch (error) {
    console.error('Error processing manual import:', error.message);
    res.status(500).json({ error: 'An unexpected error occurred during manual processing.', details: error.message });
  }
});

router.post('/generate-preview', (req, res) => {
  try {
    const { csvData, transposed } = req.body;
    console.log('[LOG] /generate-preview called.');
    console.log(`[LOG] csvData length: ${csvData ? csvData.length : 0}, transposed: ${transposed}`);
    
    // Use the new robust parser
    let { data, headers } = parseCsvWithHeaders(csvData);

    if (transposed) {
      console.log('[LOG] Transposing data...');
      const transposedResult = transposeData(data, headers);
      data = transposedResult.data;
      headers = transposedResult.headers;
      console.log(`[LOG] Transposed. New headers:`, headers.slice(0, 5));
      console.log(`[LOG] Transposed. New data sample:`, data.slice(0, 2));
    }
    
    // Get column roles as objects first
    const columnRolesObjects = detectColumnRoles(headers);
    // Extract just the role strings for the frontend
    const columnRoles = columnRolesObjects.map(obj => obj.role);

    console.log(`[LOG] Sending response with ${headers.length} headers and ${data.slice(0, 100).length} previewRows.`);
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

export default router;
