-- Migration: Rename 'jobs' table to 'optimization_jobs' for better clarity
-- This table stores optimization jobs, not generic jobs, so the name should reflect that

-- Step 1: Rename the main table
ALTER TABLE jobs RENAME TO optimization_jobs;

-- Step 2: Update the foreign key reference in the forecasts table
-- First, drop the existing foreign key constraint
ALTER TABLE forecasts DROP CONSTRAINT IF EXISTS forecasts_job_id_fkey;

-- Then add the new foreign key constraint with the renamed table
ALTER TABLE forecasts ADD CONSTRAINT forecasts_job_id_fkey 
    FOREIGN KEY (job_id) REFERENCES optimization_jobs(id);

-- Step 3: Update the index name to match the new table name
DROP INDEX IF EXISTS idx_jobs_company_status;
CREATE INDEX idx_optimization_jobs_company_status ON optimization_jobs (company_id, status);

-- Step 4: Add a comment to document the table's purpose
COMMENT ON TABLE optimization_jobs IS 'Stores optimization jobs for forecasting models including grid search and AI optimization results';

-- Step 5: Add comments to key columns for better documentation
COMMENT ON COLUMN optimization_jobs.method IS 'Optimization method: grid (grid search) or ai (AI optimization)';
COMMENT ON COLUMN optimization_jobs.payload IS 'JSONB containing job parameters, model types, and data';
COMMENT ON COLUMN optimization_jobs.result IS 'JSONB containing optimization results including metrics and parameters';
COMMENT ON COLUMN optimization_jobs.optimization_hash IS 'SHA-256 hash for deduplication to avoid redundant optimizations';
COMMENT ON COLUMN optimization_jobs.status IS 'Job status: pending, running, completed, failed, cancelled, skipped, merged';

-- Verification queries (run these to confirm the migration worked)
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'optimization_jobs';
-- SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'forecasts' AND constraint_type = 'FOREIGN KEY';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'optimization_jobs'; 