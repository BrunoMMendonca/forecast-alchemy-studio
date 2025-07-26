-- =====================================================
-- MANUAL RECOVERY SCRIPT
-- =====================================================
-- Run this FIRST if you get transaction abort errors
-- =====================================================

-- Step 1: Rollback any existing transaction
ROLLBACK;

-- Step 2: Check current state
SELECT 'Current transaction state:' as info;
SELECT txid_current() as current_transaction_id;

-- Step 3: Check table status
SELECT 
    'Table status check' as info,
    COUNT(*) as total_records,
    COUNT(CASE WHEN dataset_id IS NOT NULL THEN 1 END) as records_with_dataset_id,
    COUNT(CASE WHEN dataset_identifier IS NOT NULL THEN 1 END) as records_with_dataset_identifier
FROM optimization_jobs;

-- Step 4: Show current table structure
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

-- =====================================================
-- RECOVERY COMPLETE - Now run the migration script
-- ===================================================== 