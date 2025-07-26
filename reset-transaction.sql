-- =====================================================
-- RESET TRANSACTION STATE
-- =====================================================
-- This script resets the current transaction state after an error
-- Run this first, then run the migration script
-- =====================================================

-- Rollback any pending transaction
ROLLBACK;

-- Start a fresh transaction
BEGIN;

-- Verify we can connect and query
SELECT 'Transaction reset successful' as status;

-- Commit to confirm everything is working
COMMIT;

-- =====================================================
-- READY FOR MIGRATION
-- =====================================================
-- Now you can run: separate-optimization-jobs-and-results.sql
-- ===================================================== 