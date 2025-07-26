import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
// import { db } from './src/backend/db.js'; // No longer needed, removed SQLite
import apiRoutes from './src/backend/routes.js';
import authRoutes from './src/backend/authRoutes.js';
import fieldMappingRoutes from './src/backend/fieldMappingRoutes.js';
import fieldDefinitionRoutes from './src/backend/fieldDefinitionRoutes.js';
import divisionRoutes from './src/backend/divisionRoutes.js';
import clusterRoutes from './src/backend/clusterRoutes.js';
import fs from 'fs';
import multer from 'multer';
// import { runWorker } from './src/backend/worker.js'; // This is incorrect for the worker model
import { authenticateToken } from './src/backend/auth.js';
import { pgPool } from './src/backend/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2] || 'api';
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({ dest: path.join(__dirname, 'uploads') });
const csvUpload = multer({ storage: multer.memoryStorage() });

// Helper to discard old files with the same hash
function discardOldFilesWithHash(csvHash, skipFileNames = []) {
  const files = fs.readdirSync(path.join(__dirname, 'uploads'));
  for (const file of files) {
    if ((file.endsWith('.json') || file.endsWith('.csv')) && file.includes(csvHash.slice(0, 8))) {
      if (skipFileNames.includes(file)) continue;
      const datasetIdentifier = path.join(__dirname, 'uploads', file);
      // Only add -discarded if not already present
      if (!file.includes('-discarded.')) {
        const newFile = file.replace(/(\.[^.]+)$/, '-discarded$1');
        const newPath = path.join(__dirname, 'uploads', newFile);
        fs.renameSync(datasetIdentifier, newPath);
        console.log(`Discarded file: ${file} -> ${newFile}`);
      }
    }
  }
}

// Utility to generate dataset file names
function getDatasetFileName(baseName, hash, type, ext, discarded = false) {
  const shortHash = hash.slice(0, 8);
  const suffix = discarded ? '-discarded' : '';
  return `${baseName}-${shortHash}-${type}${suffix}.${ext}`;
}

// Save original CSV (multipart/form-data)
app.post('/api/save-original-csv', upload.single('file'), (req, res) => {
  const { baseName, hash } = req.body;
  if (!baseName || !hash || !req.file) {
    return res.status(400).json({ error: 'Missing baseName, hash, or file' });
  }
  const fileName = getDatasetFileName(baseName, hash, 'original', 'csv');
  const datasetIdentifier = path.join(__dirname, 'uploads', fileName);
  fs.rename(req.file.path, datasetIdentifier, err => {
    if (err) {
      console.error('Error saving original CSV:', err);
      return res.status(500).json({ error: 'Failed to save original CSV' });
    }
    res.json({ success: true });
  });
});

// Save processed data (JSON)
app.post('/api/save-processed-data', (req, res) => {
  const { baseName, hash, processedData } = req.body;
  if (!baseName || !hash || !processedData) {
    return res.status(400).json({ error: 'Missing baseName, hash, or processedData' });
  }
  const fileName = getDatasetFileName(baseName, hash, 'processed', 'json');
  const datasetIdentifier = path.join(__dirname, 'uploads', fileName);
  const payload = {
    hash,
    processedData,
    timestamp: new Date().toISOString(),
  };
  fs.writeFile(datasetIdentifier, JSON.stringify(payload, null, 2), err => {
    if (err) {
      console.error('Error saving processed data:', err);
      return res.status(500).json({ error: 'Failed to save processed data' });
    }
    res.json({ success: true });
  });
});

// Load processed data endpoint is now handled by the routes.js file
// This endpoint was removed to avoid conflicts with the new database-based approach

// Setup CSV upload and mapping routes
app.post('/api/setup/csv/upload', authenticateToken, csvUpload.single('csv'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    // Read the uploaded file
    const csvData = req.file.buffer.toString('utf8');
    
    // Parse CSV data
    const Papa = require('papaparse');
    const result = Papa.parse(csvData, { header: true });
    
    if (result.errors.length > 0) {
      return res.status(400).json({ error: 'Invalid CSV format' });
    }

    const headers = Object.keys(result.data[0] || {});
    const data = result.data.filter(row => Object.values(row).some(val => val !== ''));

    res.json({
      success: true,
      headers: headers,
      data: data,
      rowCount: data.length
    });
  } catch (error) {
    console.error('Error uploading CSV:', error);
    res.status(500).json({ error: 'Failed to upload CSV file' });
  }
});

app.post('/api/setup/csv/map', authenticateToken, (req, res) => {
  try {
    const { divisionColumn, clusterColumn } = req.body;
    
    if (!divisionColumn) {
      return res.status(400).json({ error: 'Division column is required' });
    }

    // For now, return a simple mapping structure
    // In a real implementation, you would process the CSV data here
    const mapping = {
      divisionColumn,
      clusterColumn: clusterColumn || null
    };

    // Mock extracted data for demonstration
    const extractedDivisions = ['Division A', 'Division B', 'Division C'];
    const extractedClusters = clusterColumn ? ['Cluster 1', 'Cluster 2', 'Cluster 3'] : [];

    res.json({
      success: true,
      mapping,
      extractedDivisions,
      extractedClusters
    });
  } catch (error) {
    console.error('Error mapping CSV columns:', error);
    res.status(500).json({ error: 'Failed to map CSV columns' });
  }
});

app.post('/api/setup/csv/extract', authenticateToken, (req, res) => {
  try {
    const { csvData, csvMapping } = req.body;
    
    if (!csvData || !csvMapping) {
      return res.status(400).json({ error: 'CSV data and mapping are required' });
    }

    // Extract divisions and clusters with their relationships
    const divisions = new Set();
    const clusters = new Set();
    const divisionClusterMap = {};

    csvData.forEach(row => {
      const divisionName = csvMapping.divisionColumn && row[csvMapping.divisionColumn] 
        ? row[csvMapping.divisionColumn].trim() 
        : null;
      const clusterName = csvMapping.clusterColumn && row[csvMapping.clusterColumn] 
        ? row[csvMapping.clusterColumn].trim() 
        : null;

      if (divisionName) {
        divisions.add(divisionName);
        
        // Initialize division's cluster array if it doesn't exist
        if (!divisionClusterMap[divisionName]) {
          divisionClusterMap[divisionName] = [];
        }
        
        // Add cluster to division's array if not already present
        if (clusterName && !divisionClusterMap[divisionName].includes(clusterName)) {
          divisionClusterMap[divisionName].push(clusterName);
          clusters.add(clusterName);
        }
      }
    });

    res.json({
      success: true,
      extractedDivisions: Array.from(divisions),
      extractedClusters: Array.from(clusters),
      divisionClusterMap: divisionClusterMap
    });
  } catch (error) {
    console.error('Error extracting organizational structure:', error);
    res.status(500).json({ error: 'Failed to extract organizational structure' });
  }
});



// --- Main Application Entry Point ---

if (mode === 'api') {
  // Mount the authentication routes
  app.use('/api/auth', authRoutes);
  
  // Mount the API routes
  app.use('/api', apiRoutes);
  
  // Mount the field mapping routes
  app.use('/api/field-mappings', fieldMappingRoutes);

  // Mount the field definition routes
  app.use('/api/field-definitions', fieldDefinitionRoutes);

  // Mount the division routes
  app.use('/api/divisions', divisionRoutes);

  // Mount the cluster routes
  app.use('/api/clusters', clusterRoutes);

  app.listen(PORT, () => {
    console.log(`Backend server running in API mode on http://localhost:${PORT}`);
    console.log('Authentication routes: /api/auth');
    console.log('API routes: /api');
  });
} else if (mode === 'worker') {
  // When in worker mode, the worker.js file should be run directly.
  // This server file's job is done. The package.json or start script
  // should run `node src/backend/worker.js`
  console.log('Starting worker... (This is a placeholder. The worker should be run as a separate process).');
  // runWorker(); // This was the source of the error.
} else {
  console.error(`Unknown mode: ${mode}. Use 'api' or 'worker'.`);
  process.exit(1);
} 