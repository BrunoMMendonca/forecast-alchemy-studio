-- =====================================================
-- Enhance Existing S&OP Tables
-- DBeaver Compatible - Works with your current schema
-- =====================================================
-- 
-- This script enhances your existing S&OP tables with the missing
-- functionality for the enhanced S&OP cycle management system.
-- =====================================================

-- =====================================================
-- 1. ENHANCE sop_cycle_configs TABLE
-- =====================================================

-- Add missing columns to sop_cycle_configs
ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY;

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL;

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS division_id INTEGER;

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly'));

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS day_type TEXT NOT NULL DEFAULT 'regular' CHECK (day_type IN ('regular', 'working'));

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS start_day INTEGER NOT NULL CHECK (start_day >= 1 AND start_day <= 31);

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS start_month INTEGER CHECK (start_month >= 1 AND start_month <= 12);

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS cut_off_days INTEGER NOT NULL DEFAULT 3 CHECK (cut_off_days >= 0 AND cut_off_days <= 30);

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS auto_generate BOOLEAN DEFAULT TRUE;

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS generate_from_date DATE NOT NULL;

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS generate_count INTEGER NOT NULL DEFAULT 12 CHECK (generate_count >= 1 AND generate_count <= 60);

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS working_days_config JSONB;

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS created_by INTEGER;

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE sop_cycle_configs 
ADD COLUMN IF NOT EXISTS updated_by INTEGER;

-- =====================================================
-- 2. ENHANCE sop_cycles TABLE
-- =====================================================

-- Add missing columns to sop_cycles
ALTER TABLE sop_cycles 
ADD COLUMN IF NOT EXISTS config_id INTEGER;

ALTER TABLE sop_cycles 
ADD COLUMN IF NOT EXISTS cut_off_date DATE;

ALTER TABLE sop_cycles 
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Update existing records to have cut_off_date if missing
UPDATE sop_cycles 
SET cut_off_date = end_date - INTERVAL '3 days'
WHERE cut_off_date IS NULL AND end_date IS NOT NULL;

-- =====================================================
-- 3. CREATE MISSING TABLES
-- =====================================================

-- Create sop_cycle_permissions table
CREATE TABLE IF NOT EXISTS sop_cycle_permissions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    cycle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'approve', 'admin')),
    granted_at TIMESTAMPTZ DEFAULT now(),
    granted_by INTEGER,
    expires_at TIMESTAMPTZ,
    UNIQUE(cycle_id, user_id, permission_type)
);

-- Create sop_cycle_audit_log table
CREATE TABLE IF NOT EXISTS sop_cycle_audit_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    cycle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add foreign key constraints to sop_cycle_configs
ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_configs_company_id 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_configs_division_id 
    FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE;

ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_configs_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_configs_updated_by 
    FOREIGN KEY (updated_by) REFERENCES users(id);

-- Add foreign key constraints to sop_cycles
ALTER TABLE sop_cycles 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycles_config_id 
    FOREIGN KEY (config_id) REFERENCES sop_cycle_configs(id) ON DELETE SET NULL;

-- Add foreign key constraints to sop_cycle_permissions
ALTER TABLE sop_cycle_permissions 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_permissions_company_id 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE sop_cycle_permissions 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_permissions_cycle_id 
    FOREIGN KEY (cycle_id) REFERENCES sop_cycles(id) ON DELETE CASCADE;

ALTER TABLE sop_cycle_permissions 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_permissions_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE sop_cycle_permissions 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_permissions_granted_by 
    FOREIGN KEY (granted_by) REFERENCES users(id);

-- Add foreign key constraints to sop_cycle_audit_log
ALTER TABLE sop_cycle_audit_log 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_audit_log_company_id 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE sop_cycle_audit_log 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_audit_log_cycle_id 
    FOREIGN KEY (cycle_id) REFERENCES sop_cycles(id) ON DELETE CASCADE;

ALTER TABLE sop_cycle_audit_log 
ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_audit_log_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =====================================================
-- 5. ADD UNIQUE CONSTRAINTS
-- =====================================================

ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT IF NOT EXISTS uk_sop_cycle_configs_company_division_freq 
    UNIQUE(company_id, division_id, frequency);

-- =====================================================
-- 6. CREATE INDEXES
-- =====================================================

-- Indexes for sop_cycle_configs
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_company_id ON sop_cycle_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_division_id ON sop_cycle_configs(division_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_frequency ON sop_cycle_configs(frequency);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_day_type ON sop_cycle_configs(day_type);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_working_days ON sop_cycle_configs USING GIN(working_days_config);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_active ON sop_cycle_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_created_at ON sop_cycle_configs(created_at);

-- Indexes for sop_cycles (enhanced)
CREATE INDEX IF NOT EXISTS idx_sop_cycles_config_id ON sop_cycles(config_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_cut_off_date ON sop_cycles(cut_off_date);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_is_completed ON sop_cycles(is_completed);

-- Indexes for sop_cycle_permissions
CREATE INDEX IF NOT EXISTS idx_sop_cycle_permissions_cycle_id ON sop_cycle_permissions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_permissions_user_id ON sop_cycle_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_permissions_type ON sop_cycle_permissions(permission_type);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_permissions_expires_at ON sop_cycle_permissions(expires_at);

-- Indexes for sop_cycle_audit_log
CREATE INDEX IF NOT EXISTS idx_sop_cycle_audit_log_cycle_id ON sop_cycle_audit_log(cycle_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_audit_log_user_id ON sop_cycle_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_audit_log_action ON sop_cycle_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_audit_log_created_at ON sop_cycle_audit_log(created_at);

-- =====================================================
-- 7. CREATE FUNCTIONS
-- =====================================================

-- Function to generate cycle names
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

-- Function to calculate cycle end date
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
-- 8. VERIFICATION
-- =====================================================

-- Check enhanced table structures
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name IN ('sop_cycle_configs', 'sop_cycles', 'sop_cycle_permissions', 'sop_cycle_audit_log')
ORDER BY table_name, ordinal_position;

-- Check if functions were created successfully
SELECT 
    routine_name, 
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN (
    'generate_sop_cycle_name',
    'calculate_sop_cycle_end_date',
    'is_working_day',
    'find_nth_working_day_in_month',
    'find_nth_working_day_in_quarter',
    'find_nth_working_day_in_year'
  )
ORDER BY routine_name;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'S&OP Tables Enhancement Completed Successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Enhanced tables:';
    RAISE NOTICE '- sop_cycle_configs (added all missing columns)';
    RAISE NOTICE '- sop_cycles (added config_id, cut_off_date, is_completed)';
    RAISE NOTICE '- sop_cycle_permissions (created)';
    RAISE NOTICE '- sop_cycle_audit_log (created)';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '- generate_sop_cycle_name';
    RAISE NOTICE '- calculate_sop_cycle_end_date';
    RAISE NOTICE '- is_working_day';
    RAISE NOTICE '- find_nth_working_day_in_month';
    RAISE NOTICE '- find_nth_working_day_in_quarter';
    RAISE NOTICE '- find_nth_working_day_in_year';
    RAISE NOTICE '';
    RAISE NOTICE 'Features available:';
    RAISE NOTICE '- Regular days vs Working days support';
    RAISE NOTICE '- Holiday configuration and management';
    RAISE NOTICE '- Year-specific holiday planning';
    RAISE NOTICE '- Automatic cycle generation';
    RAISE NOTICE '- User permissions and audit logging';
    RAISE NOTICE '';
    RAISE NOTICE 'Your existing S&OP cycles are preserved and enhanced!';
END $$; 
 
 
 
 
 
 
 
 
 