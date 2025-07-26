-- Rollback Script: Restore dataset_identifier column
-- Use this only if you need to revert the migration

BEGIN;

-- 1. Add back the dataset_identifier column
ALTER TABLE optimization_jobs 
ADD COLUMN dataset_identifier VARCHAR(255);

-- 2. Populate dataset_identifier from dataset_id
UPDATE optimization_jobs 
SET dataset_identifier = 'dataset_' || dataset_id::text
WHERE dataset_id IS NOT NULL;

-- 3. Recreate the index
CREATE INDEX idx_optimization_jobs_dataset_identifier ON optimization_jobs(dataset_identifier);

-- 4. Verify the rollback
SELECT 'Rollback verification:' as info;
SELECT COUNT(*) as total_jobs FROM optimization_jobs;
SELECT COUNT(*) as jobs_with_dataset_id FROM optimization_jobs WHERE dataset_id IS NOT NULL;
SELECT COUNT(*) as jobs_with_dataset_identifier FROM optimization_jobs WHERE dataset_identifier IS NOT NULL;

-- 5. Show sample data after rollback
SELECT 'Sample data after rollback:' as info;
SELECT id, sku, dataset_id, dataset_identifier, method, status 
FROM optimization_jobs 
LIMIT 10;

COMMIT;

-- Rollback completed!
-- The optimization_jobs table now has both dataset_id and dataset_identifier columns again. 