-- =====================================================
-- SAFE MIGRATION TO NEW ROLE SYSTEM
-- Handles existing data before changing constraints
-- =====================================================

-- Step 1: Check what role types currently exist
SELECT role_type, COUNT(*) as count 
FROM user_roles 
GROUP BY role_type 
ORDER BY role_type;

-- Step 2: Add the new user_invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    temporary_password_hash TEXT NOT NULL,
    assigned_roles JSONB, -- Array of role assignments
    invitation_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    accepted_at TIMESTAMPTZ,
    accepted_by INTEGER REFERENCES users(id)
);

-- Step 3: Update existing roles to new role system BEFORE changing constraints
-- Convert 'admin' to 'company_admin'
UPDATE user_roles SET role_type = 'company_admin' WHERE role_type = 'admin';

-- Convert 'manager' to 'division_admin' (managers become division admins)
UPDATE user_roles SET role_type = 'division_admin' WHERE role_type = 'manager';

-- Convert 'owner' to 'company_admin' (owners become company admins)
UPDATE user_roles SET role_type = 'company_admin' WHERE role_type = 'owner';

-- Keep 'analyst' and 'viewer' as they are (no changes needed)

-- Step 4: Verify all role types are now valid
SELECT role_type, COUNT(*) as count 
FROM user_roles 
GROUP BY role_type 
ORDER BY role_type;

-- Step 5: Now safely update the constraint
-- First drop the old constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_type_check;

-- Add the new constraint with the updated role types
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_type_check 
    CHECK (role_type IN ('company_admin', 'division_admin', 'cluster_admin', 'analyst', 'viewer'));

-- Step 6: Update test users with specific role assignments
-- ACME Corporation users
UPDATE user_roles SET role_type = 'company_admin' 
WHERE user_id = (SELECT id FROM users WHERE username = 'acme_owner');

UPDATE user_roles SET role_type = 'company_admin' 
WHERE user_id = (SELECT id FROM users WHERE username = 'acme_admin');

UPDATE user_roles SET role_type = 'division_admin' 
WHERE user_id = (SELECT id FROM users WHERE username = 'acme_manager');

UPDATE user_roles SET role_type = 'analyst' 
WHERE user_id = (SELECT id FROM users WHERE username = 'acme_analyst');

UPDATE user_roles SET role_type = 'viewer' 
WHERE user_id = (SELECT id FROM users WHERE username = 'acme_viewer');

-- TechStart Inc users
UPDATE user_roles SET role_type = 'company_admin' 
WHERE user_id = (SELECT id FROM users WHERE username = 'techstart_admin');

UPDATE user_roles SET role_type = 'analyst' 
WHERE user_id = (SELECT id FROM users WHERE username = 'techstart_analyst');

-- Global Manufacturing users
UPDATE user_roles SET role_type = 'company_admin' 
WHERE user_id = (SELECT id FROM users WHERE username = 'global_admin');

UPDATE user_roles SET role_type = 'viewer' 
WHERE user_id = (SELECT id FROM users WHERE username = 'global_viewer');

-- Update any admin user
UPDATE user_roles SET role_type = 'company_admin' 
WHERE user_id = (SELECT id FROM users WHERE username = 'admin');

-- Step 7: Final verification
SELECT 
    u.username,
    u.email,
    ur.role_type,
    ur.division_id,
    ur.cluster_id,
    c.name as company_name
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN companies c ON u.company_id = c.id
WHERE u.username IN (
    'acme_owner', 'acme_admin', 'acme_manager', 'acme_analyst', 'acme_viewer',
    'techstart_admin', 'techstart_analyst', 'global_admin', 'global_viewer'
) OR u.username = 'admin'
ORDER BY c.name, ur.role_type, u.username;

-- Step 8: Show the new role hierarchy
SELECT 
    'company_admin' as role_type,
    'Full system access, can invite users, manage all divisions/clusters' as description
UNION ALL
SELECT 
    'division_admin',
    'Division-level admin, can assign users to their divisions'
UNION ALL
SELECT 
    'cluster_admin',
    'Cluster-level admin, starts at CSV import'
UNION ALL
SELECT 
    'analyst',
    'Data cleaning and analysis only'
UNION ALL
SELECT 
    'viewer',
    'Read-only access'; 