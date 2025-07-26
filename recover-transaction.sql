-- =====================================================
-- TRANSACTION RECOVERY SCRIPT
-- =====================================================
-- Use this script if you encounter "current transaction is aborted" errors
-- =====================================================

-- Rollback any aborted transaction
ROLLBACK;

-- Start a fresh transaction
BEGIN;

-- Verify we're in a clean state
SELECT 'Transaction state is clean' as status;

-- You can now run your migration scripts safely
-- ===================================================== 