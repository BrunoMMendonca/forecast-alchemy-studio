-- =====================================================
-- Rollback Script: Restore dataset_identifier column
-- DBeaver Ready Script
-- Use this only if you need to revert the migration
-- =====================================================

-- Step 1: Check current state before rollback
SELECT '=== CURRENT STATE BEFORE ROLLBACK ===' as info;

SELECT 
    'Total optimization jobs' as metric,
    COUNT(*) as count
FROM optimization_jobs
UNION ALL
SELECT 
    'Jobs with dataset_id',
    COUNT(*)
FROM optimization_jobs 
WHERE dataset_id IS NOT NULL
UNION ALL
SELECT 
    'Jobs without dataset_id',
    COUNT(*)
FROM optimization_jobs 
WHERE dataset_id IS NULL;

-- Step 2: Show sample data before rollback
SELECT '=== SAMPLE DATA BEFORE ROLLBACK ===' as info;

SELECT 
    id, 
    sku, 
    dataset_id, 
    method, 
    status,
    created_at
FROM optimization_jobs 
ORDER BY created_at DESC
LIMIT 10;

-- Step 3: Add back the dataset_identifier column
SELECT '=== ADDING BACK dataset_identifier COLUMN ===' as info;

ALTER TABLE optimization_jobs 
ADD COLUMN dataset_identifier VARCHAR(255);

-- Step 4: Populate dataset_identifier from dataset_id
SELECT '=== POPULATING dataset_identifier FROM dataset_id ===' as info;

UPDATE optimization_jobs 
SET dataset_identifier = 'dataset_' || dataset_id::text
WHERE dataset_id IS NOT NULL;

-- Step 5: Verify the population worked
SELECT '=== VERIFYING dataset_identifier POPULATION ===' as info;

SELECT 
    'Records with dataset_identifier populated' as metric,
    COUNT(*) as count
FROM optimization_jobs 
WHERE dataset_identifier IS NOT NULL;

-- Step 6: Recreate the index
SELECT '=== RECREATING dataset_identifier INDEX ===' as info;

CREATE INDEX idx_optimization_jobs_dataset_identifier ON optimization_jobs(dataset_identifier);

-- Step 7: Verify the rollback
SELECT '=== ROLLBACK VERIFICATION ===' as info;

SELECT 
    'Total optimization jobs' as metric,
    COUNT(*) as count
FROM optimization_jobs
UNION ALL
SELECT 
    'Jobs with dataset_id',
    COUNT(*)
FROM optimization_jobs 
WHERE dataset_id IS NOT NULL
UNION ALL
SELECT 
    'Jobs with dataset_identifier',
    COUNT(*)
FROM optimization_jobs 
WHERE dataset_identifier IS NOT NULL;

-- Step 8: Show sample data after rollback
SELECT '=== SAMPLE DATA AFTER ROLLBACK ===' as info;

SELECT 
    id, 
    sku, 
    dataset_id, 
    dataset_identifier, 
    method, 
    status,
    created_at
FROM optimization_jobs 
ORDER BY created_at DESC
LIMIT 10;

-- Step 9: Verify data consistency
SELECT '=== DATA CONSISTENCY CHECK ===' as info;

SELECT 
    'Records with both dataset_id and dataset_identifier' as metric,
    COUNT(*) as count
FROM optimization_jobs 
WHERE dataset_id IS NOT NULL AND dataset_identifier IS NOT NULL
UNION ALL
SELECT 
    'Records with only dataset_id',
    COUNT(*)
FROM optimization_jobs 
WHERE dataset_id IS NOT NULL AND dataset_identifier IS NULL
UNION ALL
SELECT 
    'Records with only dataset_identifier',
    COUNT(*)
FROM optimization_jobs 
WHERE dataset_id IS NULL AND dataset_identifier IS NOT NULL
UNION ALL
SELECT 
    'Records with neither',
    COUNT(*)
FROM optimization_jobs 
WHERE dataset_id IS NULL AND dataset_identifier IS NULL;

-- Step 10: Show any inconsistencies (if any)
SELECT '=== INCONSISTENCIES (if any) ===' as info;

SELECT 
    id,
    sku,
    dataset_id,
    dataset_identifier,
    method,
    status
FROM optimization_jobs 
WHERE (dataset_id IS NULL AND dataset_identifier IS NOT NULL)
   OR (dataset_id IS NOT NULL AND dataset_identifier IS NULL)
ORDER BY created_at DESC;

-- =====================================================
-- ROLLBACK COMPLETED!
-- =====================================================
-- The optimization_jobs table now has both dataset_id and dataset_identifier columns again.
-- 
-- Note: This rollback restores the previous state but you may need to:
-- 1. Update application code to handle both columns
-- 2. Test functionality thoroughly
-- 3. Consider re-running the migration when ready
-- ===================================================== 