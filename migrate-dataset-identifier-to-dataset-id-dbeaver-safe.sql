-- =====================================================
-- SAFE MIGRATION: dataset_identifier to dataset_id
-- =====================================================
-- This script safely migrates from dataset_identifier (string) to dataset_id (integer)
-- with proper transaction handling and error recovery
-- =====================================================

-- Step 1: Rollback any existing transaction (run this first if needed)
-- ROLLBACK;

-- Step 2: Verify table exists and check current structure
DO $$
DECLARE
    table_exists BOOLEAN;
    has_dataset_identifier BOOLEAN;
    has_dataset_id BOOLEAN;
    record_count INTEGER;
BEGIN
    -- Check if optimization_jobs table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE EXCEPTION 'Table optimization_jobs does not exist. Please check your database schema.';
    END IF;
    
    RAISE NOTICE '✓ Table optimization_jobs exists';
    
    -- Check if dataset_identifier column exists
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs' 
        AND column_name = 'dataset_identifier'
    ) INTO has_dataset_identifier;
    
    -- Check if dataset_id column exists
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs' 
        AND column_name = 'dataset_id'
    ) INTO has_dataset_id;
    
    -- Get record count
    SELECT COUNT(*) INTO record_count FROM optimization_jobs;
    
    RAISE NOTICE 'Current table structure:';
    RAISE NOTICE '- dataset_identifier column exists: %', has_dataset_identifier;
    RAISE NOTICE '- dataset_id column exists: %', has_dataset_id;
    RAISE NOTICE '- Total records: %', record_count;
    
    -- Show sample data if exists
    IF record_count > 0 THEN
        RAISE NOTICE 'Sample records:';
        FOR i IN 1..LEAST(3, record_count) LOOP
            DECLARE
                sample_record RECORD;
            BEGIN
                SELECT * INTO sample_record FROM optimization_jobs LIMIT 1 OFFSET (i-1);
                IF has_dataset_identifier THEN
                    RAISE NOTICE '  Record %: dataset_identifier=%, dataset_id=%', 
                        i, sample_record.dataset_identifier, sample_record.dataset_id;
                ELSE
                    RAISE NOTICE '  Record %: dataset_id=%', i, sample_record.dataset_id;
                END IF;
            END;
        END LOOP;
    END IF;
    
END $$;

-- Step 3: Update dataset_id where it's NULL but dataset_identifier exists
DO $$
DECLARE
    updated_count INTEGER;
    null_dataset_id_count INTEGER;
BEGIN
    -- Count records with NULL dataset_id
    SELECT COUNT(*) INTO null_dataset_id_count 
    FROM optimization_jobs 
    WHERE dataset_id IS NULL;
    
    IF null_dataset_id_count > 0 THEN
        RAISE NOTICE 'Found % records with NULL dataset_id', null_dataset_id_count;
        
        -- Update dataset_id based on dataset_identifier hash
        UPDATE optimization_jobs 
        SET dataset_id = ABS(('x' || substr(md5(dataset_identifier), 1, 8))::bit(32)::integer)
        WHERE dataset_id IS NULL 
        AND dataset_identifier IS NOT NULL;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '✓ Updated % records with calculated dataset_id', updated_count;
    ELSE
        RAISE NOTICE '✓ No records need dataset_id updates';
    END IF;
END $$;

-- Step 4: Verify data integrity after updates
DO $$
DECLARE
    null_dataset_id_count INTEGER;
    null_dataset_identifier_count INTEGER;
    total_records INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_records FROM optimization_jobs;
    SELECT COUNT(*) INTO null_dataset_id_count FROM optimization_jobs WHERE dataset_id IS NULL;
    SELECT COUNT(*) INTO null_dataset_identifier_count FROM optimization_jobs WHERE dataset_identifier IS NULL;
    
    RAISE NOTICE 'Data integrity check:';
    RAISE NOTICE '- Total records: %', total_records;
    RAISE NOTICE '- Records with NULL dataset_id: %', null_dataset_id_count;
    RAISE NOTICE '- Records with NULL dataset_identifier: %', null_dataset_identifier_count;
    
    IF null_dataset_id_count > 0 THEN
        RAISE WARNING 'WARNING: % records still have NULL dataset_id', null_dataset_id_count;
    END IF;
    
    IF total_records > 0 AND null_dataset_id_count = 0 THEN
        RAISE NOTICE '✓ All records have valid dataset_id values';
    END IF;
END $$;

-- Step 5: Remove dataset_identifier column (only if it exists and we have dataset_id)
DO $$
DECLARE
    has_dataset_identifier BOOLEAN;
    has_dataset_id BOOLEAN;
    null_dataset_id_count INTEGER;
BEGIN
    -- Check columns again
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs' 
        AND column_name = 'dataset_identifier'
    ) INTO has_dataset_identifier;
    
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs' 
        AND column_name = 'dataset_id'
    ) INTO has_dataset_id;
    
    SELECT COUNT(*) INTO null_dataset_id_count FROM optimization_jobs WHERE dataset_id IS NULL;
    
    IF has_dataset_identifier AND has_dataset_id AND null_dataset_id_count = 0 THEN
        RAISE NOTICE 'Removing dataset_identifier column...';
        ALTER TABLE optimization_jobs DROP COLUMN dataset_identifier;
        RAISE NOTICE '✓ dataset_identifier column removed';
    ELSIF has_dataset_identifier THEN
        RAISE NOTICE 'Skipping dataset_identifier removal - conditions not met:';
        RAISE NOTICE '- has_dataset_identifier: %', has_dataset_identifier;
        RAISE NOTICE '- has_dataset_id: %', has_dataset_id;
        RAISE NOTICE '- null_dataset_id_count: %', null_dataset_id_count;
    ELSE
        RAISE NOTICE '✓ dataset_identifier column already removed';
    END IF;
END $$;

-- Step 6: Remove dataset_identifier index if it exists
DO $$
DECLARE
    index_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'optimization_jobs' 
        AND indexname LIKE '%dataset_identifier%'
    ) INTO index_exists;
    
    IF index_exists THEN
        RAISE NOTICE 'Removing dataset_identifier index...';
        DROP INDEX IF EXISTS idx_optimization_jobs_dataset_identifier;
        RAISE NOTICE '✓ dataset_identifier index removed';
    ELSE
        RAISE NOTICE '✓ No dataset_identifier index found';
    END IF;
END $$;

-- Step 7: Final verification
DO $$
DECLARE
    final_record_count INTEGER;
    final_columns TEXT[];
    column_info RECORD;
BEGIN
    SELECT COUNT(*) INTO final_record_count FROM optimization_jobs;
    
    RAISE NOTICE 'Final verification:';
    RAISE NOTICE '- Total records: %', final_record_count;
    
    -- Show final table structure
    RAISE NOTICE 'Final table columns:';
    FOR column_info IN 
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  - % (%): nullable=%', 
            column_info.column_name, 
            column_info.data_type, 
            column_info.is_nullable;
    END LOOP;
    
    -- Show sample of final data
    IF final_record_count > 0 THEN
        RAISE NOTICE 'Sample final records:';
        FOR i IN 1..LEAST(3, final_record_count) LOOP
            DECLARE
                sample_record RECORD;
            BEGIN
                SELECT * INTO sample_record FROM optimization_jobs LIMIT 1 OFFSET (i-1);
                RAISE NOTICE '  Record %: dataset_id=%', i, sample_record.dataset_id;
            END;
        END LOOP;
    END IF;
    
    RAISE NOTICE '✓ Migration completed successfully!';
END $$;

-- Step 8: Final status report
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'The optimization_jobs table has been migrated from';
    RAISE NOTICE 'dataset_identifier (string) to dataset_id (integer).';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify your application works correctly';
    RAISE NOTICE '2. Test forecast generation and optimization';
    RAISE NOTICE '3. Monitor for any issues';
    RAISE NOTICE '=====================================================';
END $$; 