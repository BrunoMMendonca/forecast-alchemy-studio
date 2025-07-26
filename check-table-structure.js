import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres'
});

async function checkTableStructure() {
  try {
    console.log('Checking dataset_aggregatable_field_map table structure...\n');
    
    // Check table structure
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'dataset_aggregatable_field_map'
      ORDER BY ordinal_position;
    `);
    
    console.log('Table structure:');
    console.table(structureResult.rows);
    
    // Check constraints
    const constraintResult = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'dataset_aggregatable_field_map::regclass';
    `);
    
    console.log('\nConstraints:');
    console.table(constraintResult.rows);
    
    // Check sample data
    const dataResult = await pool.query(`
      SELECT * FROM dataset_aggregatable_field_map LIMIT 5;
    `);
    
    console.log('\nSample data:');
    console.table(dataResult.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTableStructure(); 