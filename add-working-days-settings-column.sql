-- Add working_days_settings column to sop_cycle_configs table
-- This column will store the new working days settings structure

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS working_days_settings JSONB;

-- Add comment to document the column
COMMENT ON COLUMN sop_cycle_configs.working_days_settings IS 'JSON object containing working days settings for start date and cut-off period';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_working_days_settings 
ON sop_cycle_configs USING GIN (working_days_settings);

-- Update existing records to have default working days settings
-- This ensures backward compatibility with existing configurations
UPDATE sop_cycle_configs 
SET working_days_settings = '{"startDate": {"useWorkingDays": false}, "cutOffPeriod": {"useWorkingDays": false}}'::jsonb
WHERE working_days_settings IS NULL; 
 
 
 
 
 
 
 
 
 