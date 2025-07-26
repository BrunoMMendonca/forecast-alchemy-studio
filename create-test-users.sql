-- =====================================================
-- CREATE TEST USERS FOR ALL ROLES
-- =====================================================

-- First, let's create a few test companies
INSERT INTO companies (name, description, country, company_size, timezone, currency) VALUES
('Acme Corporation', 'Test company for role testing', 'US', 'medium', 'UTC', 'USD'),
('TechStart Inc', 'Startup company for testing', 'CA', 'startup', 'UTC', 'CAD'),
('Global Manufacturing', 'Large enterprise for testing', 'MX', 'enterprise', 'UTC', 'MXN')
ON CONFLICT (name) DO NOTHING;

-- Get company IDs
DO $$
DECLARE
    acme_id INTEGER;
    techstart_id INTEGER;
    global_id INTEGER;
BEGIN
    SELECT id INTO acme_id FROM companies WHERE name = 'Acme Corporation';
    SELECT id INTO techstart_id FROM companies WHERE name = 'TechStart Inc';
    SELECT id INTO global_id FROM companies WHERE name = 'Global Manufacturing';
    
    -- Create test users for Acme Corporation
    INSERT INTO users (company_id, username, email, password_hash, first_name, last_name) VALUES
    (acme_id, 'acme_owner', 'owner@acme.com', '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO', 'John', 'Owner'),
    (acme_id, 'acme_admin', 'admin@acme.com', '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO', 'Sarah', 'Admin'),
    (acme_id, 'acme_manager', 'manager@acme.com', '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO', 'Mike', 'Manager'),
    (acme_id, 'acme_analyst', 'analyst@acme.com', '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO', 'Lisa', 'Analyst'),
    (acme_id, 'acme_viewer', 'viewer@acme.com', '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO', 'Tom', 'Viewer')
    ON CONFLICT (username) DO NOTHING;
    
    -- Create test users for TechStart Inc
    INSERT INTO users (company_id, username, email, password_hash, first_name, last_name) VALUES
    (techstart_id, 'techstart_admin', 'admin@techstart.com', '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO', 'Emma', 'TechAdmin'),
    (techstart_id, 'techstart_analyst', 'analyst@techstart.com', '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO', 'Alex', 'TechAnalyst')
    ON CONFLICT (username) DO NOTHING;
    
    -- Create test users for Global Manufacturing
    INSERT INTO users (company_id, username, email, password_hash, first_name, last_name) VALUES
    (global_id, 'global_admin', 'admin@global.com', '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO', 'Maria', 'GlobalAdmin'),
    (global_id, 'global_viewer', 'viewer@global.com', '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO', 'Carlos', 'GlobalViewer')
    ON CONFLICT (username) DO NOTHING;
    
    -- Assign roles to Acme Corporation users
    INSERT INTO user_roles (user_id, company_id, role_type) VALUES
    ((SELECT id FROM users WHERE username = 'acme_owner'), acme_id, 'admin'),
    ((SELECT id FROM users WHERE username = 'acme_admin'), acme_id, 'admin'),
    ((SELECT id FROM users WHERE username = 'acme_manager'), acme_id, 'manager'),
    ((SELECT id FROM users WHERE username = 'acme_analyst'), acme_id, 'analyst'),
    ((SELECT id FROM users WHERE username = 'acme_viewer'), acme_id, 'viewer')
    ON CONFLICT (user_id, company_id, division_id, cluster_id) DO NOTHING;
    
    -- Assign roles to TechStart Inc users
    INSERT INTO user_roles (user_id, company_id, role_type) VALUES
    ((SELECT id FROM users WHERE username = 'techstart_admin'), techstart_id, 'admin'),
    ((SELECT id FROM users WHERE username = 'techstart_analyst'), techstart_id, 'analyst')
    ON CONFLICT (user_id, company_id, division_id, cluster_id) DO NOTHING;
    
    -- Assign roles to Global Manufacturing users
    INSERT INTO user_roles (user_id, company_id, role_type) VALUES
    ((SELECT id FROM users WHERE username = 'global_admin'), global_id, 'admin'),
    ((SELECT id FROM users WHERE username = 'global_viewer'), global_id, 'viewer')
    ON CONFLICT (user_id, company_id, division_id, cluster_id) DO NOTHING;
    
END $$;

-- =====================================================
-- TEST USER CREDENTIALS
-- =====================================================

/*
ACME CORPORATION USERS:
- Owner: acme_owner / password123
- Admin: acme_admin / password123  
- Manager: acme_manager / password123
- Analyst: acme_analyst / password123
- Viewer: acme_viewer / password123

TECHSTART INC USERS:
- Admin: techstart_admin / password123
- Analyst: techstart_analyst / password123

GLOBAL MANUFACTURING USERS:
- Admin: global_admin / password123
- Viewer: global_viewer / password123

All users have password: password123
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all users and their roles
SELECT 
    c.name as company,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    ur.role_type
FROM users u
JOIN companies c ON u.company_id = c.id
JOIN user_roles ur ON u.id = ur.user_id
ORDER BY c.name, ur.role_type, u.username;

-- Count users by company and role
SELECT 
    c.name as company,
    ur.role_type,
    COUNT(*) as user_count
FROM users u
JOIN companies c ON u.company_id = c.id
JOIN user_roles ur ON u.id = ur.user_id
GROUP BY c.name, ur.role_type
ORDER BY c.name, ur.role_type; 