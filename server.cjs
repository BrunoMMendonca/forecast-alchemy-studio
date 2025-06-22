const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/backend/db'); // Required to initialize the DB connection
const apiRoutes = require('./src/backend/routes');
const { runWorker } = require('./src/backend/worker');

require('dotenv').config();

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