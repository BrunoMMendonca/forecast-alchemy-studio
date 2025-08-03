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
  const { companyId, divisionId } = req.query;
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

    let query = `
      SELECT 
        fm.id,
        fm.field_def_id,
        fm.dataset_column,
        fm.division_id,
        fm.field_order,
        afd.field_name,
        afd.field_type,
        afd.options,
        d.name as division_name
      FROM dataset_aggregatable_field_map fm
      JOIN aggregatable_field_defs afd ON fm.field_def_id = afd.id
      LEFT JOIN divisions d ON fm.division_id = d.id
      WHERE fm.company_id = $1
    `;
    
    const params = [companyId];
    
    if (divisionId) {
      query += ` AND fm.division_id = $2`;
      params.push(divisionId);
    } else {
      // If no division specified, get both company-wide (NULL) and division-specific mappings
      query += ` AND (fm.division_id IS NULL OR fm.division_id IS NOT NULL)`;
    }
    
    query += ` ORDER BY afd.field_type, fm.field_order, fm.dataset_column`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching field mappings:', error);
    res.status(500).json({ error: 'Failed to fetch field mappings' });
  }
});

// Get all field mappings for a company (path parameter format)
router.get('/company/:companyId', authenticateToken, async (req, res) => {
  const { companyId } = req.params;
  const { divisionId } = req.query;
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

    let query = `
      SELECT 
        fm.id,
        fm.field_def_id,
        fm.dataset_column,
        fm.division_id,
        fm.field_order,
        afd.field_name,
        afd.field_type,
        afd.options,
        d.name as division_name
      FROM dataset_aggregatable_field_map fm
      JOIN aggregatable_field_defs afd ON fm.field_def_id = afd.id
      LEFT JOIN divisions d ON fm.division_id = d.id
      WHERE fm.company_id = $1
    `;
    
    const params = [companyId];
    
    if (divisionId) {
      query += ` AND fm.division_id = $2`;
      params.push(divisionId);
    } else {
      // If no division specified, get both company-wide (NULL) and division-specific mappings
      query += ` AND (fm.division_id IS NULL OR fm.division_id IS NOT NULL)`;
    }
    
    query += ` ORDER BY afd.field_type, fm.field_order, fm.dataset_column`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching field mappings:', error);
    res.status(500).json({ error: 'Failed to fetch field mappings' });
  }
});

// Create a new field mapping
router.post('/', authenticateToken, async (req, res) => {
  const { companyId, fieldDefId, datasetColumn, divisionId } = req.body;
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
      'SELECT id FROM dataset_aggregatable_field_map WHERE company_id = $1 AND field_def_id = $2 AND dataset_column = $3 AND COALESCE(division_id, -1) = COALESCE($4, -1)',
      [companyId, fieldDefId, datasetColumn, divisionId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Field mapping already exists for this division' });
    }

    const result = await pool.query(`
      INSERT INTO dataset_aggregatable_field_map (company_id, field_def_id, dataset_column, division_id, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [companyId, fieldDefId, datasetColumn, divisionId, userId]);

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
  const { divisionId } = req.query;
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

    let query = `
      SELECT id, field_name, field_type, options, division_id
      FROM aggregatable_field_defs
      WHERE company_id = $1
    `;
    
    const params = [companyId];
    
    if (divisionId) {
      query += ` AND division_id = $2`;
      params.push(divisionId);
    } else {
      // If no division specified, get both company-wide (NULL) and division-specific definitions
      query += ` AND (division_id IS NULL OR division_id IS NOT NULL)`;
    }
    
    query += ` ORDER BY field_type, field_name`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching field definitions:', error);
    res.status(500).json({ error: 'Failed to fetch field definitions' });
  }
});

// Create field definition
router.post('/field-definitions', authenticateToken, async (req, res) => {
  const { companyId, fieldName, fieldType, options, divisionId } = req.body;
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
      INSERT INTO aggregatable_field_defs (company_id, field_name, field_type, options, division_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [companyId, fieldName, fieldType, options, divisionId || null, userId]);

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
        const { companyId, fieldDefId, datasetColumn, divisionId } = mapping;

        if (!companyId || !fieldDefId || !datasetColumn) {
          throw new Error('Company ID, field definition ID, and dataset column are required for each mapping');
        }

        // Check if mapping already exists
        const existingMapping = await client.query(
          `SELECT id FROM dataset_aggregatable_field_map 
           WHERE company_id = $1 AND field_def_id = $2 AND dataset_column = $3 AND COALESCE(division_id, -1) = COALESCE($4, -1)`,
          [companyId, fieldDefId, datasetColumn, divisionId]
        );

        if (existingMapping.rows.length === 0) {
          // Create new mapping
          const result = await client.query(
            `INSERT INTO dataset_aggregatable_field_map 
             (company_id, field_def_id, dataset_column, division_id, created_by) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, field_def_id, dataset_column`,
            [companyId, fieldDefId, datasetColumn, divisionId, userId]
          );

          createdMappings.push(result.rows[0]);
        } else {
          // Mapping already exists, get its info
          const result = await client.query(
            `SELECT id, field_def_id, dataset_column 
             FROM dataset_aggregatable_field_map 
             WHERE company_id = $1 AND field_def_id = $2 AND dataset_column = $3 AND COALESCE(division_id, -1) = COALESCE($4, -1)`,
            [companyId, fieldDefId, datasetColumn, divisionId]
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

// Debug endpoint to save CSV mappings (overwrites existing mappings)
router.post('/debug-save', authenticateToken, async (req, res) => {
  const { companyId, mappings, divisionId } = req.body;
  const userId = req.user.id;

  if (!companyId || !mappings || !Array.isArray(mappings)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Company ID and mappings array are required' 
    });
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

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete ALL existing mappings for this company and division (if specified)
      let deleteQuery = 'DELETE FROM dataset_aggregatable_field_map WHERE company_id = $1';
      const deleteParams = [companyId];
      
      if (divisionId) {
        deleteQuery += ' AND division_id = $2';
        deleteParams.push(divisionId);
      } else {
        // If no division specified, delete ALL company-wide mappings
        deleteQuery += ' AND division_id IS NULL';
      }
      
      const deleteResult = await client.query(deleteQuery, deleteParams);


      // Create field definitions and mappings for each role
      const createdMappings = [];
      
      for (let index = 0; index < mappings.length; index++) {
        const mapping = mappings[index];
        const { datasetColumn, role } = mapping;
        
        if (!datasetColumn || !role) {
          console.warn('🔍 [DEBUG] Skipping invalid mapping:', mapping);
          continue;
        }

        // Determine field type based on role
        let fieldType = 'text'; // default
        let fieldName = role; // default
        let processedDatasetColumn = datasetColumn; // default
        
        switch (role.toLowerCase()) {
          case 'division':
            fieldType = 'division';
            fieldName = 'division_name';
            break;
          case 'cluster':
            fieldType = 'cluster';
            fieldName = 'cluster_name';
            break;
          case 'material code':
          case 'material':
          case 'sku':
            fieldType = 'material';
            fieldName = 'material_code';
            break;
          case 'description':
            fieldType = 'description';
            fieldName = 'description';
            break;
          case 'lifecycle phase':
          case 'Lifecycle Phase':
          case 'lifecycle':
            fieldType = 'lifecycle';
            fieldName = 'lifecycle_phase';
            break;
          case 'date':
            fieldType = 'date';
            fieldName = 'date';
            // Extract date format from the column name instead of saving the actual date
            const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$|^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}-\d{1,2}-\d{4}$/;
            if (datePattern.test(datasetColumn)) {
              // If it's a date pattern, save the format instead of the actual date
              if (datasetColumn.includes('/')) {
                processedDatasetColumn = 'MM/DD/YYYY';
              } else if (datasetColumn.includes('-')) {
                processedDatasetColumn = 'YYYY-MM-DD';
              } else {
                processedDatasetColumn = 'MM-DD-YYYY';
              }
            }
            break;
          default:
            // For custom aggregatable fields, use the role as field name
            fieldType = 'aggregatable';
            fieldName = role;
        }

        // Create or get field definition for this role
        let fieldDefId;
        const existingFieldDef = await client.query(
          'SELECT id FROM aggregatable_field_defs WHERE company_id = $1 AND field_name = $2',
          [companyId, fieldName]
        );

        if (existingFieldDef.rows.length > 0) {
          fieldDefId = existingFieldDef.rows[0].id;
        } else {
          // Create new field definition
          const fieldDefResult = await client.query(
            `INSERT INTO aggregatable_field_defs 
             (company_id, field_name, field_type, created_by) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id`,
            [companyId, fieldName, fieldType, userId]
          );
          fieldDefId = fieldDefResult.rows[0].id;
        }

        // Create the mapping with order
        const mappingResult = await client.query(
          `INSERT INTO dataset_aggregatable_field_map 
           (company_id, field_def_id, dataset_column, division_id, field_order, created_by) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING id, field_def_id, dataset_column`,
          [companyId, fieldDefId, processedDatasetColumn, divisionId, index + 1, userId]
        );

        createdMappings.push({
          id: mappingResult.rows[0].id,
          datasetColumn: processedDatasetColumn, // Use the processed dataset column
          role,
          fieldDefId,
          divisionId,
          order: index + 1
        });
      }

      await client.query('COMMIT');


      res.json({ 
        success: true,
        message: `Debug save completed: ${createdMappings.length} mappings saved${divisionId ? ` for division ${divisionId}` : ' (company-wide)'}`,
        deletedCount: deleteResult.rowCount,
        createdMappings,
        totalMappings: createdMappings.length,
        divisionId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('🔍 [DEBUG] Error in debug save:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to save mappings: ${error.message}` 
    });
  }
});

export default router; 