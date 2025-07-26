-- =====================================================
-- Simple S&OP Enhancement Script
-- DBeaver Compatible - Individual Statements Only
-- =====================================================
-- 
-- Run each section separately if needed.
-- =====================================================

-- =====================================================
-- SECTION 1: Add basic columns to sop_cycle_configs
-- =====================================================

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS company_id INTEGER;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS division_id INTEGER;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS frequency TEXT;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'regular';

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS start_day INTEGER;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS start_month INTEGER;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS cut_off_days INTEGER DEFAULT 3;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS auto_generate BOOLEAN DEFAULT TRUE;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS generate_from_date DATE;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS generate_count INTEGER DEFAULT 12;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS working_days_config JSONB;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS created_by INTEGER;

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE sop_cycle_configs ADD COLUMN IF NOT EXISTS updated_by INTEGER;

-- =====================================================
-- SECTION 2: Add columns to sop_cycles
-- =====================================================

ALTER TABLE sop_cycles ADD COLUMN IF NOT EXISTS config_id INTEGER;

ALTER TABLE sop_cycles ADD COLUMN IF NOT EXISTS cut_off_date DATE;

ALTER TABLE sop_cycles ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- =====================================================
-- SECTION 3: Create sop_cycle_permissions table
-- =====================================================

CREATE TABLE IF NOT EXISTS sop_cycle_permissions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    cycle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    permission_type TEXT NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT now(),
    granted_by INTEGER,
    expires_at TIMESTAMPTZ
);

-- =====================================================
-- SECTION 4: Create sop_cycle_audit_log table
-- =====================================================

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
-- SECTION 5: Add basic indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_company_id ON sop_cycle_configs(company_id);

CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_division_id ON sop_cycle_configs(division_id);

CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_frequency ON sop_cycle_configs(frequency);

CREATE INDEX IF NOT EXISTS idx_sop_cycles_config_id ON sop_cycles(config_id);

CREATE INDEX IF NOT EXISTS idx_sop_cycles_cut_off_date ON sop_cycles(cut_off_date);

CREATE INDEX IF NOT EXISTS idx_sop_cycle_permissions_cycle_id ON sop_cycle_permissions(cycle_id);

CREATE INDEX IF NOT EXISTS idx_sop_cycle_permissions_user_id ON sop_cycle_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_sop_cycle_audit_log_cycle_id ON sop_cycle_audit_log(cycle_id);

CREATE INDEX IF NOT EXISTS idx_sop_cycle_audit_log_user_id ON sop_cycle_audit_log(user_id);

-- =====================================================
-- SECTION 6: Create basic functions
-- =====================================================

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
-- SECTION 7: Verification queries
-- =====================================================

-- Check if columns were added
SELECT 
    table_name,
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name IN ('sop_cycle_configs', 'sop_cycles')
  AND column_name IN ('config_id', 'cut_off_date', 'frequency', 'day_type', 'working_days_config')
ORDER BY table_name, column_name;

-- Check if new tables were created
SELECT 
    table_name, 
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN ('sop_cycle_permissions', 'sop_cycle_audit_log')
ORDER BY table_name;

-- Check if functions were created
SELECT 
    routine_name, 
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN ('generate_sop_cycle_name', 'calculate_sop_cycle_end_date')
ORDER BY routine_name; 
 
 
 
 
 
 
 
 
 