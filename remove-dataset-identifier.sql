-- Migration: Remove dataset_identifier column from optimization_jobs
-- This simplifies the schema to use only dataset_id (numeric) as the canonical identifier

-- Remove the dataset_identifier column
ALTER TABLE optimization_jobs DROP COLUMN IF EXISTS dataset_identifier;

-- Remove the index on dataset_identifier (if it exists)
DROP INDEX IF EXISTS idx_optimization_jobs_dataset_identifier;

-- Verify the table structure
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'optimization_jobs' ORDER BY ordinal_position; 