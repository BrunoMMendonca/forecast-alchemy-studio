import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './src/backend/db.js'; // Required to initialize the DB connection
import apiRoutes from './src/backend/routes.js';
import { runWorker } from './src/backend/worker.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2] || 'api';
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- Main Application Entry Point ---

if (mode === 'api') {
  // Mount the API routes
  app.use('/api', apiRoutes);

  app.listen(PORT, () => {
    console.log(`Backend server running in API mode on http://localhost:${PORT}`);
    console.log('Routes are available under the /api prefix');
  });
} else if (mode === 'worker') {
  runWorker();
} else {
  console.error(`Unknown mode: ${mode}. Use 'api' or 'worker'.`);
  process.exit(1);
} 