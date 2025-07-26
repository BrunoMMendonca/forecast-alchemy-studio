import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Database configuration
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Create field definitions for special fields
router.post('/', authenticateToken, async (req, res) => {
  const { companyId, fieldNames } = req.body;
  const userId = req.user.id;

  if (!companyId || !fieldNames || !Array.isArray(fieldNames)) {
    return res.status(400).json({ success: false, error: 'Company ID and field names array are required' });
  }

  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const createdFields = [];
      
      for (const fieldName of fieldNames) {
        // Check if field definition already exists
        const existingField = await client.query(
          `SELECT id FROM aggregatable_field_defs WHERE company_id = $1 AND field_name = $2`,
          [companyId, fieldName]
        );

        if (existingField.rows.length === 0) {
          // Create new field definition
          const fieldType = getFieldType(fieldName);
          const isRequired = isRequiredField(fieldName);
          
          const result = await client.query(
            `INSERT INTO aggregatable_field_defs 
             (company_id, field_name, field_type, is_required, created_by) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, field_name, field_type`,
            [companyId, fieldName, fieldType, isRequired, userId]
          );

          createdFields.push(result.rows[0]);
        } else {
          // Field already exists, get its info
          const result = await client.query(
            `SELECT id, field_name, field_type FROM aggregatable_field_defs WHERE company_id = $1 AND field_name = $2`,
            [companyId, fieldName]
          );
          createdFields.push(result.rows[0]);
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Field definitions processed successfully`,
        createdFields,
        totalFields: createdFields.length
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating field definitions:', error);
    res.status(500).json({ success: false, error: 'Failed to create field definitions' });
  }
});

// Get field definitions for a company
router.get('/company/:companyId', authenticateToken, async (req, res) => {
  const { companyId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, field_name, field_type, is_required, options, created_at 
       FROM aggregatable_field_defs 
       WHERE company_id = $1    ORDER BY field_name`,
      [companyId]
    );

    res.json({
      success: true,
      fieldDefinitions: result.rows
    });

  } catch (error) {
    console.error('Error fetching field definitions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch field definitions' });
  }
});

// Helper function to determine field type
function getFieldType(fieldName) {
  const fieldNameLower = fieldName.toLowerCase();
  
  if (fieldNameLower.includes('division') || fieldNameLower.includes('cluster')) {
    return 'organizational';
  } else if (fieldNameLower.includes('material') || fieldNameLower.includes('sku') || fieldNameLower.includes('code')) {
    return 'identifier';
  } else if (fieldNameLower.includes('description') || fieldNameLower.includes('name')) {
    return 'descriptive';
  } else if (fieldNameLower.includes('date')) {
    return 'date';
  } else {
    return 'custom';
  }
}

// Helper function to determine if field is required
function isRequiredField(fieldName) {
  const requiredFields = ['Material Name', 'Description', 'Division', 'Cluster'];
  return requiredFields.includes(fieldName);
}

export default router; 