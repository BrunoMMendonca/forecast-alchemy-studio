-- =====================================================
-- CHECK AND FIX ADMIN USER PASSWORD HASH
-- =====================================================

-- First, let's see what admin users exist and their current hashes
SELECT 
    id,
    username,
    email,
    password_hash,
    LENGTH(password_hash) as hash_length,
    created_at
FROM users 
WHERE username LIKE '%admin%' OR email LIKE '%admin%'
ORDER BY created_at;

-- Update any admin user with the correct hash for 'password123'
-- This ensures consistency with the registration function
UPDATE users 
SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/5H5KQ8O'
WHERE (username LIKE '%admin%' OR email LIKE '%admin%')
AND password_hash != '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/5H5KQ8O';

-- Show the updated results
SELECT 
    id,
    username,
    email,
    password_hash,
    LENGTH(password_hash) as hash_length,
    created_at
FROM users 
WHERE username LIKE '%admin%' OR email LIKE '%admin%'
ORDER BY created_at; 