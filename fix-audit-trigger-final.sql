-- Fix the audit trigger function to use created_by for datasets table
-- The current function is backwards - it should use created_by, not uploaded_by

CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- For datasets table, use created_by (not uploaded_by)
        IF TG_TABLE_NAME = 'datasets' THEN
            INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, new_values)
            VALUES (NEW.company_id, NEW.created_by, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        ELSE
            INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, new_values)
            VALUES (NEW.company_id, NEW.created_by, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- For datasets table, use created_by (not uploaded_by)
        IF TG_TABLE_NAME = 'datasets' THEN
            INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_values, new_values)
            VALUES (NEW.company_id, NEW.created_by, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        ELSE
            INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_values, new_values)
            VALUES (NEW.company_id, NEW.updated_by, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- For datasets table, use created_by (not uploaded_by)
        IF TG_TABLE_NAME = 'datasets' THEN
            INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_values)
            VALUES (OLD.company_id, OLD.created_by, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        ELSE
            INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_values)
            VALUES (OLD.company_id, OLD.updated_by, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated
SELECT 'Function updated successfully' as status; 