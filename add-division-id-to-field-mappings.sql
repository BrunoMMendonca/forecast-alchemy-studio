-- Migration: Add division_id to dataset_aggregatable_field_map table
-- This allows division-specific field mappings when "division specific" is enabled

-- Add division_id column (nullable to maintain backward compatibility)
ALTER TABLE dataset_aggregatable_field_map 
ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE;

-- Add index for better performance on division-specific queries
CREATE INDEX IF NOT EXISTS idx_dataset_aggregatable_field_map_division 
ON dataset_aggregatable_field_map(division_id);

-- Add composite index for company + division queries
CREATE INDEX IF NOT EXISTS idx_dataset_aggregatable_field_map_company_division 
ON dataset_aggregatable_field_map(company_id, division_id);

-- Add unique constraint to prevent duplicate mappings per company/division/field
-- This allows the same field to be mapped differently per division
ALTER TABLE dataset_aggregatable_field_map 
ADD CONSTRAINT unique_field_mapping_per_division 
UNIQUE (company_id, division_id, field_def_id, dataset_column);

-- Add comment to document the new functionality
COMMENT ON COLUMN dataset_aggregatable_field_map.division_id IS 
'Division this field mapping applies to. NULL means company-wide mapping.';

-- Update existing mappings to be company-wide (division_id = NULL)
-- This ensures existing data remains functional
UPDATE dataset_aggregatable_field_map 
SET division_id = NULL 
WHERE division_id IS NULL;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added division_id to dataset_aggregatable_field_map table';
    RAISE NOTICE 'Total field mappings: %', (SELECT COUNT(*) FROM dataset_aggregatable_field_map);
    RAISE NOTICE 'Company-wide mappings: %', (SELECT COUNT(*) FROM dataset_aggregatable_field_map WHERE division_id IS NULL);
END $$; 