-- Check the current state of the datasets table and audit trigger
-- Run this in DBeaver to see what's happening

-- 1. Check all columns in datasets table
SELECT column_name, data_type, is_nullable, ordinal_position
FROM information_schema.columns 
WHERE table_name = 'datasets' 
ORDER BY ordinal_position;

-- 2. Check specifically for uploaded_by or created_by columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'datasets' 
AND column_name IN ('uploaded_by', 'created_by')
ORDER BY column_name;

-- 3. Check the current audit trigger function
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'audit_table_changes';

-- 4. Check what triggers exist on the datasets table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'datasets'; 