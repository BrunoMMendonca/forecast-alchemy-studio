-- =====================================================
-- DIAGNOSE AND FIX OPTIMIZATION RESULTS TABLE
-- =====================================================
-- This script diagnoses the current table structure and fixes any issues
-- =====================================================

-- First, ensure we start with a clean transaction state
ROLLBACK;
BEGIN;

-- =====================================================
-- 1. DIAGNOSE CURRENT TABLE STRUCTURE
-- =====================================================

-- Check if table exists
SELECT 
    'Table exists' as check_type,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'optimization_results') as result;

-- Show current table structure
SELECT 
    'Current table structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'optimization_results' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- 2. FIX TABLE STRUCTURE IF NEEDED
-- =====================================================

-- Check if optimization_hash column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'optimization_results' 
          AND column_name = 'optimization_hash'
    ) THEN
        RAISE NOTICE 'Adding missing optimization_hash column...';
        ALTER TABLE optimization_results ADD COLUMN optimization_hash TEXT NOT NULL DEFAULT '';
        RAISE NOTICE 'optimization_hash column added successfully';
    ELSE
        RAISE NOTICE 'optimization_hash column already exists';
    END IF;
END $$;

-- Check if model_id column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'optimization_results' 
          AND column_name = 'model_id'
    ) THEN
        RAISE NOTICE 'Adding missing model_id column...';
        ALTER TABLE optimization_results ADD COLUMN model_id TEXT NOT NULL DEFAULT '';
        RAISE NOTICE 'model_id column added successfully';
    ELSE
        RAISE NOTICE 'model_id column already exists';
    END IF;
END $$;

-- Check if method column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'optimization_results' 
          AND column_name = 'method'
    ) THEN
        RAISE NOTICE 'Adding missing method column...';
        ALTER TABLE optimization_results ADD COLUMN method TEXT NOT NULL DEFAULT '';
        RAISE NOTICE 'method column added successfully';
    ELSE
        RAISE NOTICE 'method column already exists';
    END IF;
END $$;

-- Check if parameters column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'optimization_results' 
          AND column_name = 'parameters'
    ) THEN
        RAISE NOTICE 'Adding missing parameters column...';
        ALTER TABLE optimization_results ADD COLUMN parameters JSONB;
        RAISE NOTICE 'parameters column added successfully';
    ELSE
        RAISE NOTICE 'parameters column already exists';
    END IF;
END $$;

-- Check if scores column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'optimization_results' 
          AND column_name = 'scores'
    ) THEN
        RAISE NOTICE 'Adding missing scores column...';
        ALTER TABLE optimization_results ADD COLUMN scores JSONB;
        RAISE NOTICE 'scores column added successfully';
    ELSE
        RAISE NOTICE 'scores column already exists';
    END IF;
END $$;

-- Check if forecasts column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'optimization_results' 
          AND column_name = 'forecasts'
    ) THEN
        RAISE NOTICE 'Adding missing forecasts column...';
        ALTER TABLE optimization_results ADD COLUMN forecasts JSONB;
        RAISE NOTICE 'forecasts column added successfully';
    ELSE
        RAISE NOTICE 'forecasts column already exists';
    END IF;
END $$;

-- =====================================================
-- 3. CREATE INDEXES (WITH ERROR HANDLING)
-- =====================================================

-- Core indexes
DO $$
BEGIN
    -- Company ID index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_company_id') THEN
        CREATE INDEX idx_optimization_results_company_id ON optimization_results(company_id);
        RAISE NOTICE 'Created index: idx_optimization_results_company_id';
    ELSE
        RAISE NOTICE 'Index already exists: idx_optimization_results_company_id';
    END IF;
    
    -- Optimization hash index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_optimization_hash') THEN
        CREATE INDEX idx_optimization_results_optimization_hash ON optimization_results(optimization_hash);
        RAISE NOTICE 'Created index: idx_optimization_results_optimization_hash';
    ELSE
        RAISE NOTICE 'Index already exists: idx_optimization_results_optimization_hash';
    END IF;
    
    -- Job ID index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_job_id') THEN
        CREATE INDEX idx_optimization_results_job_id ON optimization_results(job_id);
        RAISE NOTICE 'Created index: idx_optimization_results_job_id';
    ELSE
        RAISE NOTICE 'Index already exists: idx_optimization_results_job_id';
    END IF;
    
    -- Model method index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_model_method') THEN
        CREATE INDEX idx_optimization_results_model_method ON optimization_results(model_id, method);
        RAISE NOTICE 'Created index: idx_optimization_results_model_method';
    ELSE
        RAISE NOTICE 'Index already exists: idx_optimization_results_model_method';
    END IF;
    
    -- Created at index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_created_at') THEN
        CREATE INDEX idx_optimization_results_created_at ON optimization_results(created_at);
        RAISE NOTICE 'Created index: idx_optimization_results_created_at';
    ELSE
        RAISE NOTICE 'Index already exists: idx_optimization_results_created_at';
    END IF;
    
    -- Composite indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_company_hash') THEN
        CREATE INDEX idx_optimization_results_company_hash ON optimization_results(company_id, optimization_hash);
        RAISE NOTICE 'Created index: idx_optimization_results_company_hash';
    ELSE
        RAISE NOTICE 'Index already exists: idx_optimization_results_company_hash';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_company_job') THEN
        CREATE INDEX idx_optimization_results_company_job ON optimization_results(company_id, job_id);
        RAISE NOTICE 'Created index: idx_optimization_results_company_job';
    ELSE
        RAISE NOTICE 'Index already exists: idx_optimization_results_company_job';
    END IF;
    
    -- JSONB indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_scores_gin') THEN
        CREATE INDEX idx_optimization_results_scores_gin ON optimization_results USING GIN (scores);
        RAISE NOTICE 'Created index: idx_optimization_results_scores_gin';
    ELSE
        RAISE NOTICE 'Index already exists: idx_optimization_results_scores_gin';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_optimization_results_parameters_gin') THEN
        CREATE INDEX idx_optimization_results_parameters_gin ON optimization_results USING GIN (parameters);
        RAISE NOTICE 'Created index: idx_optimization_results_parameters_gin';
    ELSE
        RAISE NOTICE 'Index already exists: idx_optimization_results_parameters_gin';
    END IF;
    
END $$;

-- =====================================================
-- 4. ADD TRIGGER FOR UPDATED_AT
-- =====================================================

-- Create function to automatically set updated_at (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to optimization_results
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_optimization_results_updated_at') THEN
        CREATE TRIGGER update_optimization_results_updated_at 
            BEFORE UPDATE ON optimization_results 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger: update_optimization_results_updated_at';
    ELSE
        RAISE NOTICE 'Trigger already exists: update_optimization_results_updated_at';
    END IF;
END $$;

-- =====================================================
-- 5. VERIFY FINAL STRUCTURE
-- =====================================================

-- Show final table structure
SELECT 
    'Final table structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'optimization_results' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show indexes
SELECT 
    'Table indexes' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'optimization_results';

-- Count records
SELECT 
    'Record count' as info,
    COUNT(*) as total_records
FROM optimization_results;

COMMIT;

-- =====================================================
-- FIX COMPLETE
-- =====================================================
-- 
-- The optimization_results table should now have the correct structure:
-- - id (SERIAL PRIMARY KEY)
-- - company_id (INTEGER NOT NULL)
-- - job_id (INTEGER)
-- - optimization_hash (TEXT NOT NULL)
-- - model_id (TEXT NOT NULL)
-- - method (TEXT NOT NULL)
-- - parameters (JSONB)
-- - scores (JSONB)
-- - forecasts (JSONB)
-- - created_at (TIMESTAMPTZ)
-- - updated_at (TIMESTAMPTZ)
--
-- All necessary indexes and triggers have been created.
-- ===================================================== 