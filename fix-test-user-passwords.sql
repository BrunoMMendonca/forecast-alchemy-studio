-- =====================================================
-- FIX TEST USER PASSWORDS
-- Update all test users to use the correct bcrypt hash
-- Generated with saltRounds = 12 (same as registration function)
-- =====================================================

-- Update all test users to use the correct hash for 'password123'
-- This hash was generated with bcrypt.hash('password123', 12)
UPDATE users 
SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/5H5KQ8O'
WHERE username IN (
    'acme_owner',
    'acme_admin', 
    'acme_manager',
    'acme_analyst',
    'acme_viewer',
    'techstart_admin',
    'techstart_analyst',
    'global_admin',
    'global_viewer'
);

-- Also update any admin user that might have been created manually
UPDATE users 
SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/5H5KQ8O'
WHERE username = 'admin' OR email = 'admin@company.com';

-- Verify the updates
SELECT 
    username,
    email,
    password_hash,
    LENGTH(password_hash) as hash_length
FROM users 
WHERE username IN (
    'acme_owner',
    'acme_admin', 
    'acme_manager',
    'acme_analyst',
    'acme_viewer',
    'techstart_admin',
    'techstart_analyst',
    'global_admin',
    'global_viewer',
    'admin'
)
ORDER BY username; 