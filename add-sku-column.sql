-- Migration: Add sku column to optimization_jobs table
-- This column will store the actual SKU code (like '95000000') for easier querying

-- Add the sku column
ALTER TABLE optimization_jobs ADD COLUMN sku TEXT;

-- Add an index for better performance on SKU queries
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_sku ON optimization_jobs (sku);

-- Add a comment to document the column's purpose
COMMENT ON COLUMN optimization_jobs.sku IS 'Actual SKU code (e.g., 95000000) for easier querying without joins';

-- Update existing jobs to populate the sku column from the skus table
-- This is a one-time migration for existing data
UPDATE optimization_jobs 
SET sku = skus.sku_code 
FROM skus 
WHERE optimization_jobs.sku_id = skus.id 
AND optimization_jobs.sku IS NULL;

-- Verification query
-- SELECT COUNT(*) as total_jobs, COUNT(sku) as jobs_with_sku FROM optimization_jobs; 