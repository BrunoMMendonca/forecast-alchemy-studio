-- =====================================================
-- SAFE MANUAL RECOVERY SCRIPT
-- =====================================================
-- Run this FIRST if you get transaction abort errors
-- This version doesn't reference dataset_identifier column
-- =====================================================

-- Step 1: Rollback any existing transaction
ROLLBACK;

-- Step 2: Check current state
SELECT 'Current transaction state:' as info;
SELECT txid_current() as current_transaction_id;

-- Step 3: Check if optimization_jobs table exists
SELECT 
    'Table existence check:' as info,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs'
    ) as table_exists;

-- Step 4: Show current table structure (if table exists)
SELECT 
    'Current table structure:' as info;
    
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'optimization_jobs' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 5: Check data distribution (if table exists)
SELECT 
    'Data distribution:' as info,
    COUNT(*) as total_records,
    COUNT(CASE WHEN dataset_id IS NOT NULL THEN 1 END) as records_with_dataset_id,
    COUNT(CASE WHEN dataset_id IS NULL THEN 1 END) as records_without_dataset_id
FROM optimization_jobs;

-- =====================================================
-- RECOVERY COMPLETE - Now run the diagnostic script
-- ===================================================== 