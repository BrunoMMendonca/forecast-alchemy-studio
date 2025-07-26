import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

async function checkDatabase() {
  try {
    console.log('Checking database for divisions and clusters...');
    
    // Check divisions
    const divisionsResult = await pool.query('SELECT * FROM divisions ORDER BY id');
    console.log('Divisions:', divisionsResult.rows);
    
    // Check clusters
    const clustersResult = await pool.query('SELECT * FROM clusters ORDER BY id');
    console.log('Clusters:', clustersResult.rows);
    
    // Check if there are any clusters with division_id that don't match any division
    const orphanedClusters = await pool.query(`
      SELECT c.* FROM clusters c 
      LEFT JOIN divisions d ON c.division_id = d.id 
      WHERE d.id IS NULL
    `);
    
    if (orphanedClusters.rows.length > 0) {
      console.log('WARNING: Found clusters without matching divisions:', orphanedClusters.rows);
    } else {
      console.log('All clusters have valid division references');
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await pool.end();
  }
}

checkDatabase(); 