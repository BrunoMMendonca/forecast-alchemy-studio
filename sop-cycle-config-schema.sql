-- =====================================================
-- ENHANCED S&OP CYCLE CONFIGURATION SCHEMA
-- =====================================================

-- S&OP Cycle Configurations (templates for automatic cycle generation)
CREATE TABLE IF NOT EXISTS sop_cycle_configs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE, -- NULL for company-wide
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    day_type TEXT NOT NULL DEFAULT 'regular' CHECK (day_type IN ('regular', 'working')), -- NEW: regular vs working days
    start_day INTEGER NOT NULL CHECK (start_day >= 1 AND start_day <= 31),
    start_month INTEGER CHECK (start_month >= 1 AND start_month <= 12), -- For quarterly/yearly
    cut_off_days INTEGER NOT NULL DEFAULT 3 CHECK (cut_off_days >= 0 AND cut_off_days <= 30),
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    auto_generate BOOLEAN DEFAULT TRUE,
    generate_from_date DATE NOT NULL,
    generate_count INTEGER NOT NULL DEFAULT 12 CHECK (generate_count >= 1 AND generate_count <= 60),
    working_days_config JSONB, -- NEW: configuration for working days and holidays
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, division_id, frequency) -- One config per division per frequency
);

-- Enhanced S&OP Cycles (automatically generated)
CREATE TABLE IF NOT EXISTS sop_cycles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE, -- NULL for company-wide
    config_id INTEGER REFERENCES sop_cycle_configs(id) ON DELETE SET NULL, -- Which config generated this cycle
    name TEXT NOT NULL, -- Auto-generated name like "January 2024", "Q1 2024"
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cut_off_date DATE NOT NULL, -- When regular users can no longer modify forecasts
    is_current BOOLEAN DEFAULT FALSE, -- Only one current cycle per division
    is_completed BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, division_id, name), -- Unique name per division
    UNIQUE(company_id, division_id, start_date) -- No overlapping cycles
);

-- S&OP Cycle Permissions (who can modify what during cut-off periods)
CREATE TABLE IF NOT EXISTS sop_cycle_permissions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'approve', 'admin')),
    granted_at TIMESTAMPTZ DEFAULT now(),
    granted_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMPTZ, -- Optional expiration
    UNIQUE(cycle_id, user_id, permission_type)
);

-- S&OP Cycle Audit Log (tracking changes during cut-off periods)
CREATE TABLE IF NOT EXISTS sop_cycle_audit_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- S&OP Cycle Configs indexes
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_company ON sop_cycle_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_division ON sop_cycle_configs(division_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_active ON sop_cycle_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_configs_frequency ON sop_cycle_configs(frequency);

-- S&OP Cycles indexes
CREATE INDEX IF NOT EXISTS idx_sop_cycles_company ON sop_cycles(company_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_division ON sop_cycles(division_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_config ON sop_cycles(config_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_current ON sop_cycles(is_current);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_status ON sop_cycles(status);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_dates ON sop_cycles(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_cutoff ON sop_cycles(cut_off_date);

-- S&OP Cycle Permissions indexes
CREATE INDEX IF NOT EXISTS idx_sop_cycle_permissions_cycle ON sop_cycle_permissions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_permissions_user ON sop_cycle_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_permissions_type ON sop_cycle_permissions(permission_type);

-- S&OP Cycle Audit Log indexes
CREATE INDEX IF NOT EXISTS idx_sop_cycle_audit_cycle ON sop_cycle_audit_log(cycle_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_audit_user ON sop_cycle_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycle_audit_created ON sop_cycle_audit_log(created_at);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to ensure only one current cycle per division
CREATE OR REPLACE FUNCTION ensure_single_current_sop_cycle()
RETURNS TRIGGER AS $$
BEGIN
    -- If this cycle is being set as current, unset all others for the same division
    IF NEW.is_current = TRUE THEN
        UPDATE sop_cycles 
        SET is_current = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = NEW.updated_by
        WHERE company_id = NEW.company_id 
          AND division_id IS NOT DISTINCT FROM NEW.division_id 
          AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure single current cycle
CREATE TRIGGER ensure_single_current_sop_cycle_trigger
    BEFORE INSERT OR UPDATE ON sop_cycles
    FOR EACH ROW EXECUTE FUNCTION ensure_single_current_sop_cycle();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sop_cycle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_sop_cycle_configs_updated_at 
    BEFORE UPDATE ON sop_cycle_configs 
    FOR EACH ROW EXECUTE FUNCTION update_sop_cycle_updated_at();

CREATE TRIGGER update_sop_cycles_updated_at 
    BEFORE UPDATE ON sop_cycles 
    FOR EACH ROW EXECUTE FUNCTION update_sop_cycle_updated_at();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to generate cycle name based on frequency and date
CREATE OR REPLACE FUNCTION generate_sop_cycle_name(
    p_frequency TEXT,
    p_start_date DATE
) RETURNS TEXT AS $$
DECLARE
    cycle_name TEXT;
BEGIN
    CASE p_frequency
        WHEN 'weekly' THEN
            cycle_name := 'Week ' || EXTRACT(WEEK FROM p_start_date) || ' ' || EXTRACT(YEAR FROM p_start_date);
        WHEN 'monthly' THEN
            cycle_name := TO_CHAR(p_start_date, 'Month YYYY');
        WHEN 'quarterly' THEN
            cycle_name := 'Q' || EXTRACT(QUARTER FROM p_start_date) || ' ' || EXTRACT(YEAR FROM p_start_date);
        WHEN 'yearly' THEN
            cycle_name := EXTRACT(YEAR FROM p_start_date)::TEXT;
        ELSE
            cycle_name := 'Unknown';
    END CASE;
    
    RETURN TRIM(cycle_name);
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
            end_date := (p_start_date + INTERVAL '1 month')::DATE - INTERVAL '1 day';
        WHEN 'quarterly' THEN
            end_date := (p_start_date + INTERVAL '3 months')::DATE - INTERVAL '1 day';
        WHEN 'yearly' THEN
            end_date := (p_start_date + INTERVAL '1 year')::DATE - INTERVAL '1 day';
        ELSE
            end_date := p_start_date;
    END CASE;
    
    RETURN end_date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTIONS FOR WORKING DAYS
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
                    -- This is more complex for weekly, so we'll use a simplified approach
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
-- COMMENTS
-- =====================================================

COMMENT ON TABLE sop_cycle_configs IS 'Templates for automatic S&OP cycle generation';
COMMENT ON COLUMN sop_cycle_configs.division_id IS 'NULL for company-wide cycles, otherwise specific division';
COMMENT ON COLUMN sop_cycle_configs.frequency IS 'How often cycles repeat: weekly, monthly, quarterly, yearly';
COMMENT ON COLUMN sop_cycle_configs.start_day IS 'Day of week (1-7) for weekly, day of month (1-31) for others';
COMMENT ON COLUMN sop_cycle_configs.start_month IS 'Starting month (1-12) for quarterly/yearly cycles';
COMMENT ON COLUMN sop_cycle_configs.cut_off_days IS 'Days before cycle end when regular users cannot modify forecasts';

COMMENT ON TABLE sop_cycles IS 'Automatically generated S&OP cycles';
COMMENT ON COLUMN sop_cycles.division_id IS 'NULL for company-wide cycles';
COMMENT ON COLUMN sop_cycles.is_current IS 'Only one current cycle per division';
COMMENT ON COLUMN sop_cycles.cut_off_date IS 'Date when regular users can no longer modify forecasts';

COMMENT ON TABLE sop_cycle_permissions IS 'User permissions for S&OP cycles during cut-off periods';
COMMENT ON COLUMN sop_cycle_permissions.permission_type IS 'view, edit, approve, or admin permissions';

COMMENT ON TABLE sop_cycle_audit_log IS 'Audit trail for changes made during cut-off periods'; 
 
 
 
 
 
 
 
 
 