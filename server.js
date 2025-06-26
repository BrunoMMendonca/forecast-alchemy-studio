import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/backend/db.js'; // Required to initialize the DB connection
import apiRoutes from './src/backend/routes.js';
import fs from 'fs';
import multer from 'multer';
// import { runWorker } from './src/backend/worker.js'; // This is incorrect for the worker model

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

// Utility to generate dataset file names
function getDatasetFileName(baseName, hash, type, ext, discarded = false) {
  const shortHash = hash.slice(0, 8);
  const suffix = discarded ? '-discarded' : '';
  return `${baseName}-${shortHash}-${type}${suffix}.${ext}`;
}

// Endpoint to save cleaning data
app.post('/api/save-cleaning-data', (req, res) => {
  const { baseName, hash, cleanedData } = req.body;
  if (!baseName || !hash || !cleanedData) {
    return res.status(400).json({ error: 'Missing baseName, hash, or cleanedData' });
  }
  const fileName = getDatasetFileName(baseName, hash, 'cleaning', 'json');
  const filePath = path.join(__dirname, 'uploads', fileName);
  // Discard old cleaning files for this hash, skip the new one
  if (typeof discardOldFilesWithHash === 'function') {
    discardOldFilesWithHash(hash, [fileName]);
  }
  const payload = {
    hash,
    cleanedData,
    timestamp: new Date().toISOString(),
  };
  fs.writeFile(filePath, JSON.stringify(payload, null, 2), err => {
    if (err) {
      console.error('Error saving cleaning data:', err);
      return res.status(500).json({ error: 'Failed to save cleaning data' });
    }
    res.json({ success: true });
  });
});

// Endpoint to load cleaning data
app.get('/api/load-cleaning-data', (req, res) => {
  const { baseName, hash } = req.query;
  if (!baseName || !hash) {
    return res.status(400).json({ error: 'Missing baseName or hash' });
  }
  const fileName = getDatasetFileName(baseName, hash, 'cleaning', 'json');
  const filePath = path.join(__dirname, 'uploads', fileName);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Cleaning data not found' });
  }
});

// Save original CSV (multipart/form-data)
app.post('/api/save-original-csv', upload.single('file'), (req, res) => {
  const { baseName, hash } = req.body;
  if (!baseName || !hash || !req.file) {
    return res.status(400).json({ error: 'Missing baseName, hash, or file' });
  }
  const fileName = getDatasetFileName(baseName, hash, 'original', 'csv');
  const filePath = path.join(__dirname, 'uploads', fileName);
  fs.rename(req.file.path, filePath, err => {
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
  const filePath = path.join(__dirname, 'uploads', fileName);
  const payload = {
    hash,
    processedData,
    timestamp: new Date().toISOString(),
  };
  fs.writeFile(filePath, JSON.stringify(payload, null, 2), err => {
    if (err) {
      console.error('Error saving processed data:', err);
      return res.status(500).json({ error: 'Failed to save processed data' });
    }
    res.json({ success: true });
  });
});

// Load processed data (JSON)
app.get('/api/load-processed-data', (req, res) => {
  const { baseName, hash } = req.query;
  if (!baseName || !hash) {
    return res.status(400).json({ error: 'Missing baseName or hash' });
  }
  const fileName = getDatasetFileName(baseName, hash, 'processed', 'json');
  const filePath = path.join(__dirname, 'uploads', fileName);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Processed data not found' });
  }
});

// --- Main Application Entry Point ---

if (mode === 'api') {
  // Mount the API routes
  app.use('/api', apiRoutes);

  app.listen(PORT, () => {
    console.log(`Backend server running in API mode on http://localhost:${PORT}`);
    console.log('Routes are available under the /api prefix');
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