-- =====================================================
-- USER MANAGEMENT & AUTHENTICATION SCHEMA
-- =====================================================

-- Users table (extends existing)
-- Make company_id nullable to allow user creation before company creation
ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- User registration workflow
CREATE TABLE IF NOT EXISTS user_registrations (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    registration_token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ
);

-- Company ownership and admin roles
CREATE TABLE IF NOT EXISTS company_admins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    is_owner BOOLEAN DEFAULT FALSE, -- Only one owner per company
    can_manage_users BOOLEAN DEFAULT TRUE,
    can_manage_divisions BOOLEAN DEFAULT TRUE,
    can_manage_clusters BOOLEAN DEFAULT TRUE,
    can_manage_sop_cycles BOOLEAN DEFAULT TRUE,
    can_view_all_data BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    UNIQUE(user_id, company_id)
);

-- User invitations (for adding users to existing companies)
CREATE TABLE IF NOT EXISTS user_invitations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invited_by INTEGER NOT NULL REFERENCES users(id),
    email TEXT NOT NULL,
    role_type TEXT NOT NULL CHECK (role_type IN ('admin', 'manager', 'analyst', 'viewer')),
    invitation_token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    accepted_by INTEGER REFERENCES users(id)
);

-- User sessions for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Audit trail for user actions
CREATE TABLE IF NOT EXISTS user_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    company_id INTEGER REFERENCES companies(id),
    action_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_registrations_email ON user_registrations(email);
CREATE INDEX IF NOT EXISTS idx_user_registrations_token ON user_registrations(registration_token);
CREATE INDEX IF NOT EXISTS idx_user_registrations_status ON user_registrations(status);

CREATE INDEX IF NOT EXISTS idx_company_admins_user ON company_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_company_admins_company ON company_admins(company_id);
CREATE INDEX IF NOT EXISTS idx_company_admins_owner ON company_admins(is_owner);

-- Ensure only one owner per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_admins_single_owner 
    ON company_admins(company_id) WHERE is_owner = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_invitations_company ON user_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_user_audit_logs_user ON user_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_company ON user_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_created ON user_audit_logs(created_at);

-- Functions for user management
CREATE OR REPLACE FUNCTION create_company_with_owner(
    p_company_name TEXT,
    p_company_description TEXT,
    p_owner_user_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_company_id INTEGER;
BEGIN
    -- Create the company
    INSERT INTO companies (name, description, created_by)
    VALUES (p_company_name, p_company_description, p_owner_user_id)
    RETURNING id INTO v_company_id;
    
    -- Make the user the owner
    INSERT INTO company_admins (user_id, company_id, is_owner, created_by)
    VALUES (p_owner_user_id, v_company_id, TRUE, p_owner_user_id);
    
    -- Update the user's company_id
    UPDATE users SET company_id = v_company_id WHERE id = p_owner_user_id;
    
    RETURN v_company_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can manage a resource
CREATE OR REPLACE FUNCTION can_user_manage_resource(
    p_user_id INTEGER,
    p_company_id INTEGER,
    p_resource_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_can_manage BOOLEAN;
BEGIN
    SELECT 
        CASE p_resource_type
            WHEN 'divisions' THEN can_manage_divisions
            WHEN 'clusters' THEN can_manage_clusters
            WHEN 'sop_cycles' THEN can_manage_sop_cycles
            WHEN 'users' THEN can_manage_users
            ELSE FALSE
        END
    INTO v_can_manage
    FROM company_admins
    WHERE user_id = p_user_id AND company_id = p_company_id;
    
    RETURN COALESCE(v_can_manage, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to get user's company
CREATE OR REPLACE FUNCTION get_user_company(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_company_id INTEGER;
BEGIN
    SELECT company_id INTO v_company_id
    FROM users
    WHERE id = p_user_id;
    
    RETURN v_company_id;
END;
$$ LANGUAGE plpgsql;

-- Triggers for audit logging
CREATE OR REPLACE FUNCTION log_user_action()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_audit_logs (
        user_id, company_id, action_type, resource_type, 
        resource_id, old_values, new_values
    ) VALUES (
        COALESCE(NEW.created_by, OLD.created_by),
        COALESCE(NEW.company_id, OLD.company_id),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to key tables (only if they don't exist)
DO $$
BEGIN
    -- Companies audit trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_companies_changes') THEN
        CREATE TRIGGER audit_companies_changes
            AFTER INSERT OR UPDATE OR DELETE ON companies
            FOR EACH ROW EXECUTE FUNCTION log_user_action();
    END IF;
    
    -- Divisions audit trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_divisions_changes') THEN
        CREATE TRIGGER audit_divisions_changes
            AFTER INSERT OR UPDATE OR DELETE ON divisions
            FOR EACH ROW EXECUTE FUNCTION log_user_action();
    END IF;
    
    -- Clusters audit trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_clusters_changes') THEN
        CREATE TRIGGER audit_clusters_changes
            AFTER INSERT OR UPDATE OR DELETE ON clusters
            FOR EACH ROW EXECUTE FUNCTION log_user_action();
    END IF;
    
    -- S&OP cycles audit trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_sop_cycles_changes') THEN
        CREATE TRIGGER audit_sop_cycles_changes
            AFTER INSERT OR UPDATE OR DELETE ON sop_cycles
            FOR EACH ROW EXECUTE FUNCTION log_user_action();
    END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE user_registrations IS 'Tracks user registration process with email verification';
COMMENT ON TABLE company_admins IS 'Defines company ownership and admin permissions';
COMMENT ON TABLE user_invitations IS 'Tracks invitations to join companies';
COMMENT ON TABLE user_sessions IS 'Manages user authentication sessions';
COMMENT ON TABLE user_audit_logs IS 'Audit trail for all user actions';

COMMENT ON FUNCTION create_company_with_owner IS 'Creates a company and assigns the specified user as owner';
COMMENT ON FUNCTION can_user_manage_resource IS 'Checks if a user has permission to manage a specific resource type';
COMMENT ON FUNCTION get_user_company IS 'Returns the company ID for a given user'; 