import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Database configuration
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

// Helper function to check if cluster has associated data
async function checkClusterDataUsage(clusterId) {
  const client = await pool.connect();
  try {
    // Check if cluster is referenced in datasets
    const datasetQuery = `
      SELECT COUNT(*) as count 
      FROM datasets 
      WHERE cluster_id = $1
    `;
    const datasetResult = await client.query(datasetQuery, [clusterId]);
    
    // Check if cluster is referenced in S&OP cycles
    const sopQuery = `
      SELECT COUNT(*) as count 
      FROM sop_cycles 
      WHERE cluster_id = $1
    `;
    const sopResult = await client.query(sopQuery, [clusterId]);
    
    const totalUsage = parseInt(datasetResult.rows[0].count) + 
                      parseInt(sopResult.rows[0].count);
    
    return {
      hasData: totalUsage > 0,
      datasetCount: parseInt(datasetResult.rows[0].count),
      sopCount: parseInt(sopResult.rows[0].count),
      totalCount: totalUsage
    };
  } finally {
    client.release();
  }
}

// GET /api/clusters - Get all active clusters
router.get('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT c.id, c.name, c.description, c.country_code, c.region, 
             c.division_id,
             c.is_active, c.deleted_at, c.deleted_by,
             c.created_at, c.updated_at,
             d.name as division_name
      FROM clusters c
      LEFT JOIN divisions d ON c.division_id = d.id
      WHERE c.is_active = true
      ORDER BY d.name, c.name
    `;
    const result = await client.query(query);
    res.json({ clusters: result.rows });
  } catch (error) {
    console.error('Error fetching clusters:', error);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  } finally {
    client.release();
  }
});

// GET /api/clusters/inactive - Get all inactive clusters
router.get('/inactive', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    // Simple query without JOIN to avoid any table existence issues
    const query = `
      SELECT c.id, c.name, c.description, c.country_code, c.region, 
             c.division_id,
             c.is_active, c.deleted_at, c.deleted_by,
             c.created_at, c.updated_at,
             'Unknown Division' as division_name,
             'Unknown User' as deleted_by_username
      FROM clusters c
      WHERE c.is_active = false
      ORDER BY c.deleted_at DESC
    `;
    
    const result = await client.query(query);
    console.log(`Found ${result.rows.length} inactive clusters`);
    res.json({ clusters: result.rows });
  } catch (error) {
    console.error('Error fetching inactive clusters:', error);
    res.status(500).json({ error: 'Failed to fetch inactive clusters' });
  } finally {
    client.release();
  }
});

// DELETE /api/clusters/:id - Soft delete cluster
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const forceHardDelete = req.headers['x-force-hard-delete'] === 'true';
  const userId = req.user.id;
  
  const client = await pool.connect();
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
          datasetCount: usage.datasetCount,
          sopCount: usage.sopCount,
          totalCount: usage.totalCount
        }
      });
    }
    
    if (usage.hasData && forceHardDelete) {
      // Hard delete - remove all associated data
      console.log(`Hard deleting cluster ${id} with ${usage.totalCount} associated records`);
      
      // Delete associated datasets
      if (usage.datasetCount > 0) {
        await client.query('DELETE FROM datasets WHERE cluster_id = $1', [id]);
      }
      
      // Delete associated S&OP cycles
      if (usage.sopCount > 0) {
        await client.query('DELETE FROM sop_cycles WHERE cluster_id = $1', [id]);
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
router.put('/:id/restore', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if cluster exists and is deleted
    const clusterQuery = 'SELECT * FROM clusters WHERE id = $1';
    const clusterResult = await client.query(clusterQuery, [id]);
    
    if (clusterResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cluster not found' });
    }
    
    const cluster = clusterResult.rows[0];
    
    if (cluster.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cluster is already active' });
    }
    
    // Check if the parent division is still active
    const divisionQuery = 'SELECT is_active FROM divisions WHERE id = $1';
    const divisionResult = await client.query(divisionQuery, [cluster.division_id]);
    
    if (divisionResult.rows.length === 0 || !divisionResult.rows[0].is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot restore cluster: parent division is deleted' });
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

// GET /api/clusters/:id/usage - Get cluster usage statistics
router.get('/:id/usage', authenticateToken, async (req, res) => {
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

export default router; 
 
 
 
 
 
 
 
 
 