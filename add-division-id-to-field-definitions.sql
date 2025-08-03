-- Migration: Add division_id to aggregatable_field_defs table
-- This allows division-specific field definitions when "division specific" is enabled

-- Add division_id column (nullable to maintain backward compatibility)
ALTER TABLE aggregatable_field_defs 
ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE;

-- Add index for better performance on division-specific queries
CREATE INDEX IF NOT EXISTS idx_aggregatable_field_defs_division 
ON aggregatable_field_defs(division_id);

-- Add composite index for company + division queries
CREATE INDEX IF NOT EXISTS idx_aggregatable_field_defs_company_division 
ON aggregatable_field_defs(company_id, division_id);

-- Add unique constraint to prevent duplicate field definitions per company/division/field_name
-- This allows the same field_name to be defined differently per division
ALTER TABLE aggregatable_field_defs 
ADD CONSTRAINT unique_field_def_per_division 
UNIQUE (company_id, division_id, field_name);

-- Add comment to document the new functionality
COMMENT ON COLUMN aggregatable_field_defs.division_id IS 
'Division this field definition applies to. NULL means company-wide field definition.';

-- Update existing field definitions to be company-wide (division_id = NULL)
-- This ensures existing data remains functional
UPDATE aggregatable_field_defs 
SET division_id = NULL 
WHERE division_id IS NULL;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added division_id to aggregatable_field_defs table';
    RAISE NOTICE 'Total field definitions: %', (SELECT COUNT(*) FROM aggregatable_field_defs);
    RAISE NOTICE 'Company-wide field definitions: %', (SELECT COUNT(*) FROM aggregatable_field_defs WHERE division_id IS NULL);
END $$; 