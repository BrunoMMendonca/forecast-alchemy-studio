-- =====================================================
-- MIGRATION: Separate Optimization Jobs and Results (SAFE VERSION)
-- =====================================================
-- This migration separates the optimization_jobs table into two distinct tables:
-- 1. optimization_jobs - Job metadata and status tracking
-- 2. optimization_results - Optimization results and data
-- =====================================================

-- First, ensure we start with a clean transaction state
ROLLBACK;

BEGIN;

-- =====================================================
-- 1. VERIFY CURRENT STATE
-- =====================================================

-- Check if optimization_jobs table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'optimization_jobs') THEN
        RAISE EXCEPTION 'optimization_jobs table does not exist';
    END IF;
END $$;

-- Check if optimization_results table already exists (should not)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'optimization_results') THEN
        RAISE EXCEPTION 'optimization_results table already exists - migration may have been run before';
    END IF;
END $$;

-- =====================================================
-- 2. CREATE NEW TABLES
-- =====================================================

-- Create the new optimization_results table
CREATE TABLE IF NOT EXISTS optimization_results (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL,
    parameters JSONB,
    scores JSONB,
    forecasts JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create the new optimization_jobs table (replacing the old one)
CREATE TABLE IF NOT EXISTS optimization_jobs_new (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    sku_id INTEGER REFERENCES skus(id),
    sku TEXT, -- Actual SKU code (e.g., 95000000) for easier querying
    dataset_id INTEGER REFERENCES datasets(id),
    dataset_identifier VARCHAR(255), -- Add this field for consistency
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

-- =====================================================
-- 3. MIGRATE EXISTING DATA
-- =====================================================

-- Migrate job metadata to the new table
INSERT INTO optimization_jobs_new (
    id, company_id, user_id, sku_id, sku, dataset_id, method, payload, 
    reason, batch_id, status, progress, error, priority, optimization_id, 
    optimization_hash, created_at, updated_at, started_at, completed_at
)
SELECT 
    id, company_id, user_id, sku_id, sku, dataset_id, method, payload,
    reason, batch_id, status, progress, error, priority, optimization_id,
    optimization_hash, created_at, updated_at, started_at, completed_at
FROM optimization_jobs;

-- Migrate optimization results to the new results table
INSERT INTO optimization_results (job_id, parameters, scores, forecasts, created_at, updated_at)
SELECT 
    id as job_id,
    CASE 
        WHEN result IS NOT NULL AND result::text != 'null' 
        THEN result->'parameters'
        ELSE NULL 
    END as parameters,
    CASE 
        WHEN result IS NOT NULL AND result::text != 'null' 
        THEN result->'scores'
        ELSE NULL 
    END as scores,
    CASE 
        WHEN result IS NOT NULL AND result::text != 'null' 
        THEN result->'forecasts'
        ELSE NULL 
    END as forecasts,
    created_at,
    updated_at
FROM optimization_jobs
WHERE result IS NOT NULL AND result::text != 'null';

-- =====================================================
-- 4. UPDATE SEQUENCES
-- =====================================================

-- Update the sequence for optimization_jobs_new to continue from the max ID
SELECT setval('optimization_jobs_new_id_seq', COALESCE((SELECT MAX(id) FROM optimization_jobs_new), 1));

-- =====================================================
-- 5. HANDLE FOREIGN KEY DEPENDENCIES AND RENAME TABLES
-- =====================================================

-- First, drop the foreign key constraint from forecasts table
ALTER TABLE forecasts DROP CONSTRAINT IF EXISTS forecasts_job_id_fkey;

-- Drop the old table (this will also drop the old indexes)
DROP TABLE optimization_jobs;

-- Rename the new table to the original name
ALTER TABLE optimization_jobs_new RENAME TO optimization_jobs;

-- Recreate the foreign key constraint on the new table
ALTER TABLE forecasts 
ADD CONSTRAINT forecasts_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES optimization_jobs(id);

-- =====================================================
-- 6. ADD FOREIGN KEY CONSTRAINT
-- =====================================================

-- Add foreign key constraint from optimization_results to optimization_jobs
ALTER TABLE optimization_results 
ADD CONSTRAINT fk_optimization_results_job_id 
FOREIGN KEY (job_id) REFERENCES optimization_jobs(id) ON DELETE CASCADE;

-- =====================================================
-- 7. RECREATE INDEXES
-- =====================================================

-- Recreate indexes for optimization_jobs
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_user ON optimization_jobs(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_status ON optimization_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_sku ON optimization_jobs(sku);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_dataset ON optimization_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_dataset_identifier ON optimization_jobs(dataset_identifier);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_batch_id ON optimization_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_optimization_id ON optimization_jobs(optimization_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_optimization_hash ON optimization_jobs(optimization_hash);

-- Create indexes for optimization_results
CREATE INDEX IF NOT EXISTS idx_optimization_results_job_id ON optimization_results(job_id);
CREATE INDEX IF NOT EXISTS idx_optimization_results_created_at ON optimization_results(created_at);

-- =====================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE optimization_jobs IS 'Stores optimization job metadata and status tracking';
COMMENT ON TABLE optimization_results IS 'Stores optimization results including parameters, scores, and forecasts';

COMMENT ON COLUMN optimization_jobs.method IS 'Optimization method: grid (grid search) or ai (AI optimization)';
COMMENT ON COLUMN optimization_jobs.payload IS 'JSONB containing job parameters, model types, and data';
COMMENT ON COLUMN optimization_jobs.status IS 'Job status: pending, running, completed, failed, cancelled, skipped, merged';
COMMENT ON COLUMN optimization_jobs.optimization_hash IS 'SHA-256 hash for deduplication to avoid redundant optimizations';
COMMENT ON COLUMN optimization_jobs.dataset_identifier IS 'Dataset identifier in format dataset_XX for consistency';

COMMENT ON COLUMN optimization_results.parameters IS 'JSONB containing optimized model parameters';
COMMENT ON COLUMN optimization_results.scores IS 'JSONB containing model performance scores and metrics';
COMMENT ON COLUMN optimization_results.forecasts IS 'JSONB containing forecast predictions and confidence intervals';

-- =====================================================
-- 9. UPDATE TRIGGERS
-- =====================================================

-- Create trigger to automatically update updated_at for optimization_results
CREATE TRIGGER update_optimization_results_updated_at 
    BEFORE UPDATE ON optimization_results 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to automatically update updated_at for optimization_jobs
CREATE TRIGGER update_optimization_jobs_updated_at 
    BEFORE UPDATE ON optimization_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. VERIFICATION QUERIES
-- =====================================================

-- Verify the migration was successful
SELECT 
    'optimization_jobs' as table_name,
    COUNT(*) as row_count
FROM optimization_jobs
UNION ALL
SELECT 
    'optimization_results' as table_name,
    COUNT(*) as row_count
FROM optimization_results;

-- Check for any orphaned results (should be 0)
SELECT 
    'orphaned_results' as check_type,
    COUNT(*) as count
FROM optimization_results orr
LEFT JOIN optimization_jobs oj ON orr.job_id = oj.id
WHERE oj.id IS NULL;

COMMIT;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- 
-- Summary of changes:
-- 1. Created optimization_results table for storing optimization data
-- 2. Migrated existing result data from optimization_jobs to optimization_results
-- 3. Cleaned up optimization_jobs table to focus on job metadata
-- 4. Added dataset_identifier field for consistency
-- 5. Recreated all necessary indexes
-- 6. Added proper foreign key constraints
-- 7. Added documentation comments
-- 8. Added update triggers for both tables
--
-- Next steps:
-- 1. Update backend code to use the new table structure
-- 2. Update frontend code to handle the separated data
-- 3. Test job creation and result retrieval
-- ===================================================== 