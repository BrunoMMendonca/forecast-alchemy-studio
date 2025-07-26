-- Database Migration: Remove dataset_identifier column and use dataset_id consistently
-- This script migrates from the old dataset_identifier (string) to dataset_id (integer) approach

BEGIN;

-- 1. First, let's check what data we have
SELECT 'Current state before migration:' as info;
SELECT COUNT(*) as total_jobs FROM optimization_jobs;
SELECT COUNT(*) as jobs_with_dataset_id FROM optimization_jobs WHERE dataset_id IS NOT NULL;
SELECT COUNT(*) as jobs_with_dataset_identifier FROM optimization_jobs WHERE dataset_identifier IS NOT NULL;
SELECT COUNT(*) as jobs_with_both FROM optimization_jobs WHERE dataset_id IS NOT NULL AND dataset_identifier IS NOT NULL;

-- 2. Show sample data to understand the current state
SELECT 'Sample data before migration:' as info;
SELECT id, sku, dataset_id, dataset_identifier, method, status 
FROM optimization_jobs 
WHERE dataset_identifier IS NOT NULL 
LIMIT 10;

-- 3. Update records that have dataset_identifier but missing dataset_id
-- This handles cases where dataset_identifier is in format "dataset_XX"
UPDATE optimization_jobs 
SET dataset_id = CAST(REPLACE(dataset_identifier, 'dataset_', '') AS INTEGER)
WHERE dataset_identifier LIKE 'dataset_%' 
  AND dataset_id IS NULL
  AND dataset_identifier ~ '^dataset_\d+$';

-- 4. Verify the update worked
SELECT 'After updating dataset_id from dataset_identifier:' as info;
SELECT COUNT(*) as updated_records FROM optimization_jobs 
WHERE dataset_identifier LIKE 'dataset_%' AND dataset_id IS NOT NULL;

-- 5. Check for any orphaned records (dataset_identifier without corresponding dataset_id)
SELECT 'Checking for orphaned records:' as info;
SELECT COUNT(*) as orphaned_records FROM optimization_jobs 
WHERE dataset_identifier IS NOT NULL AND dataset_id IS NULL;

-- 6. If there are orphaned records, show them
SELECT 'Orphaned records (if any):' as info;
SELECT id, sku, dataset_identifier, method, status 
FROM optimization_jobs 
WHERE dataset_identifier IS NOT NULL AND dataset_id IS NULL;

-- 7. Remove the dataset_identifier index
DROP INDEX IF EXISTS idx_optimization_jobs_dataset_identifier;

-- 8. Remove the dataset_identifier column
ALTER TABLE optimization_jobs DROP COLUMN IF EXISTS dataset_identifier;

-- 9. Verify the final state
SELECT 'Final state after migration:' as info;
SELECT COUNT(*) as total_jobs FROM optimization_jobs;
SELECT COUNT(*) as jobs_with_dataset_id FROM optimization_jobs WHERE dataset_id IS NOT NULL;
SELECT COUNT(*) as jobs_without_dataset_id FROM optimization_jobs WHERE dataset_id IS NULL;

-- 10. Show final sample data
SELECT 'Sample data after migration:' as info;
SELECT id, sku, dataset_id, method, status 
FROM optimization_jobs 
LIMIT 10;

-- 11. Verify foreign key constraints
SELECT 'Verifying foreign key constraints:' as info;
SELECT COUNT(*) as invalid_dataset_references 
FROM optimization_jobs oj
LEFT JOIN datasets d ON oj.dataset_id = d.id
WHERE oj.dataset_id IS NOT NULL AND d.id IS NULL;

COMMIT;

-- Migration completed successfully!
-- The optimization_jobs table now uses only dataset_id (integer) 
-- and no longer has the redundant dataset_identifier column. 