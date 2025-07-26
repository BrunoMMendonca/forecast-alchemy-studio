-- Quick Database Reset - Handle Foreign Key Constraints
-- Run this in DBeaver

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- Remove all test data
DELETE FROM user_audit_logs;
DELETE FROM optimization_results;
DELETE FROM optimization_jobs;
DELETE FROM skus;
DELETE FROM clusters;
DELETE FROM divisions;
DELETE FROM sop_cycles;
DELETE FROM datasets;
DELETE FROM companies;
DELETE FROM users;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Show results
SELECT 
    'Reset Complete' as status,
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM companies) as companies,
    (SELECT COUNT(*) FROM divisions) as divisions,
    (SELECT COUNT(*) FROM clusters) as clusters,
    (SELECT COUNT(*) FROM sop_cycles) as sop_cycles,
    (SELECT COUNT(*) FROM optimization_jobs) as optimization_jobs; 