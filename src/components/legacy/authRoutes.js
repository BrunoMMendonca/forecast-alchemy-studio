import express from 'express';
import { 
  registerUser, 
  verifyRegistration, 
  loginUser, 
  logoutUser, 
  refreshToken,
  createCompanyWithOwner,
  getUserCompany,
  authenticateToken,
  requireCompanyAdmin,
  requireCompanyOwner,
  requireAdmin,
  createUserInvitation,
  acceptUserInvitation,
  getUserInvitations
} from './auth.js';

const router = express.Router();

// =====================================================
// AUTHENTICATION ROUTES
// =====================================================

// User registration
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, first_name, last_name } = req.body;

    // Validation
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Register user (now creates user directly)
    const user = await registerUser({
      email,
      username,
      password,
      first_name,
      last_name
    });

    res.json({
      success: true,
      message: 'Registration successful. You can now log in.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('[AUTH] Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Verify registration
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const user = await verifyRegistration(token);

    res.json({
      success: true,
      message: 'Account verified successfully. You can now log in.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('[AUTH] Verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await loginUser(email, password);

    res.json({
      success: true,
      message: 'Login successful',
      user: result.user,
      sessionToken: result.sessionToken,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const result = await refreshToken(token);

    res.json({
      success: true,
      sessionToken: result.sessionToken
    });
  } catch (error) {
    console.error('[AUTH] Token refresh error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    await logoutUser(token);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    // Get user's roles if they have a company
    let roles = [];
    if (companyId) {
      const { Pool } = await import('pg');
      const pgPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT
      });

      const rolesResult = await pgPool.query(
        'SELECT role_type, division_id, cluster_id FROM user_roles WHERE user_id = $1 AND company_id = $2 AND is_active = true',
        [userId, companyId]
      );
      roles = rolesResult.rows;
    }

    // Create user object with roles
    const userWithRoles = {
      ...req.user,
      roles: roles
    };

    res.json({
      success: true,
      user: userWithRoles
    });
  } catch (error) {
    console.error('[AUTH] Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// =====================================================
// COMPANY MANAGEMENT ROUTES (AUTHENTICATED)
// =====================================================

// Create company (only for users without a company)
router.post('/company', authenticateToken, requireAdmin(), async (req, res) => {
  try {
    // Check if user already has a company
    if (req.user.company_id) {
      return res.status(400).json({ error: 'User already belongs to a company' });
    }

    const companyData = req.body;

    if (!companyData.name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Create company and make user the owner
    const companyId = await createCompanyWithOwner(companyData, req.user.id);

    // Get the created company details
    const company = await getUserCompany(req.user.id);

    res.json({
      success: true,
      message: 'Company created successfully',
      company: company
    });
  } catch (error) {
    console.error('[AUTH] Company creation error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Get user's company
router.get('/company', authenticateToken, async (req, res) => {
  try {
    if (!req.user.company_id) {
      return res.status(404).json({ error: 'User not associated with any company' });
    }

    const company = await getUserCompany(req.user.id);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({
      success: true,
      company: company
    });
  } catch (error) {
    console.error('[AUTH] Get company error:', error);
    res.status(500).json({ error: 'Failed to get company info' });
  }
});

// Update user's company
router.put('/company', authenticateToken, async (req, res) => {
  try {
    if (!req.user.company_id) {
      return res.status(404).json({ error: 'User not associated with any company' });
    }

    const companyData = req.body;
    
    // Validate required fields
    if (!companyData.name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Update company
    const { Pool } = await import('pg');
    const pgPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT
    });

    const result = await pgPool.query(
      `UPDATE companies SET 
        name = $1, description = $2, country = $3, website = $4, phone = $5,
        address = $6, city = $7, state_province = $8, postal_code = $9, 
        company_size = $10, fiscal_year_start = $11, timezone = $12, 
        currency = $13, logo_url = $14, notes = $15, updated_at = CURRENT_TIMESTAMP
       WHERE id = $16 RETURNING *`,
      [
        companyData.name,
        companyData.description || null,
        companyData.country || null,
        companyData.website || null,
        companyData.phone || null,
        companyData.address || null,
        companyData.city || null,
        companyData.state_province || null,
        companyData.postal_code || null,
        companyData.company_size || null,
        companyData.fiscal_year_start || null,
        companyData.timezone || 'UTC',
        companyData.currency || 'USD',
        companyData.logo_url || null,
        companyData.notes || null,
        req.user.company_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({
      success: true,
      company: result.rows[0]
    });
  } catch (error) {
    console.error('[AUTH] Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// =====================================================
// SETUP STATUS ROUTES
// =====================================================

// Check if user needs to complete setup
router.get('/setup/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    if (!companyId) {
      // User needs to create a company
      return res.json({
        setupRequired: true,
        setupWizardAccessible: false,
        step: 'create_company',
        message: 'Please create your company to get started'
      });
    }

    // Check if company has completed setup
    const { Pool } = await import('pg');
    const pgPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT
    });

    // Get company details including setup_wizard_accessible flag
    const companyResult = await pgPool.query(
      'SELECT setup_completed, setup_wizard_accessible FROM companies WHERE id = $1',
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyResult.rows[0];
    const setupCompleted = company.setup_completed;
    let setupWizardAccessible = company.setup_wizard_accessible;

    // Check if user is a company admin
    const userRolesResult = await pgPool.query(
      'SELECT role_type FROM user_roles WHERE user_id = $1 AND company_id = $2',
      [userId, companyId]
    );

    const isCompanyAdmin = userRolesResult.rows.some(role => 
      role.role_type === 'company_admin' || role.role_type === 'division_admin'
    );

    // If user is a company admin, automatically grant setup wizard access
    if (isCompanyAdmin && !setupWizardAccessible) {
      console.log(`[SETUP STATUS] Granting setup wizard access to company admin (userId: ${userId}, companyId: ${companyId})`);
      await pgPool.query(
        'UPDATE companies SET setup_wizard_accessible = true WHERE id = $1',
        [companyId]
      );
      setupWizardAccessible = true;
    }

    // Get counts for informational purposes
    const divisionsResult = await pgPool.query(
      'SELECT COUNT(*) as count FROM divisions WHERE company_id = $1',
      [companyId]
    );

    const clustersResult = await pgPool.query(
      'SELECT COUNT(*) as count FROM clusters WHERE company_id = $1',
      [companyId]
    );

    const datasetsResult = await pgPool.query(
      'SELECT COUNT(*) as count FROM datasets WHERE company_id = $1',
      [companyId]
    );

    const divisionCount = parseInt(divisionsResult.rows[0].count);
    const clusterCount = parseInt(clustersResult.rows[0].count);
    const datasetCount = parseInt(datasetsResult.rows[0].count);

    console.log(`[SETUP STATUS] Response for user ${userId}:`);
    console.log(`  - setupRequired: ${!setupCompleted}`);
    console.log(`  - setupWizardAccessible: ${setupWizardAccessible}`);
    console.log(`  - isCompanyAdmin: ${isCompanyAdmin}`);

    res.json({
      setupRequired: !setupCompleted,
      setupWizardAccessible: setupWizardAccessible,
      hasDatasets: datasetCount > 0,
      step: setupCompleted ? 'complete' : 'setup_organization',
      divisionCount,
      clusterCount,
      datasetCount,
      message: setupCompleted ? 'Setup complete' : 'Please complete organization setup'
    });
  } catch (error) {
    console.error('[AUTH] Setup status error:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// Complete setup and disable wizard access
router.post('/setup/complete', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ error: 'User must belong to a company' });
    }

    // Check if user is a company admin
    const { Pool } = await import('pg');
    const pgPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT
    });

    const userRolesResult = await pgPool.query(
      'SELECT role_type FROM user_roles WHERE user_id = $1 AND company_id = $2',
      [userId, companyId]
    );

    const isCompanyAdmin = userRolesResult.rows.some(role => 
      role.role_type === 'company_admin' || role.role_type === 'division_admin'
    );

    if (!isCompanyAdmin) {
      return res.status(403).json({ error: 'Only company admins can complete setup' });
    }

    // Set setup_wizard_accessible = false and setup_completed = true
    const result = await pgPool.query(
      'UPDATE companies SET setup_wizard_accessible = false, setup_completed = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, name, setup_wizard_accessible, setup_completed',
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    console.log(`[SETUP COMPLETE] Setup completed for company ${companyId} by user ${userId}`);
    console.log(`[SETUP COMPLETE] Company state:`, result.rows[0]);

    res.json({
      success: true,
      message: 'Setup completed successfully',
      company: result.rows[0]
    });
  } catch (error) {
    console.error('[AUTH] Setup complete error:', error);
    res.status(500).json({ error: 'Failed to complete setup' });
  }
});

// =====================================================
// USER INVITATION ROUTES (ADMIN ONLY)
// =====================================================

// Create user invitation (only company admins)
router.post('/invite', authenticateToken, requireCompanyAdmin(), async (req, res) => {
  try {
    const { email, username, first_name, last_name, assigned_roles } = req.body;

    if (!email || !username) {
      return res.status(400).json({ error: 'Email and username are required' });
    }

    // Check if user already exists
    const { Pool } = await import('pg');
    const pgPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT
    });

    const existingUser = await pgPool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Create invitation
    const invitation = await createUserInvitation({
      email,
      username,
      first_name,
      last_name,
      assigned_roles: assigned_roles || [],
      company_id: req.user.company_id
    }, req.user.id);

    res.json({
      success: true,
      message: 'User invitation created successfully',
      invitation: {
        id: invitation.invitationId,
        email,
        username,
        temporaryPassword: invitation.temporaryPassword,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('[AUTH] Create invitation error:', error);
    res.status(500).json({ error: 'Failed to create user invitation' });
  }
});

// Accept user invitation
router.post('/invite/accept', async (req, res) => {
  try {
    const { invitationToken, newPassword } = req.body;

    if (!invitationToken || !newPassword) {
      return res.status(400).json({ error: 'Invitation token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const user = await acceptUserInvitation(invitationToken, newPassword);

    res.json({
      success: true,
      message: 'Invitation accepted successfully. You can now log in.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('[AUTH] Accept invitation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get user invitations for company (only company admins)
router.get('/invitations', authenticateToken, requireCompanyAdmin(), async (req, res) => {
  try {
    const invitations = await getUserInvitations(req.user.company_id);

    res.json({
      success: true,
      invitations
    });
  } catch (error) {
    console.error('[AUTH] Get invitations error:', error);
    res.status(500).json({ error: 'Failed to get user invitations' });
  }
});

export default router; 