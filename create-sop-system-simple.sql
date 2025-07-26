-- =====================================================
-- S&OP System Database Creation Script (SIMPLE)
-- DBeaver Compatible - No Transactions
-- =====================================================
-- 
-- This script creates the complete S&OP cycle management system
-- without using transactions to avoid aborted transaction issues.
--
-- Run this script in DBeaver to create the S&OP system from scratch.
-- =====================================================

-- =====================================================
-- 1. CREATE S&OP CYCLE CONFIGURATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS sop_cycle_configs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    division_id INTEGER,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    day_type TEXT NOT NULL DEFAULT 'regular' CHECK (day_type IN ('regular', 'working')),
    start_day INTEGER NOT NULL CHECK (start_day >= 1 AND start_day <= 31),
    start_month INTEGER CHECK (start_month >= 1 AND start_month <= 12),
    cut_off_days INTEGER NOT NULL DEFAULT 3 CHECK (cut_off_days >= 0 AND cut_off_days <= 30),
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    auto_generate BOOLEAN DEFAULT TRUE,
    generate_from_date DATE NOT NULL,
    generate_count INTEGER NOT NULL DEFAULT 12 CHECK (generate_count >= 1 AND generate_count <= 60),
    working_days_config JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER
);

-- =====================================================
-- 2. CREATE S&OP CYCLES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS sop_cycles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    division_id INTEGER,
    config_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cut_off_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'locked', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER
);

-- =====================================================
-- 3. CREATE S&OP CYCLE PERMISSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS sop_cycle_permissions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    cycle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'approve', 'admin')),
    granted_at TIMESTAMPTZ DEFAULT now(),
    granted_by INTEGER,
    expires_at TIMESTAMPTZ
);

-- =====================================================
-- 4. CREATE S&OP CYCLE AUDIT LOG TABLE
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
-- 5. ADD FOREIGN KEY CONSTRAINTS (if tables exist)
-- =====================================================

-- Add foreign key constraints only if referenced tables exist
DO $$
BEGIN
    -- Check if companies table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
        ALTER TABLE sop_cycle_configs ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_configs_company_id 
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        ALTER TABLE sop_cycles ADD CONSTRAINT IF NOT EXISTS fk_sop_cycles_company_id 
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        ALTER TABLE sop_cycle_permissions ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_permissions_company_id 
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        ALTER TABLE sop_cycle_audit_log ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_audit_log_company_id 
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
    
    -- Check if divisions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'divisions') THEN
        ALTER TABLE sop_cycle_configs ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_configs_division_id 
            FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE;
        ALTER TABLE sop_cycles ADD CONSTRAINT IF NOT EXISTS fk_sop_cycles_division_id 
            FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE;
    END IF;
    
    -- Check if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE sop_cycle_configs ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_configs_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id);
        ALTER TABLE sop_cycle_configs ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_configs_updated_by 
            FOREIGN KEY (updated_by) REFERENCES users(id);
        ALTER TABLE sop_cycles ADD CONSTRAINT IF NOT EXISTS fk_sop_cycles_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id);
        ALTER TABLE sop_cycles ADD CONSTRAINT IF NOT EXISTS fk_sop_cycles_updated_by 
            FOREIGN KEY (updated_by) REFERENCES users(id);
        ALTER TABLE sop_cycle_permissions ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_permissions_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        ALTER TABLE sop_cycle_permissions ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_permissions_granted_by 
            FOREIGN KEY (granted_by) REFERENCES users(id);
        ALTER TABLE sop_cycle_audit_log ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_audit_log_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add config_id foreign key
    ALTER TABLE sop_cycles ADD CONSTRAINT IF NOT EXISTS fk_sop_cycles_config_id 
        FOREIGN KEY (config_id) REFERENCES sop_cycle_configs(id) ON DELETE SET NULL;
    
    -- Add cycle_id foreign key
    ALTER TABLE sop_cycle_permissions ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_permissions_cycle_id 
        FOREIGN KEY (cycle_id) REFERENCES sop_cycles(id) ON DELETE CASCADE;
    ALTER TABLE sop_cycle_audit_log ADD CONSTRAINT IF NOT EXISTS fk_sop_cycle_audit_log_cycle_id 
        FOREIGN KEY (cycle_id) REFERENCES sop_cycles(id) ON DELETE CASCADE;
END $$;

-- =====================================================
-- 6. ADD UNIQUE CONSTRAINTS
-- =====================================================

ALTER TABLE sop_cycle_configs ADD CONSTRAINT IF NOT EXISTS uk_sop_cycle_configs_company_division_freq 
    UNIQUE(company_id, division_id, frequency);

ALTER TABLE sop_cycles ADD CONSTRAINT IF NOT EXISTS uk_sop_cycles_company_division_name 
    UNIQUE(company_id, division_id, name);

ALTER TABLE sop_cycle_permissions ADD CONSTRAINT IF NOT EXISTS uk_sop_cycle_permissions_cycle_user_type 
    UNIQUE(cycle_id, user_id, permission_type);

-- =====================================================
-- 7. CREATE INDEXES
-- =====================================================

-- Indexes for sop_cycle_configs
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_company_id ON sop_cycle_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_division_id ON sop_cycle_configs(division_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_frequency ON sop_cycle_configs(frequency);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_day_type ON sop_cycle_configs(day_type);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_working_days ON sop_cycle_configs USING GIN(working_days_config);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_active ON sop_cycle_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_created_at ON sop_cycle_configs(created_at);

-- Indexes for sop_cycles
CREATE INDEX IF NOT EXISTS idx_sop_cycles_company_id ON sop_cycles(company_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_division_id ON sop_cycles(division_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_config_id ON sop_cycles(config_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_start_date ON sop_cycles(start_date);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_end_date ON sop_cycles(end_date);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_cut_off_date ON sop_cycles(cut_off_date);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_is_current ON sop_cycles(is_current);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_status ON sop_cycles(status);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_created_at ON sop_cycles(created_at);

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
-- 8. CREATE BASIC FUNCTIONS
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

-- =====================================================
-- 9. VERIFICATION
-- =====================================================

-- Check if tables were created successfully
SELECT 
    table_name, 
    table_type
FROM information_schema.tables 
WHERE table_name IN (
    'sop_cycle_configs',
    'sop_cycles',
    'sop_cycle_permissions',
    'sop_cycle_audit_log'
)
ORDER BY table_name;

-- Check table structures
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN (
    'sop_cycle_configs',
    'sop_cycles',
    'sop_cycle_permissions',
    'sop_cycle_audit_log'
)
ORDER BY table_name, ordinal_position;

-- Check if functions were created successfully
SELECT 
    routine_name, 
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'generate_sop_cycle_name',
    'calculate_sop_cycle_end_date'
)
ORDER BY routine_name;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'S&OP System Database Creation Completed Successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '- sop_cycle_configs (S&OP cycle configurations)';
    RAISE NOTICE '- sop_cycles (Generated S&OP cycles)';
    RAISE NOTICE '- sop_cycle_permissions (User permissions for cycles)';
    RAISE NOTICE '- sop_cycle_audit_log (Audit trail for cycle changes)';
    RAISE NOTICE '';
    RAISE NOTICE 'Basic functions created:';
    RAISE NOTICE '- generate_sop_cycle_name';
    RAISE NOTICE '- calculate_sop_cycle_end_date';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now use the basic S&OP cycle management system!';
    RAISE NOTICE 'Advanced features (working days, triggers) can be added later.';
END $$; 
 
 
 
 
 
 
 
 
 