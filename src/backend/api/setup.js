import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../auth.js';

const router = express.Router();

// Database configuration
const pgPool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

// Get setup status
router.get('/status', async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    // For now, return a basic setup status
    // This should be enhanced to check actual database state
    const setupStatus = {
      setupRequired: false,
      setupWizardAccessible: true,
      hasDatasets: false,
      divisionCount: 0,
      clusterCount: 0,
      datasetCount: 0,
      companyCount: 1
    };

    res.json(setupStatus);
  } catch (error) {
    console.error('[API] Error getting setup status:', error);
    res.status(500).json({ error: 'Failed to get setup status' });
  }
});

// Create company
router.post('/companies', authenticateToken, async (req, res) => {
  try {
    const { name, description, country, website, phone, address, city, state_province, postal_code, company_size, fiscal_year_start, timezone, currency, logo_url, notes } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const result = await pgPool.query(
      'INSERT INTO companies (name, description, country, website, phone, address, city, state_province, postal_code, company_size, fiscal_year_start, timezone, currency, logo_url, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id, name, description',
      [name, description || null, country || null, website || null, phone || null, address || null, city || null, state_province || null, postal_code || null, company_size || null, fiscal_year_start || null, timezone || 'UTC', currency || 'USD', logo_url || null, notes || null, userId]
    );

    res.json({
      success: true,
      company: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Create division
router.post('/divisions', authenticateToken, async (req, res) => {
  try {
    const { name, description, industry } = req.body;
    const companyId = req.user.company_id;

    if (!name) {
      return res.status(400).json({ error: 'Division name is required' });
    }

    const result = await pgPool.query(
      'INSERT INTO divisions (company_id, name, description, industry, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id, name, description, industry, is_active',
      [companyId, name, description || null, industry || null]
    );

    res.json({
      success: true,
      division: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error creating division:', error);
    res.status(500).json({ error: 'Failed to create division' });
  }
});

// Update division
router.put('/divisions/:id', async (req, res) => {
  try {
    const divisionId = parseInt(req.params.id);
    const { name, description, industry } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Division name is required' });
    }

    const result = await pgPool.query(
      'UPDATE divisions SET name = $1, description = $2, industry = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING id, name, description, industry',
      [name, description || null, industry || null, divisionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Division not found' });
    }

    res.json({
      success: true,
      division: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error updating division:', error);
    res.status(500).json({ error: 'Failed to update division' });
  }
});

// Create cluster
router.post('/clusters', authenticateToken, async (req, res) => {
  try {
    const { divisionId, name, description, countryCode, region } = req.body;
    const companyId = req.user.company_id;

    if (!name || !divisionId) {
      return res.status(400).json({ error: 'Cluster name and division ID are required' });
    }

    const result = await pgPool.query(
      'INSERT INTO clusters (company_id, division_id, name, description, country_code, region, is_active) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, name, description, country_code, region, is_active',
      [companyId, divisionId, name, description || null, countryCode || null, region || null]
    );

    res.json({
      success: true,
      cluster: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error creating cluster:', error);
    res.status(500).json({ error: 'Failed to create cluster' });
  }
});

// Update cluster
router.put('/clusters/:id', async (req, res) => {
  try {
    const clusterId = parseInt(req.params.id);
    const { name, description, countryCode, region } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Cluster name is required' });
    }

    const result = await pgPool.query(
      'UPDATE clusters SET name = $1, description = $2, country_code = $3, region = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id, name, description, country_code, region',
      [name, description || null, countryCode || null, region || null, clusterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    res.json({
      success: true,
      cluster: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error updating cluster:', error);
    res.status(500).json({ error: 'Failed to update cluster' });
  }
});

// Create S&OP cycle
router.post('/sop-cycles', authenticateToken, async (req, res) => {
  try {
    const { name, description, divisionId, startDate, endDate } = req.body;
    const companyId = req.user.company_id;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Cycle name, start date, and end date are required' });
    }

    const result = await pgPool.query(
      'INSERT INTO sop_cycles (company_id, division_id, name, description, start_date, end_date, is_current, is_completed, status) VALUES ($1, $2, $3, $4, $5, $6, false, false, \'active\') RETURNING id, name, description, start_date, end_date',
      [companyId, divisionId || null, name, description || null, startDate, endDate]
    );

    res.json({
      success: true,
      sopCycle: result.rows[0]
    });
  } catch (error) {
    console.error('[API] Error creating S&OP cycle:', error);
    res.status(500).json({ error: 'Failed to create S&OP cycle' });
  }
});

// Complete setup
router.post('/complete', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Update user's setup completion status
    await pgPool.query(
      'UPDATE users SET setup_completed = true WHERE id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Setup completed successfully'
    });
  } catch (error) {
    console.error('[API] Error completing setup:', error);
    res.status(500).json({ error: 'Failed to complete setup' });
  }
});

// Create divisions from CSV (silent creation for setup wizard)
router.post('/csv/create-divisions', authenticateToken, async (req, res) => {
  try {
    const { divisions, companyId } = req.body;
    const userId = req.user.id;

    if (!divisions || !Array.isArray(divisions)) {
      return res.status(400).json({ error: 'Divisions array is required' });
    }

    const createdDivisions = [];

    for (const divisionName of divisions) {
      const result = await pgPool.query(
        'INSERT INTO divisions (company_id, name, description, created_by, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id, name',
        [companyId, divisionName, `Division: ${divisionName}`, userId]
      );
      createdDivisions.push(result.rows[0]);
    }

    res.json({
      success: true,
      message: `Created ${createdDivisions.length} divisions`,
      divisions: createdDivisions
    });
  } catch (error) {
    console.error('[API] Error creating divisions from CSV:', error);
    res.status(500).json({ error: 'Failed to create divisions from CSV' });
  }
});

// Create clusters from CSV (silent creation for setup wizard)
router.post('/csv/create-clusters', authenticateToken, async (req, res) => {
  try {
    const { clusters, divisionNames, companyId } = req.body;
    const userId = req.user.id;

    if (!clusters || !Array.isArray(clusters)) {
      return res.status(400).json({ error: 'Clusters array is required' });
    }

    const createdClusters = [];

    if (divisionNames && divisionNames.length > 0) {
      // Scenario 1: Division names provided - create clusters for specific divisions
      const divisionsResult = await pgPool.query(
        'SELECT id, name FROM divisions WHERE company_id = $1 AND name = ANY($2)',
        [companyId, divisionNames]
      );
      const divisions = divisionsResult.rows;

      // Create clusters for each matching division
      for (const division of divisions) {
        for (const clusterName of clusters) {
          const result = await pgPool.query(
            'INSERT INTO clusters (company_id, division_id, name, description, created_by, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, name, division_id',
            [companyId, division.id, clusterName, `Cluster: ${clusterName}`, userId]
          );
          createdClusters.push(result.rows[0]);
        }
      }
    } else {
      // Scenario 2: No division names provided - create clusters for all divisions
      const divisionsResult = await pgPool.query(
        'SELECT id, name FROM divisions WHERE company_id = $1',
        [companyId]
      );
      const divisions = divisionsResult.rows;

      if (divisions.length === 0) {
        // No divisions exist yet - create a default division first
        const defaultDivisionResult = await pgPool.query(
          'INSERT INTO divisions (company_id, name, description, created_by, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id, name',
          [companyId, 'Default Division', 'Default division for cluster creation', userId]
        );
        divisions.push(defaultDivisionResult.rows[0]);
      }

      // Create clusters for each division
      for (const division of divisions) {
        for (const clusterName of clusters) {
          const result = await pgPool.query(
            'INSERT INTO clusters (company_id, division_id, name, description, created_by, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, name, division_id',
            [companyId, division.id, clusterName, `Cluster: ${clusterName}`, userId]
          );
          createdClusters.push(result.rows[0]);
        }
      }
    }

    res.json({
      success: true,
      message: `Created ${createdClusters.length} clusters`,
      clusters: createdClusters
    });
  } catch (error) {
    console.error('[API] Error creating clusters from CSV:', error);
    res.status(500).json({ error: 'Failed to create clusters from CSV' });
  }
});

export default router; 