-- Check and fix the audit trigger function
-- First, let's see what the current function looks like

-- Check the current audit trigger function
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'audit_table_changes';

-- Now let's fix it to use created_by instead of uploaded_by
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, new_values)
        VALUES (NEW.company_id, NEW.created_by, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
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

-- Check what columns exist in the datasets table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'datasets' 
AND column_name IN ('uploaded_by', 'created_by')
ORDER BY column_name; 