import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../auth.js';
import { getDivisions, getClusters, getSopCycles, getUserRoles } from '../db.js';

const router = express.Router();

// Database configuration
const pgPool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

// Helper function to check if division has associated data
async function checkDivisionDataUsage(divisionId) {
  const client = await pgPool.connect();
  try {
    // Check if division is referenced in datasets
    const datasetQuery = `
      SELECT COUNT(*) as count 
      FROM datasets 
      WHERE division_id = $1
    `;
    const datasetResult = await client.query(datasetQuery, [divisionId]);
    
    // Check if division is referenced in clusters
    const clusterQuery = `
      SELECT COUNT(*) as count 
      FROM clusters 
      WHERE division_id = $1 AND is_active = true
    `;
    const clusterResult = await client.query(clusterQuery, [divisionId]);
    
    // Check if division is referenced in S&OP cycles
    const sopQuery = `
      SELECT COUNT(*) as count 
      FROM sop_cycles 
      WHERE division_id = $1
    `;
    const sopResult = await client.query(sopQuery, [divisionId]);
    
    const totalUsage = parseInt(datasetResult.rows[0].count) + 
                      parseInt(clusterResult.rows[0].count) + 
                      parseInt(sopResult.rows[0].count);
    
    return {
      hasData: totalUsage > 0,
      datasetCount: parseInt(datasetResult.rows[0].count),
      clusterCount: parseInt(clusterResult.rows[0].count),
      sopCount: parseInt(sopResult.rows[0].count),
      totalCount: totalUsage
    };
  } finally {
    client.release();
  }
}

// Helper function to check if cluster has associated data
async function checkClusterDataUsage(clusterId) {
  const client = await pgPool.connect();
  try {
    // Get the cluster's division_id
    const clusterQuery = `
      SELECT division_id FROM clusters WHERE id = $1
    `;
    const clusterResult = await client.query(clusterQuery, [clusterId]);
    
    if (clusterResult.rows.length === 0) {
      return {
        hasData: false,
        divisionCount: 0,
        clusterCount: 0,
        totalCount: 0
      };
    }
    
    const divisionId = clusterResult.rows[0].division_id;
    
    // Check if the cluster's division has field mappings
    const fieldMappingQuery = `
      SELECT COUNT(*) as count 
      FROM dataset_aggregatable_field_map 
      WHERE division_id = $1
    `;
    const fieldMappingResult = await client.query(fieldMappingQuery, [divisionId]);
    
    // Check if there are other clusters in the same division
    const otherClustersQuery = `
      SELECT COUNT(*) as count 
      FROM clusters 
      WHERE division_id = $1 AND id != $2 AND is_active = true
    `;
    const otherClustersResult = await client.query(otherClustersQuery, [divisionId, clusterId]);
    
    const totalUsage = parseInt(fieldMappingResult.rows[0].count) + 
                      parseInt(otherClustersResult.rows[0].count);
    
    return {
      hasData: totalUsage > 0,
      fieldMappingCount: parseInt(fieldMappingResult.rows[0].count),
      otherClustersCount: parseInt(otherClustersResult.rows[0].count),
      totalCount: totalUsage
    };
  } finally {
    client.release();
  }
}

// Get divisions for a company
router.get('/divisions', async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId) || 1; // Default to company 1 for now
    const divisions = await getDivisions(companyId);
    res.json(divisions);
  } catch (error) {
    console.error('[API] Error fetching divisions:', error);
    res.status(500).json({ error: 'Failed to fetch divisions' });
  }
});

// GET /api/divisions - Get all active divisions
router.get('/divisions/active', authenticateToken, async (req, res) => {
  const client = await pgPool.connect();
  try {
    const query = `
      SELECT id, name, description, industry, 
             is_active, deleted_at, deleted_by,
             created_at, updated_at
      FROM divisions 
      WHERE is_active = true
      ORDER BY name
    `;
    const result = await client.query(query);
    res.json({ divisions: result.rows });
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ error: 'Failed to fetch divisions' });
  } finally {
    client.release();
  }
});

// GET /api/divisions/inactive - Get all inactive divisions
router.get('/divisions/inactive', authenticateToken, async (req, res) => {
  const client = await pgPool.connect();
  try {
    // Simple query without JOIN to avoid any table existence issues
    const query = `
      SELECT id, name, description, industry, 
             is_active, deleted_at, deleted_by,
             created_at, updated_at,
             'Unknown User' as deleted_by_username
      FROM divisions
      WHERE is_active = false
      ORDER BY deleted_at DESC
    `;
    
    const result = await client.query(query);
    console.log(`Found ${result.rows.length} inactive divisions`);
    res.json({ divisions: result.rows });
  } catch (error) {
    console.error('Error fetching inactive divisions:', error);
    res.status(500).json({ error: 'Failed to fetch inactive divisions' });
  } finally {
    client.release();
  }
});

// DELETE /api/divisions/:id - Soft delete division
router.delete('/divisions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const forceHardDelete = req.headers['x-force-hard-delete'] === 'true';
  const userId = req.user.id;
  
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if division exists
    const divisionQuery = 'SELECT * FROM divisions WHERE id = $1';
    const divisionResult = await client.query(divisionQuery, [id]);
    
    if (divisionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Division not found' });
    }
    
    const division = divisionResult.rows[0];
    
    // Check if division is already deleted
    if (!division.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Division is already deleted' });
    }
    
    // Check data usage
    const usage = await checkDivisionDataUsage(id);
    
    if (usage.hasData && !forceHardDelete) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Division is in use',
        details: {
          datasetCount: usage.datasetCount,
          clusterCount: usage.clusterCount,
          sopCount: usage.sopCount,
          totalCount: usage.totalCount
        }
      });
    }
    
    if (usage.hasData && forceHardDelete) {
      // Hard delete - remove all associated data
      console.log(`Hard deleting division ${id} with ${usage.totalCount} associated records`);
      
      // Delete associated datasets
      if (usage.datasetCount > 0) {
        await client.query('DELETE FROM datasets WHERE division_id = $1', [id]);
      }
      
      // Delete associated clusters
      if (usage.clusterCount > 0) {
        await client.query('DELETE FROM clusters WHERE division_id = $1', [id]);
      }
      
      // Delete associated S&OP cycles
      if (usage.sopCount > 0) {
        await client.query('DELETE FROM sop_cycles WHERE division_id = $1', [id]);
      }
      
      // Delete the division
      await client.query('DELETE FROM divisions WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        method: 'hard',
        message: 'Division and all associated data deleted permanently'
      });
    } else {
      // Soft delete - no associated data
      console.log(`Soft deleting division ${id} (no associated data)`);
      
      const updateQuery = `
        UPDATE divisions 
        SET is_active = false, deleted_at = NOW(), deleted_by = $1
        WHERE id = $2
      `;
      await client.query(updateQuery, [userId, id]);
      
      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        method: 'soft',
        message: 'Division soft deleted successfully'
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting division:', error);
    res.status(500).json({ error: 'Failed to delete division' });
  } finally {
    client.release();
  }
});

// PUT /api/divisions/:id/restore - Restore soft deleted division
router.put('/divisions/:id/restore', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if division exists and is deleted
    const divisionQuery = 'SELECT * FROM divisions WHERE id = $1';
    const divisionResult = await client.query(divisionQuery, [id]);
    
    if (divisionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Division not found' });
    }
    
    const division = divisionResult.rows[0];
    
    if (division.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Division is already active' });
    }
    
    // Restore the division
    const restoreQuery = `
      UPDATE divisions 
      SET is_active = true, deleted_at = NULL, deleted_by = NULL
      WHERE id = $1
    `;
    await client.query(restoreQuery, [id]);
    
    await client.query('COMMIT');
    res.json({ 
      success: true, 
      message: 'Division restored successfully' 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error restoring division:', error);
    res.status(500).json({ error: 'Failed to restore division' });
  } finally {
    client.release();
  }
});

// GET /api/divisions/:id/usage - Get division usage statistics
router.get('/divisions/:id/usage', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const usage = await checkDivisionDataUsage(id);
    res.json({ 
      divisionId: id,
      usage: usage
    });
  } catch (error) {
    console.error('Error checking division usage:', error);
    res.status(500).json({ error: 'Failed to check division usage' });
  }
});

// Get clusters for a company
router.get('/clusters', async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId) || 1; // Default to company 1 for now
    const clusters = await getClusters(companyId);
    res.json(clusters);
  } catch (error) {
    console.error('[API] Error fetching clusters:', error);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// GET /api/clusters/:id/usage - Get cluster usage statistics
router.get('/clusters/:id/usage', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const usage = await checkClusterDataUsage(id);
    res.json({ 
      clusterId: id,
      usage: usage
    });
  } catch (error) {
    console.error('Error checking cluster usage:', error);
    res.status(500).json({ error: 'Failed to check cluster usage' });
  }
});

// DELETE /api/clusters/:id - Soft delete cluster
router.delete('/clusters/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const forceHardDelete = req.headers['x-force-hard-delete'] === 'true';
  const userId = req.user.id;
  
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if cluster exists
    const clusterQuery = 'SELECT * FROM clusters WHERE id = $1';
    const clusterResult = await client.query(clusterQuery, [id]);
    
    if (clusterResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cluster not found' });
    }
    
    const cluster = clusterResult.rows[0];
    
    // Check if cluster is already deleted
    if (!cluster.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cluster is already deleted' });
    }
    
    // Check data usage
    const usage = await checkClusterDataUsage(id);
    
    if (usage.hasData && !forceHardDelete) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Cluster is in use',
        details: {
          fieldMappingCount: usage.fieldMappingCount,
          otherClustersCount: usage.otherClustersCount,
          totalCount: usage.totalCount
        }
      });
    }
    
    if (usage.hasData && forceHardDelete) {
      // Hard delete - remove all associated data
      console.log(`Hard deleting cluster ${id} with ${usage.totalCount} associated records`);
      
      // Delete associated field mappings for the division
      if (usage.fieldMappingCount > 0) {
        await client.query('DELETE FROM dataset_aggregatable_field_map WHERE division_id = (SELECT division_id FROM clusters WHERE id = $1)', [id]);
      }
      
      // Delete other clusters in the same division
      if (usage.otherClustersCount > 0) {
        await client.query('DELETE FROM clusters WHERE division_id = (SELECT division_id FROM clusters WHERE id = $1) AND id != $1', [id]);
      }
      
      // Delete the cluster
      await client.query('DELETE FROM clusters WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        method: 'hard',
        message: 'Cluster and all associated data deleted permanently'
      });
    } else {
      // Soft delete - no associated data
      console.log(`Soft deleting cluster ${id} (no associated data)`);
      
      const updateQuery = `
        UPDATE clusters 
        SET is_active = false, deleted_at = NOW(), deleted_by = $1
        WHERE id = $2
      `;
      await client.query(updateQuery, [userId, id]);
      
      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        method: 'soft',
        message: 'Cluster soft deleted successfully'
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting cluster:', error);
    res.status(500).json({ error: 'Failed to delete cluster' });
  } finally {
    client.release();
  }
});

// PUT /api/clusters/:id/restore - Restore soft deleted cluster
router.put('/clusters/:id/restore', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if cluster exists
    const clusterQuery = 'SELECT * FROM clusters WHERE id = $1';
    const clusterResult = await client.query(clusterQuery, [id]);
    
    if (clusterResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cluster not found' });
    }
    
    const cluster = clusterResult.rows[0];
    
    // Check if cluster is already active
    if (cluster.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cluster is already active' });
    }
    
    // Restore the cluster
    const restoreQuery = `
      UPDATE clusters 
      SET is_active = true, deleted_at = NULL, deleted_by = NULL
      WHERE id = $1
    `;
    await client.query(restoreQuery, [id]);
    
    await client.query('COMMIT');
    res.json({ 
      success: true, 
      message: 'Cluster restored successfully' 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error restoring cluster:', error);
    res.status(500).json({ error: 'Failed to restore cluster' });
  } finally {
    client.release();
  }
});

// Get S&OP cycles for a company
router.get('/sop-cycles', async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId) || 1; // Default to company 1 for now
    const sopCycles = await getSopCycles(companyId);
    res.json(sopCycles);
  } catch (error) {
    console.error('[API] Error fetching S&OP cycles:', error);
    res.status(500).json({ error: 'Failed to fetch S&OP cycles' });
  }
});

// Get user roles for a company
router.get('/user-roles', async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId) || 1; // Default to company 1 for now
    const userRoles = await getUserRoles(companyId);
    res.json(userRoles);
  } catch (error) {
    console.error('[API] Error fetching user roles:', error);
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

// Get companies
router.get('/companies', async (req, res) => {
  try {
    const result = await pgPool.query(
      'SELECT id, name, description, country, website, phone, address, city, state_province, postal_code, company_size, fiscal_year_start, timezone, currency, logo_url, notes FROM companies WHERE is_active = true ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[API] Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get organization structure configuration
router.get('/organization-structure-config', async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    // For now, return a basic configuration
    // This should be enhanced to get actual configuration from database
    const config = {
      hasMultipleDivisions: false,
      hasMultipleClusters: false,
      enableLifecycleTracking: false,
      lifecycleMappings: [],
      importLevel: 'company',
      csvUploadType: null,
      divisionCsvType: null,
      setupFlow: {
        skipDivisionStep: false,
        skipClusterStep: false,
        divisionValue: null,
        clusterValue: null,
        requiresCsvUpload: false,
        csvImportSkippable: false,
        csvStructure: {
          hasDivisionColumn: false,
          hasClusterColumn: false,
          hasLifecycleColumn: false,
        },
      }
    };

    res.json({ config });
  } catch (error) {
    console.error('[API] Error getting organization structure configuration:', error);
    res.status(500).json({ error: 'Failed to get organization structure configuration' });
  }
});

export default router; 