-- Migration: Convert dataset_aggregatable_field_map to use company_id instead of dataset_id
-- This allows the table to be used for company-level field mappings across all datasets

-- Step 1: Drop the existing foreign key constraint on dataset_id if it exists
ALTER TABLE dataset_aggregatable_field_map 
DROP CONSTRAINT IF EXISTS dataset_aggregatable_field_map_dataset_id_fkey;

-- Step 2: Drop the dataset_id column (since company_id already exists)
ALTER TABLE dataset_aggregatable_field_map 
DROP COLUMN IF EXISTS dataset_id;

-- Step3verify the foreign key constraint to companies table on company_id
ALTER TABLE dataset_aggregatable_field_map 
DROP CONSTRAINT IF EXISTS dataset_aggregatable_field_map_company_id_fkey;

ALTER TABLE dataset_aggregatable_field_map 
ADD CONSTRAINT dataset_aggregatable_field_map_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Step 4: Update the index name if it exists
DROP INDEX IF EXISTS idx_dataset_aggregatable_field_map_dataset;
CREATE INDEX IF NOT EXISTS idx_dataset_aggregatable_field_map_company 
ON dataset_aggregatable_field_map(company_id);

-- Step 5: Add a comment to document the change
COMMENT ON TABLE dataset_aggregatable_field_map IS 
'Company-level field mappings for CSV import. Maps CSV column names to aggregatable field definitions for the entire company.';

COMMENT ON COLUMN dataset_aggregatable_field_map.company_id IS 
'Company this field mapping applies to. Replaces the old dataset_id to allow company-wide mappings.';

COMMENT ON COLUMN dataset_aggregatable_field_map.dataset_column IS 
'CSV column name (e.g., "Div", "Cluster", "Region") that maps to the aggregatable field definition.';

-- Step 6: Verify the migration
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_mappings,
    COUNT(DISTINCT company_id) as companies_with_mappings
FROM dataset_aggregatable_field_map; 