-- =====================================================
-- Check Current Database State
-- Run this in DBeaver to see what's in your database
-- =====================================================

-- Check if we're connected to the right database
SELECT current_database() as current_db, current_user as current_user;

-- Check existing tables
SELECT 
    table_name, 
    table_type,
    table_schema
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check if S&OP tables already exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('sop_cycle_configs', 'sop_cycles', 'sop_cycle_permissions', 'sop_cycle_audit_log') 
        THEN 'S&OP TABLE EXISTS'
        ELSE 'Other table'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN ('sop_cycle_configs', 'sop_cycles', 'sop_cycle_permissions', 'sop_cycle_audit_log')
ORDER BY table_name;

-- Check table structures for existing S&OP tables
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name IN ('sop_cycle_configs', 'sop_cycles', 'sop_cycle_permissions', 'sop_cycle_audit_log')
ORDER BY table_name, ordinal_position;

-- Check if referenced tables exist (companies, divisions, users)
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('companies', 'divisions', 'users') 
        THEN 'REFERENCED TABLE EXISTS'
        ELSE 'Other table'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN ('companies', 'divisions', 'users')
ORDER BY table_name;

-- Check foreign key relationships
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('sop_cycle_configs', 'sop_cycles', 'sop_cycle_permissions', 'sop_cycle_audit_log')
ORDER BY tc.table_name, kcu.column_name;

-- Check existing functions
SELECT 
    routine_name, 
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name LIKE '%sop%'
ORDER BY routine_name;

-- Check existing indexes
SELECT 
    indexname, 
    tablename,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('sop_cycle_configs', 'sop_cycles', 'sop_cycle_permissions', 'sop_cycle_audit_log')
ORDER BY tablename, indexname; 
 
 
 
 
 
 
 
 
 