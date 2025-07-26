-- =====================================================
-- MIGRATION: Create Optimization Results Table
-- =====================================================
-- This migration creates the optimization_results table that works with
-- the existing optimization_hash system for efficient caching and reuse
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CREATE OPTIMIZATION RESULTS TABLE
-- =====================================================

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

-- =====================================================
-- 2. ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_optimization_results_company_id ON optimization_results(company_id);
CREATE INDEX IF NOT EXISTS idx_optimization_results_optimization_hash ON optimization_results(optimization_hash);
CREATE INDEX IF NOT EXISTS idx_optimization_results_job_id ON optimization_results(job_id);
CREATE INDEX IF NOT EXISTS idx_optimization_results_model_method ON optimization_results(model_id, method);
CREATE INDEX IF NOT EXISTS idx_optimization_results_created_at ON optimization_results(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_optimization_results_company_hash ON optimization_results(company_id, optimization_hash);
CREATE INDEX IF NOT EXISTS idx_optimization_results_company_job ON optimization_results(company_id, job_id);

-- JSONB indexes for querying specific fields
CREATE INDEX IF NOT EXISTS idx_optimization_results_scores_gin ON optimization_results USING GIN (scores);
CREATE INDEX IF NOT EXISTS idx_optimization_results_parameters_gin ON optimization_results USING GIN (parameters);

-- =====================================================
-- 3. ADD TRIGGER FOR UPDATED_AT
-- =====================================================

-- Create function to automatically set updated_at (if it doesn't exist)
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

-- =====================================================
-- 4. MIGRATE EXISTING DATA (if any)
-- =====================================================

-- Migrate existing optimization data from optimization_jobs.result field
INSERT INTO optimization_results (company_id, job_id, optimization_hash, model_id, method, parameters, scores, forecasts)
SELECT 
    oj.company_id,
    oj.id as job_id,
    oj.optimization_hash,
    oj.model_id,
    oj.method,
    CASE 
        WHEN oj.result IS NOT NULL AND oj.result::text != 'null' 
        THEN oj.result->'parameters'
        ELSE NULL 
    END as parameters,
    CASE 
        WHEN oj.result IS NOT NULL AND oj.result::text != 'null' 
        THEN oj.result->'scores'
        ELSE NULL 
    END as scores,
    CASE 
        WHEN oj.result IS NOT NULL AND oj.result::text != 'null' 
        THEN oj.result->'forecasts'
        ELSE NULL 
    END as forecasts
FROM optimization_jobs oj
WHERE oj.result IS NOT NULL 
  AND oj.result::text != 'null'
  AND oj.optimization_hash IS NOT NULL
  AND oj.model_id IS NOT NULL;

-- =====================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE optimization_results IS 'Stores optimization results with hash-based caching for reuse';
COMMENT ON COLUMN optimization_results.optimization_hash IS 'SHA-256 hash for deduplication and caching - matches optimization_jobs.optimization_hash';
COMMENT ON COLUMN optimization_results.model_id IS 'Model identifier (e.g., ARIMA, SARIMA, HoltWinters)';
COMMENT ON COLUMN optimization_results.method IS 'Optimization method (grid, ai)';
COMMENT ON COLUMN optimization_results.parameters IS 'JSONB containing optimized model parameters';
COMMENT ON COLUMN optimization_results.scores IS 'JSONB containing model performance scores (MAPE, RMSE, MAE, accuracy)';
COMMENT ON COLUMN optimization_results.forecasts IS 'JSONB containing forecast predictions and confidence intervals';

-- =====================================================
-- 6. VERIFICATION QUERIES
-- =====================================================

-- Verify the migration was successful
SELECT 
    'optimization_results' as table_name,
    COUNT(*) as row_count
FROM optimization_results;

-- Check for any orphaned results (should be 0 after migration)
SELECT 
    'orphaned_results' as check_type,
    COUNT(*) as count
FROM optimization_results orr
LEFT JOIN optimization_jobs oj ON orr.job_id = oj.id
WHERE oj.id IS NULL;

-- Check hash distribution
SELECT 
    'hash_distribution' as check_type,
    COUNT(DISTINCT optimization_hash) as unique_hashes,
    COUNT(*) as total_results,
    ROUND(COUNT(*)::numeric / COUNT(DISTINCT optimization_hash), 2) as avg_results_per_hash
FROM optimization_results;

COMMIT;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- 
-- Summary of changes:
-- 1. Created optimization_results table for storing optimization data
-- 2. Added comprehensive indexes for performance
-- 3. Migrated existing data from optimization_jobs.result field
-- 4. Added proper triggers and documentation
-- 5. Reuses existing optimization_hash system for caching
--
-- Next steps:
-- 1. Update backend code to use the new table structure
-- 2. Implement caching logic using optimization_hash
-- 3. Test job creation and result retrieval
-- ===================================================== 