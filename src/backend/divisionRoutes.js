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

// Helper function to check if division has associated data
async function checkDivisionDataUsage(divisionId) {
  const client = await pool.connect();
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

// GET /api/divisions - Get all active divisions
router.get('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
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
router.get('/inactive', authenticateToken, async (req, res) => {
  const client = await pool.connect();
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
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const forceHardDelete = req.headers['x-force-hard-delete'] === 'true';
  const userId = req.user.id;
  
  const client = await pool.connect();
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
router.put('/:id/restore', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const client = await pool.connect();
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
router.get('/:id/usage', authenticateToken, async (req, res) => {
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

export default router; 
 
 
 
 
 
 
 
 
 