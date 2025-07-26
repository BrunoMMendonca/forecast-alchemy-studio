-- Check current divisions table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'divisions' 
ORDER BY ordinal_position;

-- Check current clusters table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'clusters' 
ORDER BY ordinal_position;

-- Add soft delete columns to divisions table (if they don't exist)
ALTER TABLE divisions 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

-- Add soft delete columns to clusters table (if they don't exist)
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

-- Create indexes for better performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_divisions_is_active ON divisions(is_active);
CREATE INDEX IF NOT EXISTS idx_divisions_deleted_at ON divisions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_clusters_is_active ON clusters(is_active);
CREATE INDEX IF NOT EXISTS idx_clusters_deleted_at ON clusters(deleted_at);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'divisions' AND column_name IN ('is_active', 'deleted_at', 'deleted_by')
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'clusters' AND column_name IN ('is_active', 'deleted_at', 'deleted_by')
ORDER BY ordinal_position; 
 
 
 
 
 
 
 
 
 