-- Migration: Add order column to dataset_aggregatable_field_map table
-- This allows maintaining the order of field mappings as they appear in the CSV

-- Add order column (nullable to maintain backward compatibility)
ALTER TABLE dataset_aggregatable_field_map 
ADD COLUMN field_order INTEGER;

-- Add index for better performance on ordered queries
CREATE INDEX IF NOT EXISTS idx_dataset_aggregatable_field_map_order 
ON dataset_aggregatable_field_map(company_id, division_id, field_order);

-- Update existing mappings to have order based on creation time
UPDATE dataset_aggregatable_field_map 
SET field_order = id 
WHERE field_order IS NULL;

-- Make the order column NOT NULL after populating existing data
ALTER TABLE dataset_aggregatable_field_map 
ALTER COLUMN field_order SET NOT NULL;

-- Add comment to document the new functionality
COMMENT ON COLUMN dataset_aggregatable_field_map.field_order IS 
'Order of the field mapping as it appears in the CSV. Lower numbers appear first.';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added field_order to dataset_aggregatable_field_map table';
    RAISE NOTICE 'Total field mappings: %', (SELECT COUNT(*) FROM dataset_aggregatable_field_map);
END $$; 