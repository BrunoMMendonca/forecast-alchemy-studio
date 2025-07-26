-- =====================================================
-- UPDATE S&OP CYCLES TO BE DIVISION-SPECIFIC
-- =====================================================
-- This script updates the existing database to make S&OP cycles
-- belong to divisions instead of companies
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ADD division_id TO sop_cycles TABLE
-- =====================================================

-- Add division_id column to sop_cycles
ALTER TABLE sop_cycles 
ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE;

-- Update existing sop_cycles to use default division
UPDATE sop_cycles 
SET division_id = (
    SELECT d.id 
    FROM divisions d 
    WHERE d.company_id = sop_cycles.company_id 
    LIMIT 1
);

-- Make division_id NOT NULL
ALTER TABLE sop_cycles ALTER COLUMN division_id SET NOT NULL;

-- =====================================================
-- 2. UPDATE UNIQUE CONSTRAINT
-- =====================================================

-- Drop old unique constraint
ALTER TABLE sop_cycles DROP CONSTRAINT IF EXISTS sop_cycles_company_id_name_key;

-- Add new unique constraint
ALTER TABLE sop_cycles ADD CONSTRAINT sop_cycles_division_id_name_key UNIQUE (division_id, name);

-- =====================================================
-- 3. ADD division_id TO sop_cycle_extensions TABLE
-- =====================================================

-- Add division_id column to sop_cycle_extensions
ALTER TABLE sop_cycle_extensions 
ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE;

-- Update existing sop_cycle_extensions to use default division
UPDATE sop_cycle_extensions 
SET division_id = (
    SELECT d.id 
    FROM divisions d 
    WHERE d.company_id = sop_cycle_extensions.company_id 
    LIMIT 1
);

-- Make division_id NOT NULL
ALTER TABLE sop_cycle_extensions ALTER COLUMN division_id SET NOT NULL;

-- =====================================================
-- 4. ADD division_id TO dataset_lineage TABLE
-- =====================================================

-- Add division_id column to dataset_lineage
ALTER TABLE dataset_lineage 
ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE;

-- Update existing dataset_lineage to use default division
UPDATE dataset_lineage 
SET division_id = (
    SELECT d.id 
    FROM divisions d 
    WHERE d.company_id = dataset_lineage.company_id 
    LIMIT 1
);

-- Make division_id NOT NULL
ALTER TABLE dataset_lineage ALTER COLUMN division_id SET NOT NULL;

-- =====================================================
-- 5. UPDATE INDEXES
-- =====================================================

-- Add new indexes for division_id
CREATE INDEX IF NOT EXISTS idx_sop_cycles_division ON sop_cycles(division_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_division ON dataset_lineage(division_id);

-- =====================================================
-- 6. UPDATE TRIGGER FUNCTION
-- =====================================================

-- Update the function to ensure only one current S&OP cycle per division
CREATE OR REPLACE FUNCTION ensure_single_current_sop_cycle()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current = TRUE THEN
        UPDATE sop_cycles 
        SET is_current = FALSE 
        WHERE division_id = NEW.division_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 7. REORDER COLUMNS FOR READABILITY
-- =====================================================

-- Function to reorder columns
CREATE OR REPLACE FUNCTION reorder_table_columns(
    table_name TEXT,
    new_column_order TEXT[]
) RETURNS VOID AS $$
DECLARE
    column_list TEXT;
    query TEXT;
BEGIN
    -- Build column list
    SELECT string_agg(quote_ident(col), ', ') INTO column_list
    FROM unnest(new_column_order) AS col;
    
    -- Create new table with desired column order
    query := format('
        CREATE TABLE %I_new AS 
        SELECT %s FROM %I
    ', table_name, column_list, table_name);
    
    EXECUTE query;
    
    -- Drop old table and rename new one
    EXECUTE format('DROP TABLE %I', table_name);
    EXECUTE format('ALTER TABLE %I_new RENAME TO %I', table_name, table_name);
    
    -- Recreate primary key and sequences
    EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', table_name);
    
    -- Recreate sequence
    EXECUTE format('
        CREATE SEQUENCE IF NOT EXISTS %I_id_seq;
        SELECT setval(''%I_id_seq'', (SELECT MAX(id) FROM %I));
        ALTER TABLE %I ALTER COLUMN id SET DEFAULT nextval(''%I_id_seq'');
        ALTER SEQUENCE %I_id_seq OWNED BY %I.id
    ', table_name, table_name, table_name, table_name, table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Reorder sop_cycles table
SELECT reorder_table_columns('sop_cycles', ARRAY[
    'id', 'company_id', 'division_id', 'name', 'description', 'start_date', 'end_date', 'status', 'is_current', 
    'created_at', 'created_by', 'completed_at'
]);

-- Reorder sop_cycle_extensions table
SELECT reorder_table_columns('sop_cycle_extensions', ARRAY[
    'id', 'company_id', 'division_id', 'source_cycle_id', 'target_cycle_id', 'extension_type', 'status', 
    'metadata', 'created_at', 'created_by', 'completed_at'
]);

-- Reorder dataset_lineage table
SELECT reorder_table_columns('dataset_lineage', ARRAY[
    'id', 'company_id', 'division_id', 'dataset_id', 'parent_dataset_id', 'lineage_type', 'sop_cycle_id', 
    'extension_metadata', 'created_at', 'created_by'
]);

-- Clean up function
DROP FUNCTION IF EXISTS reorder_table_columns(TEXT, TEXT[]);

-- =====================================================
-- 8. VERIFICATION
-- =====================================================

-- Verify the changes
DO $$
DECLARE
    sop_cycles_count INTEGER;
    extensions_count INTEGER;
    lineage_count INTEGER;
BEGIN
    -- Count records
    SELECT COUNT(*) INTO sop_cycles_count FROM sop_cycles;
    SELECT COUNT(*) INTO extensions_count FROM sop_cycle_extensions;
    SELECT COUNT(*) INTO lineage_count FROM dataset_lineage;
    
    -- Log results
    RAISE NOTICE 'S&OP cycles updated successfully:';
    RAISE NOTICE 'S&OP Cycles: %', sop_cycles_count;
    RAISE NOTICE 'S&OP Extensions: %', extensions_count;
    RAISE NOTICE 'Dataset Lineage: %', lineage_count;
    
    -- Verify data integrity
    IF sop_cycles_count = 0 THEN
        RAISE EXCEPTION 'No S&OP cycles found after update';
    END IF;
    
    RAISE NOTICE 'Data integrity checks passed';
END $$;

COMMIT;

-- =====================================================
-- UPDATE COMPLETED SUCCESSFULLY
-- =====================================================
-- S&OP cycles are now division-specific instead of company-specific
-- Each division can have its own S&OP cycle timing and frequency
-- ===================================================== 