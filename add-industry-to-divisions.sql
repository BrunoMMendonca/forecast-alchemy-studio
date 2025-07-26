-- Add industry column to divisions table
-- DBeaver compatible migration

-- Check if the column already exists to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'divisions' 
        AND column_name = 'industry'
    ) THEN
        ALTER TABLE divisions ADD COLUMN industry VARCHAR(100);
        
        -- Add a comment to document the column
        COMMENT ON COLUMN divisions.industry IS 'Industry type for the division (e.g., Manufacturing, Technology, etc.)';
        
        RAISE NOTICE 'Added industry column to divisions table';
    ELSE
        RAISE NOTICE 'Industry column already exists in divisions table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'divisions' 
AND column_name = 'industry'; 