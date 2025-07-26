-- =====================================================
-- S&OP System Database Update Script
-- DBeaver Compatible
-- =====================================================
-- 
-- This script updates the database to support the enhanced S&OP cycle system
-- including working days support, day type selection, and improved holiday management.
--
-- Run this script in DBeaver to update your database.
-- =====================================================

-- Start transaction for safe execution
BEGIN;

-- =====================================================
-- 1. UPDATE EXISTING sop_cycle_configs TABLE
-- =====================================================

-- Add new columns to sop_cycle_configs table
ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'regular' CHECK (day_type IN ('regular', 'working'));

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS working_days_config JSONB;

-- Update existing records to have default values
UPDATE sop_cycle_configs 
SET day_type = 'regular' 
WHERE day_type IS NULL;

UPDATE sop_cycle_configs 
SET working_days_config = '{
  "monday": true,
  "tuesday": true,
  "wednesday": true,
  "thursday": true,
  "friday": true,
  "saturday": false,
  "sunday": false,
  "holidays": []
}'::jsonb
WHERE working_days_config IS NULL;

-- Make day_type NOT NULL after setting defaults
ALTER TABLE sop_cycle_configs 
ALTER COLUMN day_type SET NOT NULL;

-- =====================================================
-- 2. CREATE HELPER FUNCTIONS FOR WORKING DAYS
-- =====================================================

-- Function to check if a date is a working day
CREATE OR REPLACE FUNCTION is_working_day(
    p_date DATE,
    p_working_days_config JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    day_of_week INTEGER;
    day_names TEXT[] := ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    day_name TEXT;
    date_string TEXT;
BEGIN
    -- Get day of week (0 = Sunday, 1 = Monday, etc.)
    day_of_week := EXTRACT(DOW FROM p_date);
    day_name := day_names[day_of_week + 1];
    
    -- Check if this day of week is a working day
    IF NOT (p_working_days_config->day_name)::BOOLEAN THEN
        RETURN FALSE;
    END IF;
    
    -- Check if it's a holiday
    date_string := TO_CHAR(p_date, 'YYYY-MM-DD');
    IF p_working_days_config ? 'holidays' AND 
       (p_working_days_config->'holidays')::JSONB ? date_string THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to find the nth working day in a month
CREATE OR REPLACE FUNCTION find_nth_working_day_in_month(
    p_year INTEGER,
    p_month INTEGER,
    p_nth INTEGER,
    p_working_days_config JSONB
) RETURNS DATE AS $$
DECLARE
    current_date DATE;
    working_days_found INTEGER := 0;
BEGIN
    current_date := DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01');
    
    WHILE working_days_found < p_nth AND EXTRACT(MONTH FROM current_date) = p_month LOOP
        IF is_working_day(current_date, p_working_days_config) THEN
            working_days_found := working_days_found + 1;
            IF working_days_found = p_nth THEN
                RETURN current_date;
            END IF;
        END IF;
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
    
    -- If we can't find the nth working day, return the last day of the month
    RETURN (DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01') + INTERVAL '1 month - 1 day')::DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to find the nth working day in a quarter
CREATE OR REPLACE FUNCTION find_nth_working_day_in_quarter(
    p_year INTEGER,
    p_quarter INTEGER,
    p_nth INTEGER,
    p_working_days_config JSONB
) RETURNS DATE AS $$
DECLARE
    start_month INTEGER;
    current_date DATE;
    working_days_found INTEGER := 0;
BEGIN
    start_month := (p_quarter - 1) * 3;
    current_date := DATE(p_year || '-' || LPAD((start_month + 1)::TEXT, 2, '0') || '-01');
    
    WHILE working_days_found < p_nth AND EXTRACT(MONTH FROM current_date) < start_month + 3 LOOP
        IF is_working_day(current_date, p_working_days_config) THEN
            working_days_found := working_days_found + 1;
            IF working_days_found = p_nth THEN
                RETURN current_date;
            END IF;
        END IF;
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
    
    -- If we can't find the nth working day, return the last day of the quarter
    RETURN (DATE(p_year || '-' || LPAD((start_month + 3)::TEXT, 2, '0') || '-01') + INTERVAL '1 month - 1 day')::DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to find the nth working day in a year
CREATE OR REPLACE FUNCTION find_nth_working_day_in_year(
    p_year INTEGER,
    p_nth INTEGER,
    p_working_days_config JSONB
) RETURNS DATE AS $$
DECLARE
    current_date DATE;
    working_days_found INTEGER := 0;
BEGIN
    current_date := DATE(p_year || '-01-01');
    
    WHILE working_days_found < p_nth AND EXTRACT(YEAR FROM current_date) = p_year LOOP
        IF is_working_day(current_date, p_working_days_config) THEN
            working_days_found := working_days_found + 1;
            IF working_days_found = p_nth THEN
                RETURN current_date;
            END IF;
        END IF;
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
    
    -- If we can't find the nth working day, return the last day of the year
    RETURN DATE(p_year || '-12-31');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. UPDATE EXISTING FUNCTIONS
-- =====================================================

-- Update the generate_sop_cycle_name function to handle working days
CREATE OR REPLACE FUNCTION generate_sop_cycle_name(
    p_frequency TEXT,
    p_start_date DATE
) RETURNS TEXT AS $$
BEGIN
    CASE p_frequency
        WHEN 'weekly' THEN
            RETURN 'Week ' || EXTRACT(WEEK FROM p_start_date) || ' ' || EXTRACT(YEAR FROM p_start_date);
        WHEN 'monthly' THEN
            RETURN TO_CHAR(p_start_date, 'Month YYYY');
        WHEN 'quarterly' THEN
            RETURN 'Q' || EXTRACT(QUARTER FROM p_start_date) || ' ' || EXTRACT(YEAR FROM p_start_date);
        WHEN 'yearly' THEN
            RETURN EXTRACT(YEAR FROM p_start_date)::TEXT;
        ELSE
            RETURN 'Unknown Cycle';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Update the calculate_sop_cycle_end_date function
CREATE OR REPLACE FUNCTION calculate_sop_cycle_end_date(
    p_frequency TEXT,
    p_start_date DATE
) RETURNS DATE AS $$
DECLARE
    end_date DATE;
BEGIN
    CASE p_frequency
        WHEN 'weekly' THEN
            end_date := p_start_date + INTERVAL '6 days';
        WHEN 'monthly' THEN
            end_date := (DATE_TRUNC('month', p_start_date) + INTERVAL '1 month - 1 day')::DATE;
        WHEN 'quarterly' THEN
            end_date := (DATE_TRUNC('quarter', p_start_date) + INTERVAL '3 months - 1 day')::DATE;
        WHEN 'yearly' THEN
            end_date := (DATE_TRUNC('year', p_start_date) + INTERVAL '1 year - 1 day')::DATE;
        ELSE
            end_date := p_start_date;
    END CASE;
    
    RETURN end_date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. ENHANCED CYCLE GENERATION FUNCTION
-- =====================================================

-- Enhanced function to generate cycles from configuration with working days support
CREATE OR REPLACE FUNCTION generate_sop_cycles_from_config(
    p_config_id INTEGER,
    p_user_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    config_record RECORD;
    current_date DATE;
    cycle_start DATE;
    cycle_end DATE;
    cut_off_date DATE;
    cycle_name TEXT;
    cycles_created INTEGER := 0;
    working_days_config JSONB;
BEGIN
    -- Get configuration
    SELECT * INTO config_record 
    FROM sop_cycle_configs 
    WHERE id = p_config_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Configuration not found';
    END IF;
    
    current_date := config_record.generate_from_date;
    working_days_config := COALESCE(config_record.working_days_config, '{}'::JSONB);
    
    -- Generate cycles
    FOR i IN 0..(config_record.generate_count - 1) LOOP
        -- Calculate cycle start date
        cycle_start := current_date;
        
        -- Adjust start date based on frequency, day type, and parameters
        CASE config_record.frequency
            WHEN 'weekly' THEN
                IF config_record.day_type = 'working' THEN
                    -- Find the nth working day of the week
                    cycle_start := current_date + (i * 7);
                    -- Adjust to the specified working day of the week
                    WHILE NOT is_working_day(cycle_start, working_days_config) LOOP
                        cycle_start := cycle_start + INTERVAL '1 day';
                    END LOOP;
                ELSE
                    -- Regular weekly logic
                    cycle_start := current_date + (config_record.start_day - EXTRACT(DOW FROM current_date) + 7) % 7 + (i * 7);
                END IF;
                
            WHEN 'monthly' THEN
                IF config_record.day_type = 'working' THEN
                    -- Find the nth working day of the month
                    cycle_start := find_nth_working_day_in_month(
                        EXTRACT(YEAR FROM current_date),
                        EXTRACT(MONTH FROM current_date) + i,
                        config_record.start_day,
                        working_days_config
                    );
                ELSE
                    -- Regular monthly logic
                    cycle_start := DATE_TRUNC('month', current_date) + (config_record.start_day - 1) + (i * INTERVAL '1 month');
                END IF;
                
            WHEN 'quarterly' THEN
                IF config_record.day_type = 'working' THEN
                    -- Find the nth working day of the quarter
                    cycle_start := find_nth_working_day_in_quarter(
                        EXTRACT(YEAR FROM current_date),
                        EXTRACT(QUARTER FROM current_date),
                        config_record.start_day,
                        working_days_config
                    );
                ELSE
                    -- Regular quarterly logic
                    cycle_start := DATE_TRUNC('quarter', current_date) + (config_record.start_day - 1) + (i * INTERVAL '3 months');
                END IF;
                
            WHEN 'yearly' THEN
                IF config_record.day_type = 'working' THEN
                    -- Find the nth working day of the year
                    cycle_start := find_nth_working_day_in_year(
                        EXTRACT(YEAR FROM current_date) + i,
                        config_record.start_day,
                        working_days_config
                    );
                ELSE
                    -- Regular yearly logic
                    cycle_start := DATE_TRUNC('year', current_date) + (config_record.start_day - 1) + (i * INTERVAL '1 year');
                END IF;
        END CASE;
        
        -- Calculate cycle end date
        cycle_end := calculate_sop_cycle_end_date(config_record.frequency, cycle_start);
        
        -- Calculate cut-off date
        cut_off_date := cycle_end - config_record.cut_off_days;
        
        -- Generate cycle name
        cycle_name := generate_sop_cycle_name(config_record.frequency, cycle_start);
        
        -- Add working day indicator to name if applicable
        IF config_record.day_type = 'working' THEN
            cycle_name := cycle_name || ' (' || config_record.start_day || 
                         CASE 
                             WHEN config_record.start_day % 10 = 1 AND config_record.start_day % 100 != 11 THEN 'st'
                             WHEN config_record.start_day % 10 = 2 AND config_record.start_day % 100 != 12 THEN 'nd'
                             WHEN config_record.start_day % 10 = 3 AND config_record.start_day % 100 != 13 THEN 'rd'
                             ELSE 'th'
                         END || ' working day)';
        END IF;
        
        -- Insert cycle (ignore if already exists)
        BEGIN
            INSERT INTO sop_cycles (
                company_id, division_id, config_id, name, description,
                start_date, end_date, cut_off_date, created_by, updated_by
            ) VALUES (
                config_record.company_id, config_record.division_id, p_config_id,
                cycle_name, config_record.description,
                cycle_start, cycle_end, cut_off_date, p_user_id, p_user_id
            );
            
            cycles_created := cycles_created + 1;
        EXCEPTION
            WHEN unique_violation THEN
                -- Cycle already exists, skip
                NULL;
        END;
    END LOOP;
    
    RETURN cycles_created;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for day_type column
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_day_type ON sop_cycle_configs(day_type);

-- Index for working_days_config JSONB column
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_working_days ON sop_cycle_configs USING GIN(working_days_config);

-- Composite index for company, division, frequency, and day_type
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_company_division_freq_daytype 
ON sop_cycle_configs(company_id, division_id, frequency, day_type);

-- =====================================================
-- 6. UPDATE EXISTING DATA (if any)
-- =====================================================

-- Update any existing configurations to have proper working days config
UPDATE sop_cycle_configs 
SET working_days_config = '{
  "monday": true,
  "tuesday": true,
  "wednesday": true,
  "thursday": true,
  "friday": true,
  "saturday": false,
  "sunday": false,
  "holidays": []
}'::jsonb
WHERE working_days_config IS NULL OR working_days_config = 'null'::jsonb;

-- =====================================================
-- 7. VERIFICATION QUERIES
-- =====================================================

-- Check the updated table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'sop_cycle_configs' 
ORDER BY ordinal_position;

-- Check if functions were created successfully
SELECT 
    routine_name, 
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'is_working_day',
    'find_nth_working_day_in_month',
    'find_nth_working_day_in_quarter',
    'find_nth_working_day_in_year',
    'generate_sop_cycles_from_config'
)
ORDER BY routine_name;

-- Check indexes
SELECT 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename = 'sop_cycle_configs'
ORDER BY indexname;

-- =====================================================
-- 8. SAMPLE DATA INSERTION (Optional)
-- =====================================================

-- Uncomment the following section if you want to insert sample data for testing

/*
-- Sample S&OP cycle configuration with working days
INSERT INTO sop_cycle_configs (
    company_id, division_id, frequency, day_type, start_day, 
    cut_off_days, description, auto_generate, generate_from_date, 
    generate_count, working_days_config, created_by, updated_by
) VALUES (
    1, NULL, 'monthly', 'working', 1, 3,
    'Monthly S&OP cycles starting on 1st working day',
    true, CURRENT_DATE, 12,
    '{
      "monday": true,
      "tuesday": true,
      "wednesday": true,
      "thursday": true,
      "friday": true,
      "saturday": false,
      "sunday": false,
      "holidays": ["2024-01-01", "2024-07-04", "2024-12-25"]
    }'::jsonb,
    1, 1
);

-- Sample S&OP cycle configuration with regular days
INSERT INTO sop_cycle_configs (
    company_id, division_id, frequency, day_type, start_day, 
    cut_off_days, description, auto_generate, generate_from_date, 
    generate_count, working_days_config, created_by, updated_by
) VALUES (
    1, NULL, 'monthly', 'regular', 1, 3,
    'Monthly S&OP cycles starting on 1st of month',
    true, CURRENT_DATE, 12,
    '{
      "monday": true,
      "tuesday": true,
      "wednesday": true,
      "thursday": true,
      "friday": true,
      "saturday": false,
      "sunday": false,
      "holidays": []
    }'::jsonb,
    1, 1
);
*/

-- =====================================================
-- 9. COMMIT TRANSACTION
-- =====================================================

COMMIT;

-- =====================================================
-- SCRIPT COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'S&OP System Database Update Completed Successfully!';
    RAISE NOTICE 'New features added:';
    RAISE NOTICE '- Working days support (day_type column)';
    RAISE NOTICE '- Holiday configuration (working_days_config JSONB)';
    RAISE NOTICE '- Enhanced cycle generation with working days logic';
    RAISE NOTICE '- Performance indexes for better query performance';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now use the enhanced S&OP cycle system with:';
    RAISE NOTICE '- Regular days vs Working days selection';
    RAISE NOTICE '- Custom holiday configuration';
    RAISE NOTICE '- Year-specific holiday management';
    RAISE NOTICE '- Automatic working day calculations';
END $$; 
 
 
 
 
 
 
 
 
 