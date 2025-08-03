import express from 'express';
import { Pool } from 'pg';

const router = express.Router();

// Database configuration
const pgPool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const result = await pgPool.query('SELECT 1 as test');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Database schema endpoint
router.get('/schema', async (req, res) => {
  try {
    const tables = [
      'users', 'companies', 'divisions', 'clusters', 'datasets', 
      'jobs', 'optimization_results', 'sop_cycles', 'sop_cycle_configs',
      'field_definitions', 'field_mappings'
    ];
    
    const schema = {};
    
    for (const table of tables) {
      try {
        const result = await pgPool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table]);
        
        schema[table] = result.rows;
      } catch (error) {
        console.error(`Error getting schema for table ${table}:`, error);
        schema[table] = { error: 'Table not found or access denied' };
      }
    }
    
    res.json(schema);
  } catch (error) {
    console.error('Schema endpoint failed:', error);
    res.status(500).json({ error: 'Failed to get schema' });
  }
});

export default router; 