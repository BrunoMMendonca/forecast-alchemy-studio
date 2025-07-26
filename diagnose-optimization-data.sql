-- =====================================================
-- DIAGNOSE OPTIMIZATION DATA STRUCTURE
-- =====================================================
-- This script checks the current state of optimization jobs
-- and their payload structure to understand the data model
-- =====================================================

-- Step 1: Check the current table structure
SELECT 
    'Current optimization_jobs table structure:' as info;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'optimization_jobs'
ORDER BY ordinal_position;

-- Step 2: Show sample jobs for dataset_id = 66 and sku = '95000000'
SELECT 
    'Sample optimization jobs:' as info;

SELECT 
    id,
    method,
    payload,
    optimization_id,
    status,
    created_at
FROM optimization_jobs
WHERE dataset_id = 66 AND sku = '95000000'
ORDER BY created_at DESC
LIMIT 5;

-- Step 3: Check payload structure for model information
SELECT 
    'Payload analysis for model information:' as info;

SELECT 
    id,
    CASE 
        WHEN payload->>'modelTypes' IS NOT NULL THEN 'Has modelTypes array'
        WHEN payload->>'model_id' IS NOT NULL THEN 'Has model_id'
        WHEN payload->>'modelId' IS NOT NULL THEN 'Has modelId'
        ELSE 'No model info in payload'
    END as payload_model_info,
    payload->>'modelTypes' as modelTypes,
    payload->>'model_id' as payload_model_id,
    payload->>'modelId' as payload_modelId,
    method
FROM optimization_jobs
WHERE dataset_id = 66 AND sku = '95000000'
ORDER BY created_at DESC
LIMIT 5;

-- Step 4: Check optimization_results for these jobs
SELECT 
    'Optimization results analysis:' as info;

SELECT 
    COUNT(*) as total_results,
    COUNT(CASE WHEN scores IS NOT NULL AND scores::text != 'null' THEN 1 END) as results_with_scores,
    COUNT(CASE WHEN scores IS NULL OR scores::text = 'null' THEN 1 END) as results_without_scores
FROM optimization_results
WHERE job_id IN (
    SELECT id FROM optimization_jobs WHERE dataset_id = 66 AND sku = '95000000'
);

-- Step 5: Show sample optimization results
SELECT 
    'Sample optimization results:' as info;

SELECT 
    id,
    job_id,
    parameters,
    scores,
    created_at
FROM optimization_results
WHERE job_id IN (
    SELECT id FROM optimization_jobs WHERE dataset_id = 66 AND sku = '95000000'
)
ORDER BY created_at DESC
LIMIT 3;

-- Step 6: Check if model_id column exists
SELECT 
    'model_id column check:' as info,
    EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs' 
        AND column_name = 'model_id'
    ) as model_id_column_exists;

-- =====================================================
-- DIAGNOSTIC COMPLETE
-- ===================================================== 