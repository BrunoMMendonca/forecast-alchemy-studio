import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import crypto from 'crypto';

const pgPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Authentication middleware
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if session is still valid
    const sessionResult = await pgPool.query(
      'SELECT * FROM user_sessions WHERE session_token = $1 AND is_active = TRUE AND expires_at > NOW()',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    // Get user details
    const userResult = await pgPool.query(
      'SELECT id, username, email, first_name, last_name, company_id, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Authorization middleware for role-based access control
export const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;

      if (!companyId) {
        return res.status(403).json({ error: 'User not associated with any company' });
      }

      // Get user's roles for this company
      const result = await pgPool.query(
        'SELECT role_type, division_id, cluster_id FROM user_roles WHERE user_id = $1 AND company_id = $2 AND is_active = true',
        [userId, companyId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'User not authorized for this company' });
      }

      // Check if user has any of the allowed roles
      const userRoles = result.rows.map(row => row.role_type);
      const hasPermission = userRoles.some(role => allowedRoles.includes(role));

      if (!hasPermission) {
        return res.status(403).json({ 
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your roles: ${userRoles.join(', ')}` 
        });
      }

      // Store user's role context for use in other middleware
      req.userRoles = result.rows;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

// Convenience middleware for specific roles
export const requireCompanyAdmin = () => requireRole(['company_admin']);
export const requireDivisionAdmin = () => requireRole(['company_admin', 'division_admin']);
export const requireClusterAdmin = () => requireRole(['company_admin', 'division_admin', 'cluster_admin']);
export const requireAnalyst = () => requireRole(['company_admin', 'division_admin', 'cluster_admin', 'analyst']);
export const requireViewer = () => requireRole(['company_admin', 'division_admin', 'cluster_admin', 'analyst', 'viewer']);

// Division-specific authorization
export const requireDivisionAccess = (divisionId) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;

      // Company admins have access to all divisions
      const companyAdminCheck = await pgPool.query(
        'SELECT 1 FROM user_roles WHERE user_id = $1 AND company_id = $2 AND role_type = $3 AND is_active = true',
        [userId, companyId, 'company_admin']
      );

      if (companyAdminCheck.rows.length > 0) {
        return next();
      }

      // Check if user has access to the specific division
      const result = await pgPool.query(
        'SELECT 1 FROM user_roles WHERE user_id = $1 AND company_id = $2 AND division_id = $3 AND is_active = true',
        [userId, companyId, divisionId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to this division' });
      }

      next();
    } catch (error) {
      console.error('Division access check error:', error);
      return res.status(500).json({ error: 'Division access check failed' });
    }
  };
};

// Cluster-specific authorization
export const requireClusterAccess = (clusterId) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;

      // Company admins have access to all clusters
      const companyAdminCheck = await pgPool.query(
        'SELECT 1 FROM user_roles WHERE user_id = $1 AND company_id = $2 AND role_type = $3 AND is_active = true',
        [userId, companyId, 'company_admin']
      );

      if (companyAdminCheck.rows.length > 0) {
        return next();
      }

      // Division admins have access to clusters in their divisions
      const divisionAdminCheck = await pgPool.query(
        `SELECT 1 FROM user_roles ur
         JOIN clusters c ON ur.division_id = c.division_id
         WHERE ur.user_id = $1 AND ur.company_id = $2 AND ur.role_type = $3 
         AND c.id = $4 AND ur.is_active = true`,
        [userId, companyId, 'division_admin', clusterId]
      );

      if (divisionAdminCheck.rows.length > 0) {
        return next();
      }

      // Check if user has direct access to the specific cluster
      const result = await pgPool.query(
        'SELECT 1 FROM user_roles WHERE user_id = $1 AND company_id = $2 AND cluster_id = $3 AND is_active = true',
        [userId, companyId, clusterId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to this cluster' });
      }

      next();
    } catch (error) {
      console.error('Cluster access check error:', error);
      return res.status(500).json({ error: 'Cluster access check failed' });
    }
  };
};

// Legacy middleware for backward compatibility
export const requireAdmin = () => requireCompanyAdmin();

// Company owner check (company_admin role is considered owner)
export const requireCompanyOwner = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    const result = await pgPool.query(
      'SELECT role_type FROM user_roles WHERE user_id = $1 AND company_id = $2 AND is_active = true',
      [userId, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'User not authorized for this company' });
    }

    const userRoles = result.rows.map(row => row.role_type);
    if (!userRoles.includes('company_admin')) {
      return res.status(403).json({ error: 'Only company admins can perform this action' });
    }

    next();
  } catch (error) {
    console.error('Owner check error:', error);
    return res.status(500).json({ error: 'Owner check failed' });
  }
};

// User registration (Development version - bypasses email verification)
export const registerUser = async (userData) => {
  const { email, username, password, first_name, last_name } = userData;
  
  // Check if user already exists
  const existingUser = await pgPool.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('User with this email or username already exists');
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Start a transaction to create user and temporary company
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');

    // Create a temporary company for the user
    const companyResult = await client.query(
      `INSERT INTO companies (name, description, country, company_size, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, NULL)
       RETURNING id`,
      [
        `${first_name || username}'s Company`,
        'Temporary company - replace with your actual company',
        'US',
        'startup',
        true
      ]
    );

    const companyId = companyResult.rows[0].id;

    // Create the user with the company_id
    const userResult = await client.query(
      `INSERT INTO users (company_id, username, email, password_hash, first_name, last_name, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, NULL)
       RETURNING id, username, email, first_name, last_name, company_id`,
      [companyId, username, email, passwordHash, first_name, last_name]
    );

    // Update the company's created_by to reference the new user
    await client.query(
      'UPDATE companies SET created_by = $1 WHERE id = $2',
      [userResult.rows[0].id, companyId]
    );

    // Update the user's created_by to reference themselves
    await client.query(
      'UPDATE users SET created_by = $1 WHERE id = $2',
      [userResult.rows[0].id, userResult.rows[0].id]
    );

    // Create company_admin role for the user (first user becomes company admin)
    await client.query(
      `INSERT INTO user_roles (user_id, company_id, role_type, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [userResult.rows[0].id, companyId, 'company_admin', true, userResult.rows[0].id]
    );

    await client.query('COMMIT');

    return userResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Verify registration
export const verifyRegistration = async (token) => {
  const result = await pgPool.query(
    `SELECT * FROM user_registrations 
     WHERE registration_token = $1 AND status = 'pending' AND expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid or expired registration token');
  }

  const registration = result.rows[0];

  // Create the actual user
  const userResult = await pgPool.query(
    `INSERT INTO users (username, email, password_hash, first_name, last_name, email_verified)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING id, username, email, first_name, last_name`,
    [registration.username, registration.email, registration.password_hash, 
     registration.first_name, registration.last_name]
  );

  // Mark registration as verified
  await pgPool.query(
    'UPDATE user_registrations SET status = $1, verified_at = NOW() WHERE id = $2',
    ['verified', registration.id]
  );

  return userResult.rows[0];
};

// User login
export const loginUser = async (email, password) => {
  // Find user
  const userResult = await pgPool.query(
    'SELECT id, username, email, password_hash, first_name, last_name, company_id, is_active, login_attempts, locked_until FROM users WHERE email = $1',
    [email]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = userResult.rows[0];

  // Check if account is locked
  if (user.locked_until && user.locked_until > new Date()) {
    throw new Error('Account is temporarily locked. Please try again later.');
  }

  // Check if account is active
  if (!user.is_active) {
    throw new Error('Account is deactivated');
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    // Increment login attempts
    const newAttempts = user.login_attempts + 1;
    let lockedUntil = null;
    
    if (newAttempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
    }

    await pgPool.query(
      'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
      [newAttempts, lockedUntil, user.id]
    );

    throw new Error('Invalid credentials');
  }

  // Reset login attempts on successful login
  await pgPool.query(
    'UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
    [user.id]
  );

  // Generate tokens
  const sessionToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create session
  await pgPool.query(
    `INSERT INTO user_sessions (user_id, session_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, sessionToken, refreshToken, expiresAt]
  );

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      company_id: user.company_id
    },
    sessionToken,
    refreshToken
  };
};

// Refresh token
export const refreshToken = async (refreshToken) => {
  const sessionResult = await pgPool.query(
    'SELECT user_id FROM user_sessions WHERE refresh_token = $1 AND is_active = TRUE AND expires_at > NOW()',
    [refreshToken]
  );

  if (sessionResult.rows.length === 0) {
    throw new Error('Invalid refresh token');
  }

  const userId = sessionResult.rows[0].user_id;

  // Generate new session token
  const newSessionToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  // Update session
  await pgPool.query(
    'UPDATE user_sessions SET session_token = $1, last_used_at = NOW() WHERE refresh_token = $2',
    [newSessionToken, refreshToken]
  );

  return { sessionToken: newSessionToken };
};

// Logout
export const logoutUser = async (sessionToken) => {
  await pgPool.query(
    'UPDATE user_sessions SET is_active = FALSE WHERE session_token = $1',
    [sessionToken]
  );
};

// Create company with owner
export const createCompanyWithOwner = async (companyData, ownerUserId) => {
  const { name, description, country, website, phone, address, city, state_province, postal_code, company_size, fiscal_year_start, timezone, currency, logo_url, notes } = companyData;

  // Start a transaction
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');

    // Create the company
    const companyResult = await client.query(
      `INSERT INTO companies (name, description, created_by, country, website, phone, address, city, state_province, postal_code, company_size, fiscal_year_start, timezone, currency, logo_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [name, description, ownerUserId, country, website, phone, address, city, state_province, postal_code, company_size, fiscal_year_start, timezone, currency, logo_url, notes]
    );

    const companyId = companyResult.rows[0].id;

    // Make the user the owner
    await client.query(
      `INSERT INTO company_admins (user_id, company_id, is_owner, created_by)
       VALUES ($1, $2, TRUE, $1)`,
      [ownerUserId, companyId]
    );

    // Update the user's company_id
    await client.query(
      'UPDATE users SET company_id = $1 WHERE id = $2',
      [companyId, ownerUserId]
    );

    await client.query('COMMIT');
    return companyId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get user's company info
export const getUserCompany = async (userId) => {
  const result = await pgPool.query(
    `SELECT c.* FROM companies c
     JOIN users u ON c.id = u.company_id
     WHERE u.id = $1`,
    [userId]
  );

  return result.rows[0] || null;
};

// Check if user can manage resource
export const canUserManageResource = async (userId, companyId, resourceType) => {
  const result = await pgPool.query(
    'SELECT can_manage_users, can_manage_divisions, can_manage_clusters, can_manage_sop_cycles FROM company_admins WHERE user_id = $1 AND company_id = $2',
    [userId, companyId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const admin = result.rows[0];
  
  switch (resourceType) {
    case 'users':
      return admin.can_manage_users;
    case 'divisions':
      return admin.can_manage_divisions;
    case 'clusters':
      return admin.can_manage_clusters;
    case 'sop_cycles':
      return admin.can_manage_sop_cycles;
    default:
      return false;
  }
}; 

// Create user invitation (only company admins can invite users)
export const createUserInvitation = async (invitationData, createdByUserId) => {
  const { email, username, first_name, last_name, assigned_roles, company_id } = invitationData;
  
  // Generate temporary password
  const temporaryPassword = crypto.randomBytes(8).toString('hex');
  const temporaryPasswordHash = await bcrypt.hash(temporaryPassword, 12);
  
  // Generate invitation token
  const invitationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create invitation
  const invitationResult = await pgPool.query(
    `INSERT INTO user_invitations (
      company_id, email, username, first_name, last_name, temporary_password_hash,
      assigned_roles, invitation_token, expires_at, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id, invitation_token`,
    [company_id, email, username, first_name, last_name, temporaryPasswordHash,
     JSON.stringify(assigned_roles), invitationToken, expiresAt, createdByUserId]
  );

  return {
    invitationId: invitationResult.rows[0].id,
    invitationToken: invitationResult.rows[0].invitation_token,
    temporaryPassword,
    expiresAt
  };
};

// Accept user invitation
export const acceptUserInvitation = async (invitationToken, newPassword) => {
  // Find and validate invitation
  const invitationResult = await pgPool.query(
    `SELECT * FROM user_invitations 
     WHERE invitation_token = $1 AND status = 'pending' AND expires_at > NOW()`,
    [invitationToken]
  );

  if (invitationResult.rows.length === 0) {
    throw new Error('Invalid or expired invitation token');
  }

  const invitation = invitationResult.rows[0];

  // Start transaction
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Create the user
    const userResult = await client.query(
      `INSERT INTO users (company_id, username, email, password_hash, first_name, last_name, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
       RETURNING id, username, email, first_name, last_name, company_id`,
      [invitation.company_id, invitation.username, invitation.email, passwordHash,
       invitation.first_name, invitation.last_name, invitation.created_by]
    );

    const user = userResult.rows[0];

    // Assign roles if specified
    if (invitation.assigned_roles && Array.isArray(invitation.assigned_roles)) {
      for (const roleAssignment of invitation.assigned_roles) {
        await client.query(
          `INSERT INTO user_roles (user_id, company_id, division_id, cluster_id, role_type, is_active, created_by)
           VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
          [user.id, invitation.company_id, roleAssignment.division_id, roleAssignment.cluster_id,
           roleAssignment.role_type, invitation.created_by]
        );
      }
    }

    // Mark invitation as accepted
    await client.query(
      'UPDATE user_invitations SET status = $1, accepted_at = NOW(), accepted_by = $2 WHERE id = $3',
      ['accepted', user.id, invitation.id]
    );

    await client.query('COMMIT');

    return user;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get user invitations for a company
export const getUserInvitations = async (companyId) => {
  const result = await pgPool.query(
    `SELECT ui.*, u.username as created_by_username
     FROM user_invitations ui
     LEFT JOIN users u ON ui.created_by = u.id
     WHERE ui.company_id = $1
     ORDER BY ui.created_at DESC`,
    [companyId]
  );
  return result.rows;
}; 