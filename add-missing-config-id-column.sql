-- =====================================================
-- Add Missing config_id Column to sop_cycles Table
-- DBeaver Compatible
-- =====================================================
-- 
-- This script adds the missing config_id column to the existing sop_cycles table
-- Run this if you already created the tables with the original script.
-- =====================================================

-- Start transaction for safe execution
BEGIN;

-- =====================================================
-- 1. ADD MISSING config_id COLUMN
-- =====================================================

-- Add the config_id column to sop_cycles table
ALTER TABLE sop_cycles 
ADD COLUMN IF NOT EXISTS config_id INTEGER REFERENCES sop_cycle_configs(id) ON DELETE SET NULL;

-- =====================================================
-- 2. CREATE MISSING INDEX
-- =====================================================

-- Create index for the new config_id column
CREATE INDEX IF NOT EXISTS idx_sop_cycles_config_id ON sop_cycles(config_id);

-- =====================================================
-- 3. VERIFICATION
-- =====================================================

-- Check if the column was added successfully
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'sop_cycles' 
  AND column_name = 'config_id';

-- Check if the index was created
SELECT 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename = 'sop_cycles' 
  AND indexname = 'idx_sop_cycles_config_id';

-- =====================================================
-- 4. COMMIT TRANSACTION
-- =====================================================

COMMIT;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'config_id column added to sop_cycles table successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'The sop_cycles table now has:';
    RAISE NOTICE '- config_id column (references sop_cycle_configs.id)';
    RAISE NOTICE '- Index on config_id for performance';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now use the complete S&OP cycle management system!';
END $$; 
 
 
 
 
 
 
 
 
 