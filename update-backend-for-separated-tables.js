// =====================================================
// UPDATE BACKEND FOR SEPARATED OPTIMIZATION TABLES
// =====================================================
// This script updates the backend code to work with the new table structure:
// - optimization_jobs: Job metadata and status tracking
// - optimization_results: Optimization results and data
// =====================================================

import fs from 'fs';
import path from 'path';

// Files to update
const filesToUpdate = [
  'src/backend/routes.js',
  'src/backend/worker.js',
  'src/backend/init-postgres-schema.sql'
];

// =====================================================
// 1. UPDATE ROUTES.JS
// =====================================================

function updateRoutesFile() {
  console.log('🔄 Updating routes.js...');
  const routesPath = 'src/backend/routes.js';
  let routesContent = fs.readFileSync(routesPath, 'utf8');

  // Update job creation to remove result field and add dataset_identifier
  routesContent = routesContent.replace(
    /INSERT INTO optimization_jobs \(company_id, user_id, dataset_id, method, params\) VALUES/g,
    'INSERT INTO optimization_jobs (company_id, user_id, dataset_id, dataset_identifier, method, payload) VALUES'
  );

  routesContent = routesContent.replace(
    /VALUES \(\$1, \$2, \$3, \$4, \$5\) RETURNING id/g,
    'VALUES ($1, $2, $3, $4, $5, $6) RETURNING id'
  );

  routesContent = routesContent.replace(
    /\[1, 1, datasetId, method, JSON\.stringify\(params\)\]/g,
    '[1, 1, datasetId, datasetIdentifier, method, JSON.stringify(params)]'
  );

  // Update job status query to include dataset_identifier
  routesContent = routesContent.replace(
    /SELECT \* FROM optimization_jobs WHERE company_id = \$1 AND dataset_id = \$2/g,
    'SELECT oj.*, or.parameters, or.scores, or.forecasts FROM optimization_jobs oj LEFT JOIN optimization_results or ON oj.id = or.job_id WHERE oj.company_id = $1 AND oj.dataset_id = $2'
  );

  routesContent = routesContent.replace(
    /SELECT \* FROM optimization_jobs WHERE company_id = \$1 AND dataset_id = \$2 AND method = \$3/g,
    'SELECT oj.*, or.parameters, or.scores, or.forecasts FROM optimization_jobs oj LEFT JOIN optimization_results or ON oj.id = or.job_id WHERE oj.company_id = $1 AND oj.dataset_id = $2 AND oj.method = $3'
  );

  // Update best results query
  routesContent = routesContent.replace(
    /SELECT \* FROM optimization_jobs WHERE company_id = \$1 AND method = \$2/g,
    'SELECT oj.*, or.parameters, or.scores, or.forecasts FROM optimization_jobs oj LEFT JOIN optimization_results or ON oj.id = or.job_id WHERE oj.company_id = $1 AND oj.method = $2'
  );

  routesContent = routesContent.replace(
    /SELECT \* FROM optimization_jobs WHERE company_id = \$1/g,
    'SELECT oj.*, or.parameters, or.scores, or.forecasts FROM optimization_jobs oj LEFT JOIN optimization_results or ON oj.id = or.job_id WHERE oj.company_id = $1'
  );

  fs.writeFileSync(routesPath, routesContent);
  console.log('✅ Updated routes.js');
}

// =====================================================
// 2. UPDATE WORKER.JS
// =====================================================

function updateWorkerFile() {
  console.log('🔄 Updating worker.js...');
  const workerPath = 'src/backend/worker.js';
  let workerContent = fs.readFileSync(workerPath, 'utf8');

  // Update job processing to handle separated results
  // Replace the result parsing logic
  workerContent = workerContent.replace(
    /\/\/ Parse job data from the result column \(not data column\)[\s\S]*?jobData = \{\};/g,
    `// Parse job data from the payload column
      let jobData;
      try {
        if (job.payload) {
          // Handle case where payload is already an object
          if (typeof job.payload === 'object') {
            jobData = job.payload;
          } else if (typeof job.payload === 'string') {
            // Handle case where payload is a string that might not be valid JSON
            if (job.payload === '[object Object]' || job.payload === 'undefined') {
              console.warn(\`[Worker] Job \${job.id} has invalid payload format: \${job.payload}\`);
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
        console.error(\`[Worker] Failed to parse job payload for job \${job.id}:\`, parseError);
        console.error(\`[Worker] Job payload value:\`, job.payload);
        jobData = {};
      }`
  );

  // Update the result storage to use the new optimization_results table
  workerContent = workerContent.replace(
    /await dbRun\('UPDATE optimization_jobs SET status = \$1, progress = 100, completed_at = \$2, updated_at = \$3, result = \$4 WHERE id = \$5', \['completed', new Date\(\)\.toISOString\(\), new Date\(\)\.toISOString\(\), JSON\.stringify\(results\), job\.id\]\);/g,
    `// Store optimization results in the new table
      const resultData = {
        parameters: results.results.map(r => r.parameters).filter(Boolean),
        scores: results.results.map(r => ({ modelType: r.modelType, accuracy: r.accuracy, rmse: r.rmse, mape: r.mape })).filter(Boolean),
        forecasts: results.results.map(r => r.forecast).filter(Boolean)
      };
      
      await dbRun('INSERT INTO optimization_results (job_id, parameters, scores, forecasts) VALUES ($1, $2, $3, $4)', 
        [job.id, JSON.stringify(resultData.parameters), JSON.stringify(resultData.scores), JSON.stringify(resultData.forecasts)]);
      
      await dbRun('UPDATE optimization_jobs SET status = $1, progress = 100, completed_at = $2, updated_at = $3 WHERE id = $4', 
        ['completed', new Date().toISOString(), new Date().toISOString(), job.id]);`
  );

  // Update job polling to include dataset_identifier
  workerContent = workerContent.replace(
    /const job = await dbGet\('SELECT \* FROM optimization_jobs WHERE company_id = \$1 AND user_id = \$2 AND status = \$3 ORDER BY created_at ASC LIMIT 1', \[companyId, userId, 'pending'\]\);/g,
    `const job = await dbGet('SELECT oj.*, or.parameters, or.scores, or.forecasts FROM optimization_jobs oj LEFT JOIN optimization_results or ON oj.id = or.job_id WHERE oj.company_id = $1 AND oj.user_id = $2 AND oj.status = $3 ORDER BY oj.created_at ASC LIMIT 1', [companyId, userId, 'pending']);`
  );

  fs.writeFileSync(workerPath, workerContent);
  console.log('✅ Updated worker.js');
}

// =====================================================
// 3. UPDATE SCHEMA FILE
// =====================================================

function updateSchemaFile() {
  console.log('🔄 Updating init-postgres-schema.sql...');
  const schemaPath = 'src/backend/init-postgres-schema.sql';
  let schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Replace the optimization_jobs table definition
  const oldTableDefinition = `-- Optimization Jobs (renamed from jobs for clarity)
CREATE TABLE IF NOT EXISTS optimization_jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    sku_id INTEGER REFERENCES skus(id),
    sku TEXT, -- Actual SKU code (e.g., 95000000) for easier querying
    dataset_id INTEGER REFERENCES datasets(id),
    method TEXT,
    payload JSONB,
    reason TEXT,
    batch_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    result JSONB,
    error TEXT,
    priority INTEGER DEFAULT 1,
    optimization_id TEXT,
    optimization_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);`;

  const newTableDefinition = `-- Optimization Jobs (job metadata and status tracking)
CREATE TABLE IF NOT EXISTS optimization_jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    sku_id INTEGER REFERENCES skus(id),
    sku TEXT, -- Actual SKU code (e.g., 95000000) for easier querying
    dataset_id INTEGER REFERENCES datasets(id),
    dataset_identifier VARCHAR(255), -- Dataset identifier in format dataset_XX
    method TEXT,
    payload JSONB,
    reason TEXT,
    batch_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    error TEXT,
    priority INTEGER DEFAULT 1,
    optimization_id TEXT,
    optimization_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Optimization Results (optimization results and data)
CREATE TABLE IF NOT EXISTS optimization_results (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES optimization_jobs(id) ON DELETE CASCADE,
    parameters JSONB,
    scores JSONB,
    forecasts JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);`;

  schemaContent = schemaContent.replace(oldTableDefinition, newTableDefinition);

  // Update indexes section
  const oldIndexes = `-- Optimization Jobs indexes
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_user ON optimization_jobs(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_status ON optimization_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_sku ON optimization_jobs(sku);`;

  const newIndexes = `-- Optimization Jobs indexes
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_user ON optimization_jobs(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_status ON optimization_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_sku ON optimization_jobs(sku);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_dataset ON optimization_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_dataset_identifier ON optimization_jobs(dataset_identifier);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_batch_id ON optimization_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_optimization_id ON optimization_jobs(optimization_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_optimization_hash ON optimization_jobs(optimization_hash);

-- Optimization Results indexes
CREATE INDEX IF NOT EXISTS idx_optimization_results_job_id ON optimization_results(job_id);
CREATE INDEX IF NOT EXISTS idx_optimization_results_created_at ON optimization_results(created_at);`;

  schemaContent = schemaContent.replace(oldIndexes, newIndexes);

  // Add triggers for optimization_results
  const triggersSection = `-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create function to automatically set updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to optimization_results
CREATE TRIGGER update_optimization_results_updated_at 
    BEFORE UPDATE ON optimization_results 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to optimization_jobs
CREATE TRIGGER update_optimization_jobs_updated_at 
    BEFORE UPDATE ON optimization_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;

  // Find where to insert the triggers (after the existing triggers)
  const triggerInsertPoint = schemaContent.lastIndexOf('CREATE TRIGGER');
  if (triggerInsertPoint !== -1) {
    const lastTriggerEnd = schemaContent.indexOf(';', triggerInsertPoint) + 1;
    schemaContent = schemaContent.slice(0, lastTriggerEnd) + '\n\n' + triggersSection + schemaContent.slice(lastTriggerEnd);
  }

  fs.writeFileSync(schemaPath, schemaContent);
  console.log('✅ Updated init-postgres-schema.sql');
}

// =====================================================
// 4. CREATE NEW UTILITY FUNCTIONS
// =====================================================

function createUtilityFunctions() {
  console.log('🔄 Creating utility functions...');
  
  const utilityContent = `// =====================================================
// UTILITY FUNCTIONS FOR SEPARATED OPTIMIZATION TABLES
// =====================================================

import { pgPool } from './db.js';

/**
 * Store optimization results in the new separated table structure
 * @param {number} jobId - The optimization job ID
 * @param {object} results - The optimization results
 * @returns {Promise<void>}
 */
export async function storeOptimizationResults(jobId, results) {
  try {
    // Extract and structure the results
    const resultData = {
      parameters: results.results?.map(r => r.parameters).filter(Boolean) || [],
      scores: results.results?.map(r => ({ 
        modelType: r.modelType, 
        accuracy: r.accuracy, 
        rmse: r.rmse, 
        mape: r.mape 
      })).filter(Boolean) || [],
      forecasts: results.results?.map(r => r.forecast).filter(Boolean) || []
    };

    // Insert into optimization_results table
    await pgPool.query(
      'INSERT INTO optimization_results (job_id, parameters, scores, forecasts) VALUES ($1, $2, $3, $4)',
      [jobId, JSON.stringify(resultData.parameters), JSON.stringify(resultData.scores), JSON.stringify(resultData.forecasts)]
    );

    console.log(\`[Utility] Stored optimization results for job \${jobId}\`);
  } catch (error) {
    console.error(\`[Utility] Failed to store optimization results for job \${jobId}:\`, error);
    throw error;
  }
}

/**
 * Get optimization results for a job
 * @param {number} jobId - The optimization job ID
 * @returns {Promise<object|null>}
 */
export async function getOptimizationResults(jobId) {
  try {
    const result = await pgPool.query(
      'SELECT parameters, scores, forecasts FROM optimization_results WHERE job_id = $1',
      [jobId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      parameters: row.parameters || [],
      scores: row.scores || [],
      forecasts: row.forecasts || []
    };
  } catch (error) {
    console.error(\`[Utility] Failed to get optimization results for job \${jobId}:\`, error);
    throw error;
  }
}

/**
 * Get job with results (combined query)
 * @param {number} jobId - The optimization job ID
 * @returns {Promise<object|null>}
 */
export async function getJobWithResults(jobId) {
  try {
    const result = await pgPool.query(
      \`SELECT oj.*, or.parameters, or.scores, or.forecasts 
       FROM optimization_jobs oj 
       LEFT JOIN optimization_results or ON oj.id = or.job_id 
       WHERE oj.id = $1\`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error(\`[Utility] Failed to get job with results for job \${jobId}:\`, error);
    throw error;
  }
}

/**
 * Get jobs with results for a dataset
 * @param {number} companyId - The company ID
 * @param {number} datasetId - The dataset ID
 * @param {string} method - Optional method filter
 * @returns {Promise<Array>}
 */
export async function getJobsWithResults(companyId, datasetId, method = null) {
  try {
    let query = \`SELECT oj.*, or.parameters, or.scores, or.forecasts 
                  FROM optimization_jobs oj 
                  LEFT JOIN optimization_results or ON oj.id = or.job_id 
                  WHERE oj.company_id = $1 AND oj.dataset_id = $2\`;
    let params = [companyId, datasetId];

    if (method && method !== 'all') {
      query += ' AND oj.method = $3';
      params.push(method);
    }

    query += ' ORDER BY oj.created_at DESC';

    const result = await pgPool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error(\`[Utility] Failed to get jobs with results for dataset \${datasetId}:\`, error);
    throw error;
  }
}
`;

  fs.writeFileSync('src/backend/optimizationUtils.js', utilityContent);
  console.log('✅ Created optimizationUtils.js');
}

// =====================================================
// 5. MAIN EXECUTION
// =====================================================

async function main() {
  console.log('🚀 Starting backend update for separated optimization tables...\n');

  try {
    updateRoutesFile();
    updateWorkerFile();
    updateSchemaFile();
    createUtilityFunctions();

    console.log('\n✅ Backend update completed successfully!');
    console.log('\n📋 Summary of changes:');
    console.log('  • Updated routes.js to use separated tables');
    console.log('  • Updated worker.js to store results in optimization_results table');
    console.log('  • Updated schema file to reflect new structure');
    console.log('  • Created utility functions for result management');
    console.log('\n🔄 Next steps:');
    console.log('  1. Restart your backend server');
    console.log('  2. Test job creation and result retrieval');
    console.log('  3. Verify that existing functionality still works');

  } catch (error) {
    console.error('❌ Error updating backend:', error);
    process.exit(1);
  }
}

// Run the update
main(); 