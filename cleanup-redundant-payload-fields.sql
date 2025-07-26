-- =====================================================
-- CLEANUP REDUNDANT PAYLOAD FIELDS
-- =====================================================
-- This script removes redundant modelTypes and optimizationType 
-- from the payload since we now have model_id and method as columns
-- =====================================================

-- Step 1: Show current payload structure before cleanup
SELECT 
    'Current payload structure analysis:' as info;

SELECT 
    id,
    method,
    model_id,
    payload->>'modelTypes' as payload_modelTypes,
    payload->>'optimizationType' as payload_optimizationType,
    payload->>'model_id' as payload_model_id,
    payload->>'modelId' as payload_modelId
FROM optimization_jobs
WHERE dataset_id = 66 AND sku = '95000000'
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Count jobs with redundant fields
SELECT 
    'Jobs with redundant fields:' as info,
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN payload->>'modelTypes' IS NOT NULL THEN 1 END) as jobs_with_modelTypes,
    COUNT(CASE WHEN payload->>'optimizationType' IS NOT NULL THEN 1 END) as jobs_with_optimizationType,
    COUNT(CASE WHEN payload->>'model_id' IS NOT NULL THEN 1 END) as jobs_with_payload_model_id,
    COUNT(CASE WHEN payload->>'modelId' IS NOT NULL THEN 1 END) as jobs_with_payload_modelId
FROM optimization_jobs
WHERE dataset_id = 66 AND sku = '95000000';

-- Step 3: Remove redundant fields from payload
DO $$
DECLARE
    updated_count INTEGER;
    total_jobs INTEGER;
BEGIN
    -- Count total jobs for this dataset/sku
    SELECT COUNT(*) INTO total_jobs 
    FROM optimization_jobs 
    WHERE dataset_id = 66 AND sku = '95000000';
    
    RAISE NOTICE 'Processing % jobs for cleanup...', total_jobs;
    
    -- Remove modelTypes from payload (since we have model_id column)
    UPDATE optimization_jobs 
    SET payload = payload - 'modelTypes'
    WHERE dataset_id = 66 AND sku = '95000000'
    AND payload->>'modelTypes' IS NOT NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Removed modelTypes from % jobs', updated_count;
    
    -- Remove optimizationType from payload (since we have method column)
    UPDATE optimization_jobs 
    SET payload = payload - 'optimizationType'
    WHERE dataset_id = 66 AND sku = '95000000'
    AND payload->>'optimizationType' IS NOT NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Removed optimizationType from % jobs', updated_count;
    
    -- Remove redundant model_id from payload (since we have model_id column)
    UPDATE optimization_jobs 
    SET payload = payload - 'model_id'
    WHERE dataset_id = 66 AND sku = '95000000'
    AND payload->>'model_id' IS NOT NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Removed payload.model_id from % jobs', updated_count;
    
    -- Remove redundant modelId from payload (since we have model_id column)
    UPDATE optimization_jobs 
    SET payload = payload - 'modelId'
    WHERE dataset_id = 66 AND sku = '95000000'
    AND payload->>'modelId' IS NOT NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Removed payload.modelId from % jobs', updated_count;
    
END $$;

-- Step 4: Verify cleanup results
SELECT 
    'Cleanup verification:' as info;

SELECT 
    id,
    method,
    model_id,
    payload->>'modelTypes' as payload_modelTypes,
    payload->>'optimizationType' as payload_optimizationType,
    payload->>'model_id' as payload_model_id,
    payload->>'modelId' as payload_modelId
FROM optimization_jobs
WHERE dataset_id = 66 AND sku = '95000000'
ORDER BY created_at DESC
LIMIT 5;

-- Step 5: Show final statistics
SELECT 
    'Final statistics after cleanup:' as info,
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN payload->>'modelTypes' IS NOT NULL THEN 1 END) as remaining_modelTypes,
    COUNT(CASE WHEN payload->>'optimizationType' IS NOT NULL THEN 1 END) as remaining_optimizationType,
    COUNT(CASE WHEN payload->>'model_id' IS NOT NULL THEN 1 END) as remaining_payload_model_id,
    COUNT(CASE WHEN payload->>'modelId' IS NOT NULL THEN 1 END) as remaining_payload_modelId
FROM optimization_jobs
WHERE dataset_id = 66 AND sku = '95000000';

-- =====================================================
-- CLEANUP COMPLETE
-- ===================================================== 