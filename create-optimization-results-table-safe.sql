-- =====================================================
-- MIGRATION: Create Optimization Results Table (SAFE VERSION)
-- =====================================================
-- This migration creates the optimization_results table with proper error handling
-- and transaction management to avoid aborted transaction issues
-- =====================================================

-- First, ensure we start with a clean transaction state
ROLLBACK;

BEGIN;

-- =====================================================
-- 1. VERIFY CURRENT STATE
-- =====================================================

-- Check if optimization_results table already exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'optimization_results') THEN
        RAISE NOTICE 'optimization_results table already exists - skipping creation';
    ELSE
        RAISE NOTICE 'Creating optimization_results table...';
    END IF;
END $$;

-- =====================================================
-- 2. CREATE OPTIMIZATION RESULTS TABLE
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
-- 3. ADD INDEXES FOR PERFORMANCE (WITH ERROR HANDLING)
-- =====================================================

-- Core indexes
DO $$
BEGIN
    -- Company ID index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_company_id') THEN
        CREATE INDEX idx_optimization_results_company_id ON optimization_results(company_id);
        RAISE NOTICE 'Created index: idx_optimization_results_company_id';
    END IF;
    
    -- Optimization hash index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_optimization_hash') THEN
        CREATE INDEX idx_optimization_results_optimization_hash ON optimization_results(optimization_hash);
        RAISE NOTICE 'Created index: idx_optimization_results_optimization_hash';
    END IF;
    
    -- Job ID index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_job_id') THEN
        CREATE INDEX idx_optimization_results_job_id ON optimization_results(job_id);
        RAISE NOTICE 'Created index: idx_optimization_results_job_id';
    END IF;
    
    -- Model method index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_model_method') THEN
        CREATE INDEX idx_optimization_results_model_method ON optimization_results(model_id, method);
        RAISE NOTICE 'Created index: idx_optimization_results_model_method';
    END IF;
    
    -- Created at index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_created_at') THEN
        CREATE INDEX idx_optimization_results_created_at ON optimization_results(created_at);
        RAISE NOTICE 'Created index: idx_optimization_results_created_at';
    END IF;
    
    -- Composite indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_company_hash') THEN
        CREATE INDEX idx_optimization_results_company_hash ON optimization_results(company_id, optimization_hash);
        RAISE NOTICE 'Created index: idx_optimization_results_company_hash';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_company_job') THEN
        CREATE INDEX idx_optimization_results_company_job ON optimization_results(company_id, job_id);
        RAISE NOTICE 'Created index: idx_optimization_results_company_job';
    END IF;
    
    -- JSONB indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_scores_gin') THEN
        CREATE INDEX idx_optimization_results_scores_gin ON optimization_results USING GIN (scores);
        RAISE NOTICE 'Created index: idx_optimization_results_scores_gin';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_parameters_gin') THEN
        CREATE INDEX idx_optimization_results_parameters_gin ON optimization_results USING GIN (parameters);
        RAISE NOTICE 'Created index: idx_optimization_results_parameters_gin';
    END IF;
    
END $$;

-- =====================================================
-- 4. ADD TRIGGER FOR UPDATED_AT
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
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_optimization_results_updated_at') THEN
        CREATE TRIGGER update_optimization_results_updated_at 
            BEFORE UPDATE ON optimization_results 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger: update_optimization_results_updated_at';
    END IF;
END $$;

-- =====================================================
-- 5. MIGRATE EXISTING DATA (WITH ERROR HANDLING)
-- =====================================================

DO $$
DECLARE
    migrated_count INTEGER := 0;
BEGIN
    -- Check if optimization_jobs table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'optimization_jobs') THEN
        
        -- Count existing results to avoid duplicate migration
        SELECT COUNT(*) INTO migrated_count FROM optimization_results;
        
        IF migrated_count = 0 THEN
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
            
            GET DIAGNOSTICS migrated_count = ROW_COUNT;
            RAISE NOTICE 'Migrated % rows from optimization_jobs.result to optimization_results', migrated_count;
        ELSE
            RAISE NOTICE 'optimization_results table already has data - skipping migration';
        END IF;
    ELSE
        RAISE NOTICE 'optimization_jobs table does not exist - skipping migration';
    END IF;
END $$;

-- =====================================================
-- 6. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE optimization_results IS 'Stores optimization results with hash-based caching for reuse';
COMMENT ON COLUMN optimization_results.optimization_hash IS 'SHA-256 hash for deduplication and caching - matches optimization_jobs.optimization_hash';
COMMENT ON COLUMN optimization_results.model_id IS 'Model identifier (e.g., ARIMA, SARIMA, HoltWinters)';
COMMENT ON COLUMN optimization_results.method IS 'Optimization method (grid, ai)';
COMMENT ON COLUMN optimization_results.parameters IS 'JSONB containing optimized model parameters';
COMMENT ON COLUMN optimization_results.scores IS 'JSONB containing model performance scores (MAPE, RMSE, MAE, accuracy)';
COMMENT ON COLUMN optimization_results.forecasts IS 'JSONB containing forecast predictions and confidence intervals';

-- =====================================================
-- 7. VERIFICATION QUERIES
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
    CASE 
        WHEN COUNT(DISTINCT optimization_hash) > 0 
        THEN ROUND(COUNT(*)::numeric / COUNT(DISTINCT optimization_hash), 2)
        ELSE 0 
    END as avg_results_per_hash
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