-- Database Reset Script for Multi-Tenant System
-- This script safely removes test data while preserving schema and production data
-- DBeaver compatible

-- Start transaction for safety
BEGIN;

-- Log the reset operation
DO $$
BEGIN
    RAISE NOTICE 'Starting database reset - removing test data...';
END $$;

-- 1. Remove test users (users with test emails or timestamps)
-- First, identify test users
WITH test_users AS (
    SELECT id FROM users 
    WHERE email LIKE '%test%' 
    OR email LIKE '%example.com%' 
    OR email LIKE '%@example%'
    OR username LIKE '%test%'
    OR username LIKE '%user%'
    OR username LIKE '%owner%'
    OR username LIKE '%admin%'
    OR username LIKE '%manager%'
    OR username LIKE '%analyst%'
    OR username LIKE '%viewer%'
    OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma')
)
-- Remove audit logs for test users
DELETE FROM user_audit_logs 
WHERE user_id IN (SELECT id FROM test_users);

-- Note: We'll delete users later after removing all child records

-- 2. Remove test companies (companies with test names or timestamps)
DELETE FROM user_audit_logs 
WHERE company_id IN (
    SELECT id FROM companies 
    WHERE name LIKE '%Test%' 
    OR name LIKE '%Corp%' 
    OR name LIKE '%Inc%'
    OR name LIKE '%Acme%'
    OR name LIKE '%TechStart%'
    OR name LIKE '%Owner Corp%'
    OR name LIKE '%Admin Corp%'
    OR name LIKE '%Manager Corp%'
    OR name LIKE '%Analyst Corp%'
    OR name LIKE '%Viewer Corp%'
    OR description LIKE '%test%'
    OR description LIKE '%Test%'
);

DELETE FROM companies 
WHERE name LIKE '%Test%' 
OR name LIKE '%Corp%' 
OR name LIKE '%Inc%'
OR name LIKE '%Acme%'
OR name LIKE '%TechStart%'
OR name LIKE '%Owner Corp%'
OR name LIKE '%Admin Corp%'
OR name LIKE '%Manager Corp%'
OR name LIKE '%Analyst Corp%'
OR name LIKE '%Viewer Corp%'
OR description LIKE '%test%'
OR description LIKE '%Test%';

-- 3. Remove test divisions (divisions with test names)
DELETE FROM user_audit_logs 
WHERE resource_type = 'divisions' 
AND resource_id IN (
    SELECT id FROM divisions 
    WHERE name LIKE '%Consumer Products%'
    OR name LIKE '%Industrial Solutions%'
    OR name LIKE '%Digital Services%'
    OR name LIKE '%Operations Division%'
    OR name LIKE '%Main Division%'
    OR description LIKE '%test%'
    OR description LIKE '%Test%'
);

DELETE FROM divisions 
WHERE name LIKE '%Consumer Products%'
OR name LIKE '%Industrial Solutions%'
OR name LIKE '%Digital Services%'
OR name LIKE '%Operations Division%'
OR name LIKE '%Main Division%'
OR description LIKE '%test%'
OR description LIKE '%Test%';

-- 4. Remove test clusters (clusters with test names)
DELETE FROM user_audit_logs 
WHERE resource_type = 'clusters' 
AND resource_id IN (
    SELECT id FROM clusters 
    WHERE name LIKE '%Global Operations%'
    OR name LIKE '%Test%'
    OR description LIKE '%test%'
    OR description LIKE '%Test%'
);

DELETE FROM clusters 
WHERE name LIKE '%Global Operations%'
OR name LIKE '%Test%'
OR description LIKE '%test%'
OR description LIKE '%Test%';

-- 5. Remove test S&OP cycles (cycles with test names or created by test users)
DELETE FROM user_audit_logs 
WHERE resource_type = 'sop_cycles' 
AND resource_id IN (
    SELECT id FROM sop_cycles 
    WHERE name LIKE '%Test%'
    OR description LIKE '%test%'
    OR description LIKE '%Test%'
    OR created_by IN (
        SELECT id FROM users 
        WHERE email LIKE '%test%' 
        OR email LIKE '%example.com%' 
        OR email LIKE '%@example%'
        OR username LIKE '%test%'
        OR username LIKE '%user%'
        OR username LIKE '%owner%'
        OR username LIKE '%admin%'
        OR username LIKE '%manager%'
        OR username LIKE '%analyst%'
        OR username LIKE '%viewer%'
        OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma')
    )
);

DELETE FROM sop_cycles 
WHERE name LIKE '%Test%'
OR description LIKE '%test%'
OR description LIKE '%Test%'
OR created_by IN (
    SELECT id FROM users 
    WHERE email LIKE '%test%' 
    OR email LIKE '%example.com%' 
    OR email LIKE '%@example%'
    OR username LIKE '%test%'
    OR username LIKE '%user%'
    OR username LIKE '%owner%'
    OR username LIKE '%admin%'
    OR username LIKE '%manager%'
    OR username LIKE '%analyst%'
    OR username LIKE '%viewer%'
    OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma')
);

-- 6. Remove test datasets (datasets with test names)
DELETE FROM user_audit_logs 
WHERE resource_type = 'datasets' 
AND resource_id IN (
    SELECT id FROM datasets 
    WHERE name LIKE '%Test%'
    OR description LIKE '%test%'
    OR description LIKE '%Test%'
);

DELETE FROM datasets 
WHERE name LIKE '%Test%'
OR description LIKE '%test%'
OR description LIKE '%Test%';

-- 7. Remove test optimization jobs and results
DELETE FROM optimization_results 
WHERE job_id IN (
    SELECT id FROM optimization_jobs 
    WHERE description LIKE '%test%'
    OR description LIKE '%Test%'
    OR created_by IN (
        SELECT id FROM users 
        WHERE email LIKE '%test%' 
        OR email LIKE '%example.com%'
    )
);

DELETE FROM optimization_jobs 
WHERE description LIKE '%test%'
OR description LIKE '%Test%'
OR created_by IN (
    SELECT id FROM users 
    WHERE email LIKE '%test%' 
    OR email LIKE '%example.com%'
);

-- 8. Remove test SKUs
DELETE FROM skus 
WHERE name LIKE '%Test%'
OR description LIKE '%test%'
OR description LIKE '%Test%'
OR created_by IN (
    SELECT id FROM users 
    WHERE email LIKE '%test%' 
    OR email LIKE '%example.com%'
);

-- 9. Clean up orphaned audit logs (remove entries that reference deleted records)
DELETE FROM user_audit_logs 
WHERE user_id NOT IN (SELECT id FROM users)
OR company_id NOT IN (SELECT id FROM companies)
OR (resource_type = 'divisions' AND resource_id NOT IN (SELECT id FROM divisions))
OR (resource_type = 'clusters' AND resource_id NOT IN (SELECT id FROM clusters))
OR (resource_type = 'sop_cycles' AND resource_id NOT IN (SELECT id FROM sop_cycles))
OR (resource_type = 'datasets' AND resource_id NOT IN (SELECT id FROM datasets));

-- 10. Now remove test users (after all child records are deleted)
DELETE FROM users 
WHERE email LIKE '%test%' 
OR email LIKE '%example.com%' 
OR email LIKE '%@example%'
OR username LIKE '%test%'
OR username LIKE '%user%'
OR username LIKE '%owner%'
OR username LIKE '%admin%'
OR username LIKE '%manager%'
OR username LIKE '%analyst%'
OR username LIKE '%viewer%'
OR first_name IN ('John', 'Jane', 'Bob', 'Sarah', 'Mike', 'Lisa', 'David', 'Emma');

-- 11. Reset sequences if needed (optional - uncomment if you want to reset IDs)
-- ALTER SEQUENCE users_id_seq RESTART WITH 1;
-- ALTER SEQUENCE companies_id_seq RESTART WITH 1;
-- ALTER SEQUENCE divisions_id_seq RESTART WITH 1;
-- ALTER SEQUENCE clusters_id_seq RESTART WITH 1;
-- ALTER SEQUENCE sop_cycles_id_seq RESTART WITH 1;

-- Log completion
DO $$
DECLARE
    user_count INTEGER;
    company_count INTEGER;
    division_count INTEGER;
    cluster_count INTEGER;
    sop_count INTEGER;
    dataset_count INTEGER;
    job_count INTEGER;
    audit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO company_count FROM companies;
    SELECT COUNT(*) INTO division_count FROM divisions;
    SELECT COUNT(*) INTO cluster_count FROM clusters;
    SELECT COUNT(*) INTO sop_count FROM sop_cycles;
    SELECT COUNT(*) INTO dataset_count FROM datasets;
    SELECT COUNT(*) INTO job_count FROM optimization_jobs;
    SELECT COUNT(*) INTO audit_count FROM user_audit_logs;
    
    RAISE NOTICE 'Database reset completed successfully!';
    RAISE NOTICE 'Remaining records:';
    RAISE NOTICE '  Users: %', user_count;
    RAISE NOTICE '  Companies: %', company_count;
    RAISE NOTICE '  Divisions: %', division_count;
    RAISE NOTICE '  Clusters: %', cluster_count;
    RAISE NOTICE '  S&OP Cycles: %', sop_count;
    RAISE NOTICE '  Datasets: %', dataset_count;
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
    (SELECT COUNT(*) FROM datasets) as datasets,
    (SELECT COUNT(*) FROM optimization_jobs) as optimization_jobs; 