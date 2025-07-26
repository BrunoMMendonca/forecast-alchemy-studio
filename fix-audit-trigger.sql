-- Fix audit trigger function to handle datasets table correctly
-- The datasets table uses uploaded_by instead of created_by

-- Drop and recreate the audit trigger function with better error handling
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_id_val INTEGER;
BEGIN
    -- Determine user_id based on table structure
    IF TG_OP = 'INSERT' THEN
        -- For datasets table, use uploaded_by instead of created_by
        IF TG_TABLE_NAME = 'datasets' THEN
            user_id_val := NEW.uploaded_by;
        ELSIF TG_TABLE_NAME = 'skus' OR TG_TABLE_NAME = 'forecasts' THEN
            -- These tables have created_by
            user_id_val := NEW.created_by;
        ELSE
            -- Default to null for other tables
            user_id_val := NULL;
        END IF;
        
        INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, new_values)
        VALUES (NEW.company_id, user_id_val, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_values, new_values)
        VALUES (NEW.company_id, NEW.updated_by, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_values)
        VALUES (OLD.company_id, OLD.updated_by, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'audit_table_changes'; 