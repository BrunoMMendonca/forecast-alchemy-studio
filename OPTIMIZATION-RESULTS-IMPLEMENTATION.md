# Optimization Results Table Implementation

## Overview

This implementation adds a dedicated `optimization_results` table that works seamlessly with the existing `optimization_hash` system to provide efficient caching and reuse of optimization results.

## Table Structure

### `optimization_results` Table

```sql
CREATE TABLE IF NOT EXISTS optimization_results (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    job_id INTEGER REFERENCES optimization_jobs(id) ON DELETE CASCADE,
    optimization_hash TEXT NOT NULL,
    model_id TEXT NOT NULL,
    method TEXT NOT NULL,
    parameters JSONB,
    scores JSONB,
    forecasts JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Key Features

1. **Hash-Based Caching**: Uses existing `optimization_hash` for deduplication
2. **Multi-tenancy**: Company isolation for security
3. **Flexible Data Storage**: JSONB fields for parameters, scores, and forecasts
4. **Job Linking**: Optional link to specific jobs for tracking
5. **Performance Optimized**: Comprehensive indexing strategy

## Indexes

```sql
-- Core indexes
CREATE INDEX idx_optimization_results_company_id ON optimization_results(company_id);
CREATE INDEX idx_optimization_results_optimization_hash ON optimization_results(optimization_hash);
CREATE INDEX idx_optimization_results_job_id ON optimization_results(job_id);
CREATE INDEX idx_optimization_results_model_method ON optimization_results(model_id, method);
CREATE INDEX idx_optimization_results_created_at ON optimization_results(created_at);

-- Composite indexes
CREATE INDEX idx_optimization_results_company_hash ON optimization_results(company_id, optimization_hash);
CREATE INDEX idx_optimization_results_company_job ON optimization_results(company_id, job_id);

-- JSONB indexes
CREATE INDEX idx_optimization_results_scores_gin ON optimization_results USING GIN (scores);
CREATE INDEX idx_optimization_results_parameters_gin ON optimization_results USING GIN (parameters);
```

## Backend Functions

### Core Functions

1. **`checkExistingOptimizationResults(optimizationHash, companyId)`**
   - Checks for existing results by hash
   - Returns cached result if found

2. **`storeOptimizationResults(jobId, optimizationHash, modelId, method, parameters, scores, forecasts, companyId)`**
   - Stores new optimization results
   - Returns the result ID

3. **`createOptimizationJobWithResultCache(jobData)`**
   - Creates jobs with intelligent caching
   - Reuses existing results when possible
   - Returns job info with cache status

### Hash Generation

Uses existing `generateOptimizationHash()` function:
```javascript
function generateOptimizationHash(sku, modelId, method, datasetId, parameters = {}, metricWeights = null)
```

## API Endpoints

### 1. Get Optimization Results by Hash
```
GET /api/optimization-results/:hash?companyId=1
```
Returns cached results for a specific optimization hash.

### 2. Get Job Results
```
GET /api/jobs/:jobId/results
```
Returns all results associated with a specific job.

### 3. Create Job with Caching
```
POST /api/jobs/create-with-cache
```
Creates optimization jobs with automatic cache checking.

**Request Body:**
```json
{
  "sku": "95000000",
  "modelId": "ARIMA",
  "method": "grid",
  "datasetId": 1,
  "parameters": { "p": 1, "d": 1, "q": 1 },
  "metricWeights": { "mape": 0.4, "rmse": 0.3, "mae": 0.2, "accuracy": 0.1 },
  "payload": { "test": true },
  "reason": "test_optimization"
}
```

### 4. Cache Statistics
```
GET /api/jobs/cache-stats?companyId=1
```
Returns cache performance statistics.

### 5. Store Results (Worker Endpoint)
```
POST /api/optimization-results/store
```
Stores optimization results (used by worker processes).

## Usage Flow

### 1. Job Creation with Caching
```javascript
const jobData = {
  sku: '95000000',
  modelId: 'ARIMA',
  method: 'grid',
  datasetId: 1,
  parameters: { p: 1, d: 1, q: 1 }
};

const result = await createOptimizationJobWithResultCache(jobData);
// Returns: { jobId: 123, cached: true/false, resultId?: 456 }
```

### 2. Result Storage (Worker)
```javascript
const resultId = await storeOptimizationResults(
  jobId, optimizationHash, modelId, method, 
  parameters, scores, forecasts, companyId
);
```

### 3. Result Retrieval
```javascript
// By hash
const result = await checkExistingOptimizationResults(hash, companyId);

// By job ID
const results = await pgPool.query(
  'SELECT * FROM optimization_results WHERE job_id = $1',
  [jobId]
);
```

## Benefits

1. **Massive Performance Gain**: Skip expensive optimizations for repeated data
2. **Cost Savings**: Reduce computational resources
3. **Consistency**: Same data always produces same results
4. **Scalability**: Cache grows with usage, improving performance over time
5. **Backward Compatible**: Works with existing `optimization_hash` system
6. **Flexible**: Can handle multiple results per job

## Migration

Run the migration script:
```bash
# In DBeaver or your SQL client
\i create-optimization-results-table.sql
```

The migration:
- Creates the `optimization_results` table
- Adds all necessary indexes
- Migrates existing data from `optimization_jobs.result` field
- Adds proper triggers and documentation

## Testing

Use the test script to verify functionality:
```bash
node test-optimization-results.js
```

This tests:
- Cache statistics
- Job creation with caching
- Result retrieval
- Result storage
- Hash-based lookups

## Integration Points

### Frontend Integration
- Update job creation to use `/api/jobs/create-with-cache`
- Display cache hit information
- Show cache statistics

### Worker Integration
- Update workers to store results via `/api/optimization-results/store`
- Use `checkExistingOptimizationResults()` before running optimizations

### Existing Code
- No changes needed to `generateOptimizationHash()`
- No changes needed to existing job creation logic
- Backward compatible with current system

## Performance Monitoring

Monitor cache effectiveness:
```sql
-- Cache hit rate
SELECT 
  COUNT(*) as total_jobs,
  COUNT(DISTINCT optimization_hash) as unique_optimizations,
  ROUND(
    (COUNT(*) - COUNT(DISTINCT optimization_hash))::numeric / COUNT(*) * 100, 2
  ) as cache_hit_percentage
FROM optimization_jobs 
WHERE status = 'completed';
```

## Next Steps

1. **Run Migration**: Execute `create-optimization-results-table.sql`
2. **Test Functionality**: Run `test-optimization-results.js`
3. **Update Workers**: Modify worker processes to use new result storage
4. **Frontend Updates**: Update UI to show cache information
5. **Monitor Performance**: Track cache hit rates and optimization savings 