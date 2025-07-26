-- =====================================================
-- DATABASE STATE DIAGNOSTIC SCRIPT
-- =====================================================
-- This script checks the current state of your database
-- to determine what migration steps are needed
-- =====================================================

-- Step 1: Check if optimization_jobs table exists
SELECT 
    'Table existence check:' as info,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs'
    ) as table_exists;

-- Step 2: Show all columns in optimization_jobs table
SELECT 
    'Current table structure:' as info;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'optimization_jobs'
ORDER BY ordinal_position;

-- Step 3: Check for dataset_identifier column specifically
SELECT 
    'dataset_identifier column check:' as info,
    EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs' 
        AND column_name = 'dataset_identifier'
    ) as has_dataset_identifier;

-- Step 4: Check for dataset_id column specifically
SELECT 
    'dataset_id column check:' as info,
    EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs' 
        AND column_name = 'dataset_id'
    ) as has_dataset_id;

-- Step 5: Count records and check data distribution
SELECT 
    'Data distribution:' as info,
    COUNT(*) as total_records,
    COUNT(CASE WHEN dataset_id IS NOT NULL THEN 1 END) as records_with_dataset_id,
    COUNT(CASE WHEN dataset_id IS NULL THEN 1 END) as records_without_dataset_id
FROM optimization_jobs;

-- Step 6: Show sample records
SELECT 
    'Sample records (first 5):' as info;

SELECT 
    id,
    sku,
    dataset_id,
    method,
    status,
    created_at
FROM optimization_jobs 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 7: Check for any indexes on dataset_identifier
SELECT 
    'Indexes on optimization_jobs:' as info;

SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'optimization_jobs'
ORDER BY indexname;

-- Step 8: Check for any foreign key constraints
SELECT 
    'Foreign key constraints:' as info;

SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'optimization_jobs';

-- =====================================================
-- DIAGNOSTIC COMPLETE
-- =====================================================
-- Review the results above to understand your current state
-- ===================================================== 