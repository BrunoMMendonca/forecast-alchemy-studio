-- =====================================================
-- S&OP System Database Creation Script
-- DBeaver Compatible
-- =====================================================
-- 
-- This script creates the complete S&OP cycle management system
-- including all tables, functions, indexes, and triggers.
--
-- Run this script in DBeaver to create the S&OP system from scratch.
-- =====================================================

-- Start transaction for safe execution
BEGIN;

-- =====================================================
-- 1. CREATE S&OP CYCLE CONFIGURATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS sop_cycle_configs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE, -- NULL for company-wide
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    day_type TEXT NOT NULL DEFAULT 'regular' CHECK (day_type IN ('regular', 'working')), -- regular vs working days
    start_day INTEGER NOT NULL CHECK (start_day >= 1 AND start_day <= 31),
    start_month INTEGER CHECK (start_month >= 1 AND start_month <= 12), -- For quarterly/yearly
    cut_off_days INTEGER NOT NULL DEFAULT 3 CHECK (cut_off_days >= 0 AND cut_off_days <= 30),
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    auto_generate BOOLEAN DEFAULT TRUE,
    generate_from_date DATE NOT NULL,
    generate_count INTEGER NOT NULL DEFAULT 12 CHECK (generate_count >= 1 AND generate_count <= 60),
    working_days_config JSONB, -- Configuration for working days and holidays
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, division_id, frequency) -- One config per division per frequency
);

-- =====================================================
-- 2. CREATE S&OP CYCLES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS sop_cycles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE, -- NULL for company-wide
    config_id INTEGER REFERENCES sop_cycle_configs(id) ON DELETE SET NULL, -- Reference to config that generated this cycle
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cut_off_date DATE NOT NULL, -- Date when regular users can no longer modify forecasts
    is_current BOOLEAN DEFAULT FALSE, -- Only one cycle can be current per division
    is_completed BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'locked', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, division_id, name) -- Unique cycle names per division
);

-- =====================================================
-- 3. CREATE S&OP CYCLE PERMISSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS sop_cycle_permissions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'approve', 'admin')),
    granted_at TIMESTAMPTZ DEFAULT now(),
    granted_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMPTZ, -- Optional expiration date
    UNIQUE(cycle_id, user_id, permission_type) -- One permission per type per user per cycle
);

-- =====================================================
-- 4. CREATE S&OP CYCLE AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS sop_cycle_audit_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL, -- 'created', 'modified', 'status_changed', 'permission_granted', etc.
    details JSONB, -- Additional details about the action
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for sop_cycle_configs
CREATE INDEX idx_sop_cycle_configs_company_id ON sop_cycle_configs(company_id);
CREATE INDEX idx_sop_cycle_configs_division_id ON sop_cycle_configs(division_id);
CREATE INDEX idx_sop_cycle_configs_frequency ON sop_cycle_configs(frequency);
CREATE INDEX idx_sop_cycle_configs_day_type ON sop_cycle_configs(day_type);
CREATE INDEX idx_sop_cycle_configs_working_days ON sop_cycle_configs USING GIN(working_days_config);
CREATE INDEX idx_sop_cycle_configs_active ON sop_cycle_configs(is_active);
CREATE INDEX idx_sop_cycle_configs_created_at ON sop_cycle_configs(created_at);

-- Composite indexes for sop_cycle_configs
CREATE INDEX idx_sop_cycle_configs_company_division_freq ON sop_cycle_configs(company_id, division_id, frequency);
CREATE INDEX idx_sop_cycle_configs_company_division_freq_daytype ON sop_cycle_configs(company_id, division_id, frequency, day_type);

-- Indexes for sop_cycles
CREATE INDEX idx_sop_cycles_company_id ON sop_cycles(company_id);
CREATE INDEX idx_sop_cycles_division_id ON sop_cycles(division_id);
CREATE INDEX idx_sop_cycles_config_id ON sop_cycles(config_id);
CREATE INDEX idx_sop_cycles_start_date ON sop_cycles(start_date);
CREATE INDEX idx_sop_cycles_end_date ON sop_cycles(end_date);
CREATE INDEX idx_sop_cycles_cut_off_date ON sop_cycles(cut_off_date);
CREATE INDEX idx_sop_cycles_is_current ON sop_cycles(is_current);
CREATE INDEX idx_sop_cycles_status ON sop_cycles(status);
CREATE INDEX idx_sop_cycles_created_at ON sop_cycles(created_at);

-- Composite indexes for sop_cycles
CREATE INDEX idx_sop_cycles_company_division_current ON sop_cycles(company_id, division_id, is_current);
CREATE INDEX idx_sop_cycles_company_division_status ON sop_cycles(company_id, division_id, status);
CREATE INDEX idx_sop_cycles_date_range ON sop_cycles(start_date, end_date);

-- Indexes for sop_cycle_permissions
CREATE INDEX idx_sop_cycle_permissions_cycle_id ON sop_cycle_permissions(cycle_id);
CREATE INDEX idx_sop_cycle_permissions_user_id ON sop_cycle_permissions(user_id);
CREATE INDEX idx_sop_cycle_permissions_type ON sop_cycle_permissions(permission_type);
CREATE INDEX idx_sop_cycle_permissions_expires_at ON sop_cycle_permissions(expires_at);

-- Indexes for sop_cycle_audit_log
CREATE INDEX idx_sop_cycle_audit_log_cycle_id ON sop_cycle_audit_log(cycle_id);
CREATE INDEX idx_sop_cycle_audit_log_user_id ON sop_cycle_audit_log(user_id);
CREATE INDEX idx_sop_cycle_audit_log_action ON sop_cycle_audit_log(action);
CREATE INDEX idx_sop_cycle_audit_log_created_at ON sop_cycle_audit_log(created_at);

-- =====================================================
-- 6. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to generate cycle names based on frequency and start date
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

-- Function to calculate cycle end date based on frequency and start date
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
-- 7. CREATE WORKING DAYS FUNCTIONS
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
-- 8. CREATE CYCLE GENERATION FUNCTION
-- =====================================================

-- Function to generate cycles from a configuration
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
-- 9. CREATE TRIGGER FUNCTIONS
-- =====================================================

-- Function to ensure only one current cycle per division
CREATE OR REPLACE FUNCTION ensure_single_current_sop_cycle()
RETURNS TRIGGER AS $$
BEGIN
    -- If this cycle is being set as current, unset all others for the same company/division
    IF NEW.is_current = TRUE THEN
        UPDATE sop_cycles 
        SET is_current = FALSE 
        WHERE company_id = NEW.company_id 
          AND division_id IS NOT DISTINCT FROM NEW.division_id 
          AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sop_cycle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. CREATE TRIGGERS
-- =====================================================

-- Trigger to ensure only one current cycle per division
CREATE TRIGGER trigger_ensure_single_current_sop_cycle
    BEFORE INSERT OR UPDATE ON sop_cycles
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_current_sop_cycle();

-- Trigger to update updated_at timestamp for sop_cycle_configs
CREATE TRIGGER trigger_update_sop_cycle_configs_updated_at
    BEFORE UPDATE ON sop_cycle_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_sop_cycle_updated_at();

-- Trigger to update updated_at timestamp for sop_cycles
CREATE TRIGGER trigger_update_sop_cycles_updated_at
    BEFORE UPDATE ON sop_cycles
    FOR EACH ROW
    EXECUTE FUNCTION update_sop_cycle_updated_at();

-- =====================================================
-- 11. SAMPLE DATA INSERTION (Optional)
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
-- 12. VERIFICATION QUERIES
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
    is_nullable, 
    column_default
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
    'calculate_sop_cycle_end_date',
    'is_working_day',
    'find_nth_working_day_in_month',
    'find_nth_working_day_in_quarter',
    'find_nth_working_day_in_year',
    'generate_sop_cycles_from_config',
    'ensure_single_current_sop_cycle',
    'update_sop_cycle_updated_at'
)
ORDER BY routine_name;

-- Check if triggers were created successfully
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_name IN (
    'trigger_ensure_single_current_sop_cycle',
    'trigger_update_sop_cycle_configs_updated_at',
    'trigger_update_sop_cycles_updated_at'
)
ORDER BY trigger_name;

-- Check indexes
SELECT 
    indexname, 
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN (
    'sop_cycle_configs',
    'sop_cycles',
    'sop_cycle_permissions',
    'sop_cycle_audit_log'
)
ORDER BY tablename, indexname;

-- =====================================================
-- 13. COMMIT TRANSACTION
-- =====================================================

COMMIT;

-- =====================================================
-- SCRIPT COMPLETION MESSAGE
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
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '- Working days calculation functions';
    RAISE NOTICE '- Cycle generation and naming functions';
    RAISE NOTICE '- Trigger functions for data integrity';
    RAISE NOTICE '';
    RAISE NOTICE 'Features available:';
    RAISE NOTICE '- Regular days vs Working days support';
    RAISE NOTICE '- Holiday configuration and management';
    RAISE NOTICE '- Year-specific holiday planning';
    RAISE NOTICE '- Automatic cycle generation';
    RAISE NOTICE '- User permissions and audit logging';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now use the complete S&OP cycle management system!';
END $$; 
 
 
 
 
 
 
 
 
 