-- Add setup_wizard_accessible flag to companies table
-- This allows admins to return to setup wizard even after initial setup is completed

ALTER TABLE companies ADD COLUMN setup_wizard_accessible BOOLEAN DEFAULT TRUE;

-- Update existing companies to have setup wizard accessible
UPDATE companies SET setup_wizard_accessible = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN companies.setup_wizard_accessible IS 'Controls whether admins can access the setup wizard. Defaults to TRUE to allow access.'; 