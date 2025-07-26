-- Simple Database Reset Script for Multi-Tenant System
-- This script safely removes test data while preserving schema and production data
-- DBeaver compatible

-- Start transaction for safety
BEGIN;

-- Log the reset operation
DO $$
BEGIN
    RAISE NOTICE 'Starting database reset - removing test data...';
END $$;

-- Step 1: Remove all S&OP cycles created by test users (this is the main issue)
DELETE FROM user_audit_logs 
WHERE resource_type = 'sop_cycles' 
AND resource_id IN (
    SELECT id FROM sop_cycles 
    WHERE created_by IN (
        SELECT id FROM users 
        WHERE email LIKE '%example.com%' 
        OR email LIKE '%test%'
        OR username LIKE '%test%'
        OR username LIKE '%user%'
        OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma')
    )
);

DELETE FROM sop_cycles 
WHERE created_by IN (
    SELECT id FROM users 
    WHERE email LIKE '%example.com%' 
    OR email LIKE '%test%'
    OR username LIKE '%test%'
    OR username LIKE '%user%'
    OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma')
);

-- Step 2: Remove optimization results and jobs created by test users
DELETE FROM optimization_results 
WHERE job_id IN (
    SELECT id FROM optimization_jobs 
    WHERE created_by IN (
        SELECT id FROM users 
        WHERE email LIKE '%example.com%' 
        OR email LIKE '%test%'
        OR username LIKE '%test%'
        OR username LIKE '%user%'
        OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma')
    )
);

DELETE FROM optimization_jobs 
WHERE created_by IN (
    SELECT id FROM users 
    WHERE email LIKE '%example.com%' 
    OR email LIKE '%test%'
    OR username LIKE '%test%'
    OR username LIKE '%user%'
    OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma')
);

-- Step 3: Remove SKUs created by test users
DELETE FROM skus 
WHERE created_by IN (
    SELECT id FROM users 
    WHERE email LIKE '%example.com%' 
    OR email LIKE '%test%'
    OR username LIKE '%test%'
    OR username LIKE '%user%'
    OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma')
);

-- Step 4: Remove test companies and their related data
DELETE FROM user_audit_logs 
WHERE company_id IN (
    SELECT id FROM companies 
    WHERE name LIKE '%Corp%' 
    OR name LIKE '%Inc%'
    OR name LIKE '%Acme%'
    OR name LIKE '%TechStart%'
    OR description LIKE '%test%'
);

DELETE FROM divisions 
WHERE company_id IN (
    SELECT id FROM companies 
    WHERE name LIKE '%Corp%' 
    OR name LIKE '%Inc%'
    OR name LIKE '%Acme%'
    OR name LIKE '%TechStart%'
    OR description LIKE '%test%'
);

DELETE FROM clusters 
WHERE division_id IN (
    SELECT id FROM divisions 
    WHERE company_id IN (
        SELECT id FROM companies 
        WHERE name LIKE '%Corp%' 
        OR name LIKE '%Inc%'
        OR name LIKE '%Acme%'
        OR name LIKE '%TechStart%'
        OR description LIKE '%test%'
    )
);

DELETE FROM companies 
WHERE name LIKE '%Corp%' 
OR name LIKE '%Inc%'
OR name LIKE '%Acme%'
OR name LIKE '%TechStart%'
OR description LIKE '%test%';

-- Step 5: Remove audit logs for test users
DELETE FROM user_audit_logs 
WHERE user_id IN (
    SELECT id FROM users 
    WHERE email LIKE '%example.com%' 
    OR email LIKE '%test%'
    OR username LIKE '%test%'
    OR username LIKE '%user%'
    OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma')
);

-- Step 6: Finally remove test users (now safe to delete)
DELETE FROM users 
WHERE email LIKE '%example.com%' 
OR email LIKE '%test%'
OR username LIKE '%test%'
OR username LIKE '%user%'
OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma');

-- Step 7: Clean up any remaining orphaned audit logs
DELETE FROM user_audit_logs 
WHERE user_id NOT IN (SELECT id FROM users)
OR company_id NOT IN (SELECT id FROM companies)
OR (resource_type = 'divisions' AND resource_id NOT IN (SELECT id FROM divisions))
OR (resource_type = 'clusters' AND resource_id NOT IN (SELECT id FROM clusters))
OR (resource_type = 'sop_cycles' AND resource_id NOT IN (SELECT id FROM sop_cycles));

-- Log completion
DO $$
DECLARE
    user_count INTEGER;
    company_count INTEGER;
    division_count INTEGER;
    cluster_count INTEGER;
    sop_count INTEGER;
    job_count INTEGER;
    audit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO company_count FROM companies;
    SELECT COUNT(*) INTO division_count FROM divisions;
    SELECT COUNT(*) INTO cluster_count FROM clusters;
    SELECT COUNT(*) INTO sop_count FROM sop_cycles;
    SELECT COUNT(*) INTO job_count FROM optimization_jobs;
    SELECT COUNT(*) INTO audit_count FROM user_audit_logs;
    
    RAISE NOTICE 'Database reset completed successfully!';
    RAISE NOTICE 'Remaining records:';
    RAISE NOTICE '  Users: %', user_count;
    RAISE NOTICE '  Companies: %', company_count;
    RAISE NOTICE '  Divisions: %', division_count;
    RAISE NOTICE '  Clusters: %', cluster_count;
    RAISE NOTICE '  S&OP Cycles: %', sop_count;
    RAISE NOTICE '  Optimization Jobs: %', job_count;
    RAISE NOTICE '  Audit Logs: %', audit_count;
END $$;

-- Commit the transaction
COMMIT;

-- Show final status
SELECT 
    'Database Reset Complete' as status,
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM companies) as companies,
    (SELECT COUNT(*) FROM divisions) as divisions,
    (SELECT COUNT(*) FROM clusters) as clusters,
    (SELECT COUNT(*) FROM sop_cycles) as sop_cycles,
    (SELECT COUNT(*) FROM optimization_jobs) as optimization_jobs; 