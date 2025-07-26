import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pgPool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const client = await pgPool.connect();
    console.log('✅ Database connection successful');
    
    // Check company 49 specifically
    console.log('\n=== Checking Company 49 ===');
    const company49Result = await client.query('SELECT id, name, setup_completed, setup_wizard_accessible FROM companies WHERE id = 49');
    
    if (company49Result.rows.length === 0) {
      console.log('❌ Company 49 not found!');
    } else {
      console.log('✅ Company 49 found:', company49Result.rows[0]);
    }
    
    // Check divisions for company 49
    const divisions49Result = await client.query('SELECT id, name, description FROM divisions WHERE company_id = 49');
    console.log(`\nDivisions for company 49: ${divisions49Result.rows.length}`);
    if (divisions49Result.rows.length > 0) {
      console.log('Divisions:', divisions49Result.rows);
    }
    
    // Check clusters for company 49
    const clusters49Result = await client.query('SELECT id, name, description, division_id FROM clusters WHERE company_id = 49');
    console.log(`\nClusters for company 49: ${clusters49Result.rows.length}`);
    if (clusters49Result.rows.length > 0) {
      console.log('Clusters:', clusters49Result.rows);
    }
    
    // Check users for company 49
    const users49Result = await client.query('SELECT id, username, email, company_id FROM users WHERE company_id = 49');
    console.log(`\nUsers for company 49: ${users49Result.rows.length}`);
    if (users49Result.rows.length > 0) {
      console.log('Users:', users49Result.rows);
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pgPool.end();
  }
}

testDatabase(); 