-- =====================================================
-- ADD MODEL_ID COLUMN TO OPTIMIZATION_JOBS
-- =====================================================
-- This script adds a model_id column to optimization_jobs table
-- and populates it from the payload.modelTypes array
-- =====================================================

-- Step 1: Check if model_id column already exists
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs' 
        AND column_name = 'model_id'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        -- Add model_id column
        ALTER TABLE optimization_jobs ADD COLUMN model_id TEXT;
        RAISE NOTICE '✓ Added model_id column to optimization_jobs table';
    ELSE
        RAISE NOTICE '✓ model_id column already exists';
    END IF;
END $$;

-- Step 2: Populate model_id from payload.modelTypes
DO $$
DECLARE
    updated_count INTEGER;
    total_jobs INTEGER;
BEGIN
    -- Count total jobs
    SELECT COUNT(*) INTO total_jobs FROM optimization_jobs;
    
    -- Update model_id from payload.modelTypes[0]
    UPDATE optimization_jobs 
    SET model_id = payload->>'modelTypes'
    WHERE model_id IS NULL 
    AND payload->>'modelTypes' IS NOT NULL
    AND payload->>'modelTypes' != 'null';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated % jobs with model_id from payload.modelTypes', updated_count;
    
    -- Also try payload.model_id as fallback
    UPDATE optimization_jobs 
    SET model_id = payload->>'model_id'
    WHERE model_id IS NULL 
    AND payload->>'model_id' IS NOT NULL
    AND payload->>'model_id' != 'null';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated % additional jobs with model_id from payload.model_id', updated_count;
    
    -- Show final statistics
    SELECT COUNT(*) INTO updated_count FROM optimization_jobs WHERE model_id IS NOT NULL;
    RAISE NOTICE 'Final stats: %/% jobs have model_id', updated_count, total_jobs;
END $$;

-- Step 3: Create index on model_id for better performance
DO $$
DECLARE
    index_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'optimization_jobs' 
        AND indexname = 'idx_optimization_jobs_model_id'
    ) INTO index_exists;
    
    IF NOT index_exists THEN
        CREATE INDEX idx_optimization_jobs_model_id ON optimization_jobs(model_id);
        RAISE NOTICE '✓ Created index on model_id column';
    ELSE
        RAISE NOTICE '✓ Index on model_id already exists';
    END IF;
END $$;

-- Step 4: Verify the changes
SELECT 
    'Verification - Jobs with model_id:' as info,
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN model_id IS NOT NULL THEN 1 END) as jobs_with_model_id,
    COUNT(CASE WHEN model_id IS NULL THEN 1 END) as jobs_without_model_id
FROM optimization_jobs;

-- Step 5: Show sample updated jobs
SELECT 
    'Sample updated jobs:' as info;

SELECT 
    id,
    sku,
    dataset_id,
    method,
    model_id,
    payload->>'modelTypes' as payload_modelTypes,
    status,
    created_at
FROM optimization_jobs
WHERE model_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- MIGRATION COMPLETE
-- ===================================================== 