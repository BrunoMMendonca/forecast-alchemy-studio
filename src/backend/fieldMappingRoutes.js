import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/forecast_alchemy',
});

// Get all field mappings for a company (query parameter format)
router.get('/', authenticateToken, async (req, res) => {
  const { companyId } = req.query;
  const userId = req.user.id;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  try {
    // Verify user has access to this company
    const userCheck = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows[0].company_id !== parseInt(companyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT 
        fm.id,
        fm.field_def_id,
        fm.dataset_column,
        afd.field_name,
        afd.field_type,
        afd.options
      FROM dataset_aggregatable_field_map fm
      JOIN aggregatable_field_defs afd ON fm.field_def_id = afd.id
      WHERE fm.company_id = $1
      ORDER BY afd.field_type, fm.dataset_column
    `, [companyId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching field mappings:', error);
    res.status(500).json({ error: 'Failed to fetch field mappings' });
  }
});

// Get all field mappings for a company (path parameter format)
router.get('/company/:companyId', authenticateToken, async (req, res) => {
  const { companyId } = req.params;
  const userId = req.user.id;

  try {
    // Verify user has access to this company
    const userCheck = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows[0].company_id !== parseInt(companyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT 
        fm.id,
        fm.field_def_id,
        fm.dataset_column,
        afd.field_name,
        afd.field_type,
        afd.options
      FROM dataset_aggregatable_field_map fm
      JOIN aggregatable_field_defs afd ON fm.field_def_id = afd.id
      WHERE fm.company_id = $1
      ORDER BY afd.field_type, fm.dataset_column
    `, [companyId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching field mappings:', error);
    res.status(500).json({ error: 'Failed to fetch field mappings' });
  }
});

// Create a new field mapping
router.post('/', authenticateToken, async (req, res) => {
  const { companyId, fieldDefId, datasetColumn } = req.body;
  const userId = req.user.id;

  try {
    // Verify user has access to this company
    const userCheck = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows[0].company_id !== parseInt(companyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if mapping already exists
    const existing = await pool.query(
      'SELECT id FROM dataset_aggregatable_field_map WHERE company_id = $1 AND field_def_id = $2 AND dataset_column = $3',
      [companyId, fieldDefId, datasetColumn]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Field mapping already exists' });
    }

    const result = await pool.query(`
      INSERT INTO dataset_aggregatable_field_map (company_id, field_def_id, dataset_column, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [companyId, fieldDefId, datasetColumn, userId]);

    res.status(201).json({ 
      id: result.rows[0].id,
      message: 'Field mapping created successfully' 
    });
  } catch (error) {
    console.error('Error creating field mapping:', error);
    res.status(500).json({ error: 'Failed to create field mapping' });
  }
});

// Update a field mapping
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { datasetColumn } = req.body;
  const userId = req.user.id;

  try {
    // Verify user has access to this mapping
    const accessCheck = await pool.query(`
      SELECT fm.company_id, u.company_id as user_company_id
      FROM dataset_aggregatable_field_map fm
      JOIN users u ON u.id = $1
      WHERE fm.id = $2
    `, [userId, id]);

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Field mapping not found' });
    }

    if (accessCheck.rows[0].company_id !== accessCheck.rows[0].user_company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      UPDATE dataset_aggregatable_field_map 
      SET dataset_column = $1
      WHERE id = $2
      RETURNING id
    `, [datasetColumn, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Field mapping not found' });
    }

    res.json({ message: 'Field mapping updated successfully' });
  } catch (error) {
    console.error('Error updating field mapping:', error);
    res.status(500).json({ error: 'Failed to update field mapping' });
  }
});

// Delete a field mapping
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Verify user has access to this mapping
    const accessCheck = await pool.query(`
      SELECT fm.company_id, u.company_id as user_company_id
      FROM dataset_aggregatable_field_map fm
      JOIN users u ON u.id = $1
      WHERE fm.id = $2
    `, [userId, id]);

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Field mapping not found' });
    }

    if (accessCheck.rows[0].company_id !== accessCheck.rows[0].user_company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'DELETE FROM dataset_aggregatable_field_map WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Field mapping not found' });
    }

    res.json({ message: 'Field mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting field mapping:', error);
    res.status(500).json({ error: 'Failed to delete field mapping' });
  }
});

// Get field definitions for a company
router.get('/field-definitions/:companyId', authenticateToken, async (req, res) => {
  const { companyId } = req.params;
  const userId = req.user.id;

  try {
    // Verify user has access to this company
    const userCheck = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows[0].company_id !== parseInt(companyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT id, field_name, field_type, options
      FROM aggregatable_field_defs
      WHERE company_id = $1
      ORDER BY field_type, field_name
    `, [companyId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching field definitions:', error);
    res.status(500).json({ error: 'Failed to fetch field definitions' });
  }
});

// Create field definition
router.post('/field-definitions', authenticateToken, async (req, res) => {
  const { companyId, fieldName, fieldType, options } = req.body;
  const userId = req.user.id;

  try {
    // Verify user has access to this company
    const userCheck = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows[0].company_id !== parseInt(companyId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      INSERT INTO aggregatable_field_defs (company_id, field_name, field_type, options, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [companyId, fieldName, fieldType, options, userId]);

    res.status(201).json({ 
      id: result.rows[0].id,
      message: 'Field definition created successfully' 
    });
  } catch (error) {
    console.error('Error creating field definition:', error);
    res.status(500).json({ error: 'Failed to create field definition' });
  }
});

// Create multiple field mappings in batch
router.post('/batch', authenticateToken, async (req, res) => {
  const { mappings } = req.body;
  const userId = req.user.id;

  if (!mappings || !Array.isArray(mappings)) {
    return res.status(400).json({ success: false, error: 'Mappings array is required' });
  }

  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const createdMappings = [];
      
      for (const mapping of mappings) {
        const { companyId, fieldDefId, datasetColumn } = mapping;

        if (!companyId || !fieldDefId || !datasetColumn) {
          throw new Error('Company ID, field definition ID, and dataset column are required for each mapping');
        }

        // Check if mapping already exists
        const existingMapping = await client.query(
          `SELECT id FROM dataset_aggregatable_field_map 
           WHERE company_id = $1 AND field_def_id = $2 AND dataset_column = $3`,
          [companyId, fieldDefId, datasetColumn]
        );

        if (existingMapping.rows.length === 0) {
          // Create new mapping
          const result = await client.query(
            `INSERT INTO dataset_aggregatable_field_map 
             (company_id, field_def_id, dataset_column, created_by) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, field_def_id, dataset_column`,
            [companyId, fieldDefId, datasetColumn, userId]
          );

          createdMappings.push(result.rows[0]);
        } else {
          // Mapping already exists, get its info
          const result = await client.query(
            `SELECT id, field_def_id, dataset_column 
             FROM dataset_aggregatable_field_map 
             WHERE company_id = $1 AND field_def_id = $2 AND dataset_column = $3`,
            [companyId, fieldDefId, datasetColumn]
          );
          createdMappings.push(result.rows[0]);
        }
      }

      await client.query('COMMIT');

      res.json({ 
        success: true,
        message: `Field mappings processed successfully`,
        createdMappings,
        totalMappings: createdMappings.length
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating field mappings:', error);
    res.status(500).json({ success: false, error: 'Failed to create field mappings' });
  }
});

export default router; 