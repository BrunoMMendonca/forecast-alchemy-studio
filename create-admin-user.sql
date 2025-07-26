-- Create Admin User for Testing
-- Run this in DBeaver after resetting the database

-- First, create the admin user through the normal registration process
-- Then run this to give them special privileges

-- Create admin user (you'll need to register them first via the app)
-- This script assumes you've already registered an admin user

-- Example: Register admin@admin.com via the app, then run this:

-- Update the user's name
UPDATE users 
SET first_name = 'System',
    last_name = 'Administrator'
WHERE email = 'admin@admin.com';

-- Create a test company for the admin (only if it doesn't exist)
INSERT INTO companies (
    name, 
    description, 
    country,
    company_size,
    is_active,
    created_by, 
    created_at
) VALUES (
    'System Administration',
    'System administration company for testing',
    'United States',
    'enterprise',
    true,
    (SELECT id FROM users WHERE email = 'admin@admin.com'),
    NOW()
) ON CONFLICT (name) DO NOTHING;

-- Link the admin user to the company
UPDATE users 
SET company_id = (SELECT id FROM companies WHERE name = 'System Administration')
WHERE email = 'admin@admin.com';

-- Create admin role for the user in the user_roles table (only if it doesn't exist)
INSERT INTO user_roles (
    user_id,
    company_id,
    role_type,
    is_active,
    created_by
) VALUES (
    (SELECT id FROM users WHERE email = 'admin@admin.com'),
    (SELECT id FROM companies WHERE name = 'System Administration'),
    'admin',
    true,
    (SELECT id FROM users WHERE email = 'admin@admin.com')
) ON CONFLICT (user_id, company_id, division_id, cluster_id) DO NOTHING;

-- Show the admin user
SELECT 
    u.id,
    u.email,
    u.username,
    u.first_name,
    u.last_name,
    c.name as company_name,
    c.country,
    c.company_size,
    ur.role_type,
    ur.is_active as role_active
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN user_roles ur ON u.id = ur.user_id AND c.id = ur.company_id
WHERE u.email = 'admin@admin.com'; 