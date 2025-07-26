-- =====================================================
-- Database Migration: Remove dataset_identifier column
-- DBeaver Ready Script
-- Run this in DBeaver SQL Editor
-- =====================================================

-- Step 1: Check current state before migration
SELECT '=== CURRENT STATE BEFORE MIGRATION ===' as info;

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
WHERE dataset_identifier IS NOT NULL
UNION ALL
SELECT 
    'Jobs with both columns',
    COUNT(*)
FROM optimization_jobs 
WHERE dataset_id IS NOT NULL AND dataset_identifier IS NOT NULL;

-- Step 2: Show sample data to understand current state
SELECT '=== SAMPLE DATA BEFORE MIGRATION ===' as info;

SELECT 
    id, 
    sku, 
    dataset_id, 
    dataset_identifier, 
    method, 
    status,
    created_at
FROM optimization_jobs 
WHERE dataset_identifier IS NOT NULL 
ORDER BY created_at DESC
LIMIT 10;

-- Step 3: Update records that have dataset_identifier but missing dataset_id
-- This handles cases where dataset_identifier is in format "dataset_XX"
SELECT '=== UPDATING MISSING dataset_id VALUES ===' as info;

UPDATE optimization_jobs 
SET dataset_id = CAST(REPLACE(dataset_identifier, 'dataset_', '') AS INTEGER)
WHERE dataset_identifier LIKE 'dataset_%' 
  AND dataset_id IS NULL
  AND dataset_identifier ~ '^dataset_\d+$';

-- Step 4: Verify the update worked
SELECT '=== AFTER UPDATING dataset_id FROM dataset_identifier ===' as info;

SELECT 
    'Records updated with dataset_id' as metric,
    COUNT(*) as count
FROM optimization_jobs 
WHERE dataset_identifier LIKE 'dataset_%' AND dataset_id IS NOT NULL;

-- Step 5: Check for any orphaned records (dataset_identifier without corresponding dataset_id)
SELECT '=== CHECKING FOR ORPHANED RECORDS ===' as info;

SELECT 
    'Orphaned records count' as metric,
    COUNT(*) as count
FROM optimization_jobs 
WHERE dataset_identifier IS NOT NULL AND dataset_id IS NULL;

-- Step 6: If there are orphaned records, show them
SELECT '=== ORPHANED RECORDS (if any) ===' as info;

SELECT 
    id, 
    sku, 
    dataset_identifier, 
    method, 
    status,
    created_at
FROM optimization_jobs 
WHERE dataset_identifier IS NOT NULL AND dataset_id IS NULL
ORDER BY created_at DESC;

-- Step 7: Remove the dataset_identifier index
SELECT '=== REMOVING dataset_identifier INDEX ===' as info;

DROP INDEX IF EXISTS idx_optimization_jobs_dataset_identifier;

-- Step 8: Remove the dataset_identifier column
SELECT '=== REMOVING dataset_identifier COLUMN ===' as info;

ALTER TABLE optimization_jobs DROP COLUMN IF EXISTS dataset_identifier;

-- Step 9: Verify the final state
SELECT '=== FINAL STATE AFTER MIGRATION ===' as info;

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

-- Step 10: Show final sample data
SELECT '=== SAMPLE DATA AFTER MIGRATION ===' as info;

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

-- Step 11: Verify foreign key constraints
SELECT '=== VERIFYING FOREIGN KEY CONSTRAINTS ===' as info;

SELECT 
    'Invalid dataset references' as metric,
    COUNT(*) as count
FROM optimization_jobs oj
LEFT JOIN datasets d ON oj.dataset_id = d.id
WHERE oj.dataset_id IS NOT NULL AND d.id IS NULL;

-- Step 12: Show any invalid references (if any)
SELECT '=== INVALID DATASET REFERENCES (if any) ===' as info;

SELECT 
    oj.id,
    oj.sku,
    oj.dataset_id,
    oj.method,
    oj.status
FROM optimization_jobs oj
LEFT JOIN datasets d ON oj.dataset_id = d.id
WHERE oj.dataset_id IS NOT NULL AND d.id IS NULL
ORDER BY oj.created_at DESC;

-- Step 13: Final verification - show dataset distribution
SELECT '=== DATASET DISTRIBUTION ===' as info;

SELECT 
    d.id as dataset_id,
    d.name as dataset_name,
    COUNT(oj.id) as job_count
FROM datasets d
LEFT JOIN optimization_jobs oj ON d.id = oj.dataset_id
GROUP BY d.id, d.name
ORDER BY job_count DESC;

-- =====================================================
-- MIGRATION COMPLETED SUCCESSFULLY!
-- =====================================================
-- The optimization_jobs table now uses only dataset_id (integer) 
-- and no longer has the redundant dataset_identifier column.
-- 
-- Benefits achieved:
-- - Faster queries (integer vs string comparisons)
-- - Smaller indexes
-- - Better foreign key relationships
-- - Reduced storage (no duplicate data)
-- ===================================================== 