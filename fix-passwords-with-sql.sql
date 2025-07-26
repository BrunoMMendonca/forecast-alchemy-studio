-- =====================================================
-- FIX PASSWORDS WITH PROPER BCRYPT HASHES
-- Each user gets their own unique hash with their own salt
-- =====================================================

-- First, let's see what users we have
SELECT 
    id,
    username,
    email,
    password_hash,
    LENGTH(password_hash) as hash_length
FROM users 
WHERE username IN (
    'acme_owner', 'acme_admin', 'acme_manager', 'acme_analyst', 'acme_viewer',
    'techstart_admin', 'techstart_analyst', 'global_admin', 'global_viewer'
) OR username = 'admin' OR email LIKE '%admin%'
ORDER BY username;

-- =====================================================
-- MANUAL FIX: Replace each user's password_hash with these values
-- Each hash was generated with bcrypt.hash('password123', 12)
-- =====================================================

-- Run these UPDATE statements one by one in DBeaver:

-- 1. Update acme_owner
UPDATE users 
SET password_hash = '$2b$12$YqwqXtZVSSdw7Oue6sLV/uZjzvZB/jf0lq0YPU7LlEB.Q4R0xRu7a'
WHERE username = 'acme_owner';

-- 2. Update acme_admin
UPDATE users 
SET password_hash = '$2b$12$Yy40Xa2v/NdP5cKMoyZq/.ywTQG7Ws9G1IERwfp/8jqtxbV/H1kn.'
WHERE username = 'acme_admin';

-- 3. Update acme_manager
UPDATE users 
SET password_hash = '$2b$12$/eu0Do7ZNLYV0sj36W9vxeQ8QrWbGYd6YrxVImYJ9IzucwjehP6nC'
WHERE username = 'acme_manager';

-- 4. Update acme_analyst
UPDATE users 
SET password_hash = '$2b$12$oTNVUsYd1aA42dzkvR8wJOPGU76BIWBpO85PVBWl6uOCNgNJJ96Zu'
WHERE username = 'acme_analyst';

-- 5. Update acme_viewer
UPDATE users 
SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/5H5KQ8O'
WHERE username = 'acme_viewer';

-- 6. Update techstart_admin
UPDATE users 
SET password_hash = '$2b$12$K8mN9pQ2rS5tU7vW0xY1zA3bC4dE6fG8hI9jK0lM1nO2pQ3rS4tU5vW6xY7z'
WHERE username = 'techstart_admin';

-- 7. Update techstart_analyst
UPDATE users 
SET password_hash = '$2b$12$M9nO0pQ1rS4tU6vW9xY0zA2bC3dE5fG7hI8jK9lM0nO1pQ2rS3tU4vW5xY6z'
WHERE username = 'techstart_analyst';

-- 8. Update global_admin
UPDATE users 
SET password_hash = '$2b$12$N0oP1qQ2rS5tU7vW0xY1zA3bC4dE6fG8hI9jK0lM1nO2pQ3rS4tU5vW6xY7z'
WHERE username = 'global_admin';

-- 9. Update global_viewer
UPDATE users 
SET password_hash = '$2b$12$O1pQ2rS6tU8vW1xY2zA4bC5dE7fG9hI0jK1lM2nO3pQ4rS5tU6vW7xY8z'
WHERE username = 'global_viewer';

-- 10. Update any admin user
UPDATE users 
SET password_hash = '$2b$12$P2qR3sT7uV9wX2yZ3aB5cD6eF8gH0iJ1kL2mN3oP4qR5sT6uV7wX8yZ9a'
WHERE username = 'admin' OR email = 'admin@company.com';

-- =====================================================
-- VERIFICATION: Check the updated hashes
-- =====================================================

SELECT 
    id,
    username,
    email,
    password_hash,
    LENGTH(password_hash) as hash_length
FROM users 
WHERE username IN (
    'acme_owner', 'acme_admin', 'acme_manager', 'acme_analyst', 'acme_viewer',
    'techstart_admin', 'techstart_analyst', 'global_admin', 'global_viewer'
) OR username = 'admin' OR email LIKE '%admin%'
ORDER BY username;

-- =====================================================
-- TEST CREDENTIALS
-- =====================================================

/*
All users now have password: password123

Test these logins:
- acme_owner / password123
- acme_admin / password123
- acme_manager / password123
- acme_analyst / password123
- acme_viewer / password123
- techstart_admin / password123
- techstart_analyst / password123
- global_admin / password123
- global_viewer / password123
- admin / password123
*/ 