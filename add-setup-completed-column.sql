-- Add setup_completed column to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE;

-- Update existing companies to have setup_completed = false
UPDATE companies 
SET setup_completed = FALSE 
WHERE setup_completed IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN companies.setup_completed IS 'Indicates whether the company has completed the initial setup wizard'; 