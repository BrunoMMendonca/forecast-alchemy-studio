-- =====================================================
-- ROLLBACK: Revert Optimization Jobs and Results Separation
-- =====================================================
-- This script reverts the separation of optimization_jobs and optimization_results
-- back to the original single table structure
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CREATE THE ORIGINAL TABLE STRUCTURE
-- =====================================================

-- Create the original optimization_jobs table structure
CREATE TABLE IF NOT EXISTS optimization_jobs_original (
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
    result JSONB, -- This field will contain the combined results
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
-- 2. MIGRATE DATA BACK TO ORIGINAL STRUCTURE
-- =====================================================

-- Migrate job metadata and combine with results
INSERT INTO optimization_jobs_original (
    id, company_id, user_id, sku_id, sku, dataset_id, method, payload, 
    reason, batch_id, status, progress, error, priority, optimization_id, 
    optimization_hash, created_at, updated_at, started_at, completed_at, result
)
SELECT 
    oj.id, oj.company_id, oj.user_id, oj.sku_id, oj.sku, oj.dataset_id, 
    oj.method, oj.payload, oj.reason, oj.batch_id, oj.status, oj.progress, 
    oj.error, oj.priority, oj.optimization_id, oj.optimization_hash, 
    oj.created_at, oj.updated_at, oj.started_at, oj.completed_at,
    CASE 
        WHEN orr.id IS NOT NULL THEN 
            jsonb_build_object(
                'parameters', COALESCE(orr.parameters, '{}'::jsonb),
                'scores', COALESCE(orr.scores, '{}'::jsonb),
                'forecasts', COALESCE(orr.forecasts, '{}'::jsonb)
            )
        ELSE NULL 
    END as result
FROM optimization_jobs oj
LEFT JOIN optimization_results orr ON oj.id = orr.job_id;

-- =====================================================
-- 3. UPDATE SEQUENCES
-- =====================================================

-- Update the sequence for optimization_jobs_original to continue from the max ID
SELECT setval('optimization_jobs_original_id_seq', (SELECT MAX(id) FROM optimization_jobs_original));

-- =====================================================
-- 4. HANDLE FOREIGN KEY DEPENDENCIES AND RENAME TABLES
-- =====================================================

-- First, drop the foreign key constraint from forecasts table
ALTER TABLE forecasts DROP CONSTRAINT IF EXISTS forecasts_job_id_fkey;

-- Drop the new tables
DROP TABLE IF EXISTS optimization_results;
DROP TABLE optimization_jobs;

-- Rename the original table back to the original name
ALTER TABLE optimization_jobs_original RENAME TO optimization_jobs;

-- Recreate the foreign key constraint on the original table
ALTER TABLE forecasts 
ADD CONSTRAINT forecasts_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES optimization_jobs(id);

-- =====================================================
-- 5. RECREATE ORIGINAL INDEXES
-- =====================================================

-- Recreate the original indexes
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_user ON optimization_jobs(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_status ON optimization_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_sku ON optimization_jobs(sku);

-- =====================================================
-- 6. ADD ORIGINAL COMMENTS
-- =====================================================

COMMENT ON TABLE optimization_jobs IS 'Stores optimization jobs for forecasting models including grid search and AI optimization results';
COMMENT ON COLUMN optimization_jobs.method IS 'Optimization method: grid (grid search) or ai (AI optimization)';
COMMENT ON COLUMN optimization_jobs.payload IS 'JSONB containing job parameters, model types, and data';
COMMENT ON COLUMN optimization_jobs.result IS 'JSONB containing optimization results including metrics and parameters';
COMMENT ON COLUMN optimization_jobs.optimization_hash IS 'SHA-256 hash for deduplication to avoid redundant optimizations';
COMMENT ON COLUMN optimization_jobs.status IS 'Job status: pending, running, completed, failed, cancelled, skipped, merged';

-- =====================================================
-- 7. UPDATE TRIGGERS
-- =====================================================

-- Create trigger to automatically update updated_at for optimization_jobs
CREATE TRIGGER update_optimization_jobs_updated_at 
    BEFORE UPDATE ON optimization_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. VERIFICATION QUERIES
-- =====================================================

-- Verify the rollback was successful
SELECT 
    'optimization_jobs' as table_name,
    COUNT(*) as row_count,
    COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as jobs_with_results
FROM optimization_jobs;

-- Check that optimization_results table no longer exists
SELECT 
    'optimization_results_exists' as check_type,
    COUNT(*) as exists
FROM information_schema.tables 
WHERE table_name = 'optimization_results';

COMMIT;

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================
-- 
-- Summary of rollback:
-- 1. Recreated the original optimization_jobs table structure
-- 2. Migrated data back from the separated tables
-- 3. Combined optimization results back into the result JSONB field
-- 4. Dropped the optimization_results table
-- 5. Recreated original indexes and comments
-- 6. Added update triggers
--
-- The database is now back to the original structure
-- ===================================================== 