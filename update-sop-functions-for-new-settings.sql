-- Update S&OP functions to use new working_days_settings structure
-- This replaces the old day_type field with the new flexible working days settings

-- Enhanced function to generate cycles from configuration with new working days settings
CREATE OR REPLACE FUNCTION generate_sop_cycles_from_config(
    p_config_id INTEGER,
    p_user_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    config_record RECORD;
    base_date DATE;
    cycle_start DATE;
    cycle_end DATE;
    cut_off_date DATE;
    cycle_name TEXT;
    cycles_created INTEGER := 0;
    working_days_config JSONB;
    working_days_settings JSONB;
    use_working_days_start BOOLEAN := FALSE;
    use_working_days_cutoff BOOLEAN := FALSE;
    cycle_base_date DATE;
    working_days_counted INTEGER;
    current_cutoff_date DATE;
    indicators TEXT[];
BEGIN
    -- Get configuration
    SELECT * INTO config_record 
    FROM sop_cycle_configs 
    WHERE id = p_config_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Configuration not found';
    END IF;
    
    base_date := config_record.generate_from_date;
    working_days_config := COALESCE(config_record.working_days_config, '{}'::JSONB);
    working_days_settings := COALESCE(config_record.working_days_settings, '{"startDate": {"useWorkingDays": false}, "cutOffPeriod": {"useWorkingDays": false}}'::JSONB);
    
    -- Extract working days settings
    use_working_days_start := COALESCE((working_days_settings->'startDate'->>'useWorkingDays')::BOOLEAN, FALSE);
    use_working_days_cutoff := COALESCE((working_days_settings->'cutOffPeriod'->>'useWorkingDays')::BOOLEAN, FALSE);
    
    -- Generate cycles
    FOR i IN 0..(config_record.generate_count - 1) LOOP
        -- Calculate the base date for this cycle iteration
        CASE config_record.frequency
            WHEN 'weekly' THEN
                cycle_base_date := base_date + (i * INTERVAL '7 days');
            WHEN 'monthly' THEN
                cycle_base_date := base_date + (i * INTERVAL '1 month');
            WHEN 'quarterly' THEN
                cycle_base_date := base_date + (i * INTERVAL '3 months');
            WHEN 'yearly' THEN
                cycle_base_date := base_date + (i * INTERVAL '1 year');
        END CASE;
        
        -- Calculate cycle start date
        cycle_start := cycle_base_date;
        
        -- Adjust start date based on frequency and working days settings
        CASE config_record.frequency
            WHEN 'weekly' THEN
                IF use_working_days_start THEN
                    -- Find the nth working day of the week
                    cycle_start := cycle_base_date;
                    -- Adjust to the specified working day of the week
                    WHILE NOT is_working_day(cycle_start, working_days_config) LOOP
                        cycle_start := cycle_start + INTERVAL '1 day';
                    END LOOP;
                ELSE
                    -- Regular weekly logic
                    cycle_start := cycle_base_date + (config_record.start_day - EXTRACT(DOW FROM cycle_base_date) + 7) % 7;
                END IF;
                
            WHEN 'monthly' THEN
                IF use_working_days_start THEN
                    -- Find the nth working day of the month
                    cycle_start := find_nth_working_day_in_month(
                        EXTRACT(YEAR FROM cycle_base_date),
                        EXTRACT(MONTH FROM cycle_base_date),
                        config_record.start_day,
                        working_days_config
                    );
                ELSE
                    -- Regular monthly logic
                    cycle_start := DATE_TRUNC('month', cycle_base_date) + (config_record.start_day - 1);
                END IF;
                
            WHEN 'quarterly' THEN
                IF use_working_days_start THEN
                    -- Find the nth working day of the quarter
                    cycle_start := find_nth_working_day_in_quarter(
                        EXTRACT(YEAR FROM cycle_base_date),
                        EXTRACT(QUARTER FROM cycle_base_date),
                        config_record.start_day,
                        working_days_config
                    );
                ELSE
                    -- Regular quarterly logic
                    cycle_start := DATE_TRUNC('quarter', cycle_base_date) + (config_record.start_day - 1);
                END IF;
                
            WHEN 'yearly' THEN
                IF use_working_days_start THEN
                    -- Find the nth working day of the year
                    cycle_start := find_nth_working_day_in_year(
                        EXTRACT(YEAR FROM cycle_base_date),
                        config_record.start_day,
                        working_days_config
                    );
                ELSE
                    -- Regular yearly logic
                    cycle_start := DATE_TRUNC('year', cycle_base_date) + (config_record.start_day - 1);
                END IF;
        END CASE;
        
        -- Calculate cycle end date
        cycle_end := calculate_sop_cycle_end_date(config_record.frequency, cycle_start);
        
        -- Calculate cut-off date based on working days setting
        IF use_working_days_cutoff THEN
            -- Count backwards from cycle end, skipping non-working days
            cut_off_date := cycle_end;
            working_days_counted := 0;
            current_cutoff_date := cycle_end;
            
            WHILE working_days_counted < config_record.cut_off_days LOOP
                current_cutoff_date := current_cutoff_date - INTERVAL '1 day';
                IF is_working_day(current_cutoff_date, working_days_config) THEN
                    working_days_counted := working_days_counted + 1;
                END IF;
            END LOOP;
            cut_off_date := current_cutoff_date;
        ELSE
            -- Regular calendar days
            cut_off_date := cycle_end - config_record.cut_off_days;
        END IF;
        
        -- Generate cycle name
        cycle_name := generate_sop_cycle_name(config_record.frequency, cycle_start);
        
        -- Add working day indicators to name if applicable
        IF use_working_days_start OR use_working_days_cutoff THEN
            indicators := ARRAY[]::TEXT[];
            IF use_working_days_start THEN
                indicators := array_append(indicators, config_record.start_day || get_ordinal_suffix(config_record.start_day) || ' working day start');
            END IF;
            IF use_working_days_cutoff THEN
                indicators := array_append(indicators, config_record.cut_off_days || ' working days cut-off');
            END IF;
            cycle_name := cycle_name || ' (' || array_to_string(indicators, ', ') || ')';
        END IF;
        
        -- Insert cycle
        INSERT INTO sop_cycles (
            company_id, division_id, config_id, name, description,
            start_date, end_date, cut_off_date, status, created_by, updated_by
        ) VALUES (
            config_record.company_id, config_record.division_id, p_config_id,
            cycle_name, config_record.description,
            cycle_start, cycle_end, cut_off_date, 'active', p_user_id, p_user_id
        );
        
        cycles_created := cycles_created + 1;
    END LOOP;
    
    RETURN cycles_created;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get ordinal suffix
CREATE OR REPLACE FUNCTION get_ordinal_suffix(num INTEGER) RETURNS TEXT AS $$
BEGIN
    IF num % 10 = 1 AND num % 100 != 11 THEN
        RETURN 'st';
    ELSIF num % 10 = 2 AND num % 100 != 12 THEN
        RETURN 'nd';
    ELSIF num % 10 = 3 AND num % 100 != 13 THEN
        RETURN 'rd';
    ELSE
        RETURN 'th';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to generate cycle names with proper week numbering
CREATE OR REPLACE FUNCTION generate_sop_cycle_name(
    p_frequency TEXT,
    p_start_date DATE
) RETURNS TEXT AS $$
BEGIN
    CASE p_frequency
        WHEN 'weekly' THEN
            RETURN 'Week ' || EXTRACT(WEEK FROM p_start_date) || ' of ' || EXTRACT(YEAR FROM p_start_date);
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