-- Add soft delete columns to divisions table
ALTER TABLE divisions 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

-- Add soft delete columns to clusters table
ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_divisions_is_active ON divisions(is_active);
CREATE INDEX IF NOT EXISTS idx_divisions_deleted_at ON divisions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_clusters_is_active ON clusters(is_active);
CREATE INDEX IF NOT EXISTS idx_clusters_deleted_at ON clusters(deleted_at);

-- Add comments for documentation
COMMENT ON COLUMN divisions.is_active IS 'Whether the division is active (true) or soft deleted (false)';
COMMENT ON COLUMN divisions.deleted_at IS 'Timestamp when the division was soft deleted';
COMMENT ON COLUMN divisions.deleted_by IS 'User ID who performed the soft delete';
COMMENT ON COLUMN clusters.is_active IS 'Whether the cluster is active (true) or soft deleted (false)';
COMMENT ON COLUMN clusters.deleted_at IS 'Timestamp when the cluster was soft deleted';
COMMENT ON COLUMN clusters.deleted_by IS 'User ID who performed the soft delete'; 
 
 
 
 
 
 
 
 
 