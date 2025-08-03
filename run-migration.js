const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password'
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running migration to add cluster_id and division_id to datasets table...');
    
    // Check if columns already exist
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'datasets' 
      AND column_name IN ('cluster_id', 'division_id')
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    console.log('Existing columns:', existingColumns);
    
    // Add cluster_id if it doesn't exist
    if (!existingColumns.includes('cluster_id')) {
      console.log('Adding cluster_id column...');
      await client.query(`
        ALTER TABLE datasets 
        ADD COLUMN cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE
      `);
    }
    
    // Add division_id if it doesn't exist
    if (!existingColumns.includes('division_id')) {
      console.log('Adding division_id column...');
      await client.query(`
        ALTER TABLE datasets 
        ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE
      `);
    }
    
    // Update datasets to use default cluster and division
    console.log('Updating existing datasets...');
    
    // Get the first cluster for each company
    const updateClusterQuery = `
      UPDATE datasets 
      SET cluster_id = (
        SELECT c.id 
        FROM clusters c 
        JOIN divisions d ON d.id = c.division_id 
        WHERE d.company_id = datasets.company_id 
        LIMIT 1
      )
      WHERE cluster_id IS NULL
    `;
    await client.query(updateClusterQuery);
    
    // Get the first division for each company
    const updateDivisionQuery = `
      UPDATE datasets 
      SET division_id = (
        SELECT d.id 
        FROM divisions d 
        WHERE d.company_id = datasets.company_id 
        LIMIT 1
      )
      WHERE division_id IS NULL
    `;
    await client.query(updateDivisionQuery);
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration(); 