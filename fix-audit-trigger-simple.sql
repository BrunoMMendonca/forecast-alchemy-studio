-- Simple fix: Remove audit trigger from datasets table
-- This avoids the created_by/uploaded_by issue entirely

-- Drop the audit trigger from datasets table
DROP TRIGGER IF EXISTS audit_datasets_changes ON datasets;

-- Verify the trigger was removed
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'datasets' AND trigger_name = 'audit_datasets_changes'; 