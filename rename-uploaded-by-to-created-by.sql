-- Rename uploaded_by to created_by in datasets table
-- This maintains consistency with the rest of the database schema

-- First, check if the column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'datasets' 
        AND column_name = 'uploaded_by'
    ) THEN
        -- Rename the column
        ALTER TABLE datasets RENAME COLUMN uploaded_by TO created_by;
        RAISE NOTICE 'Successfully renamed uploaded_by to created_by in datasets table';
    ELSE
        RAISE NOTICE 'uploaded_by column does not exist in datasets table';
    END IF;
END $$;

-- Verify the change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'datasets' 
AND column_name IN ('uploaded_by', 'created_by')
ORDER BY column_name; 