-- Migration: Add fieldMapping column to divisions and clusters tables
-- This migration adds the fieldMapping column to support CSV import field mapping functionality

-- Add fieldMapping column to divisions table
ALTER TABLE divisions 
ADD COLUMN IF NOT EXISTS field_mapping TEXT;

-- Add fieldMapping column to clusters table  
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS field_mapping TEXT;

-- Populate existing divisions with their names as field mapping
UPDATE divisions 
SET field_mapping = name 
WHERE field_mapping IS NULL OR field_mapping = '';

-- Populate existing clusters with their names as field mapping
UPDATE clusters 
SET field_mapping = name 
WHERE field_mapping IS NULL OR field_mapping = ';-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_divisions_field_mapping ON divisions(field_mapping);
CREATE INDEX IF NOT EXISTS idx_clusters_field_mapping ON clusters(field_mapping);

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added fieldMapping columns to divisions and clusters tables';
    RAISE NOTICE 'Updated % divisions with field mapping', (SELECT COUNT(*) FROM divisions);
    RAISE NOTICE 'Updated % clusters with field mapping', (SELECT COUNT(*) FROM clusters);
END $$; 