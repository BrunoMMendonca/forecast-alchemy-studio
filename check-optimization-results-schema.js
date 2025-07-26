import { Pool } from 'pg';

const pgPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

async function checkOptimizationResultsSchema() {
  try {
    console.log('=== Checking optimization_results table schema ===\n');
    
    // Check if table exists
    const tableExists = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'optimization_results'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ optimization_results table does not exist');
      return;
    }
    
    console.log('✅ optimization_results table exists\n');
    
    // Get table structure
    const columns = await pgPool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns 
      WHERE table_name = 'optimization_results'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Table Structure:');
    console.log('Column Name | Data Type | Nullable | Default | Position');
    console.log('------------|-----------|----------|---------|----------');
    
    columns.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(11)} | ${col.data_type.padEnd(9)} | ${col.is_nullable.padEnd(8)} | ${(col.column_default || 'NULL').padEnd(7)} | ${col.ordinal_position}`);
    });
    
    // Get row count
    const rowCount = await pgPool.query('SELECT COUNT(*) FROM optimization_results');
    console.log(`\n📊 Total rows: ${rowCount.rows[0].count}`);
    
    // Check for sample data
    const sampleData = await pgPool.query('SELECT * FROM optimization_results LIMIT 3');
    if (sampleData.rows.length > 0) {
      console.log('\n📝 Sample data structure:');
      console.log(JSON.stringify(sampleData.rows[0], null, 2));
    }
    
    // Check indexes
    const indexes = await pgPool.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'optimization_results';
    `);
    
    console.log('\n🔍 Indexes:');
    if (indexes.rows.length > 0) {
      indexes.rows.forEach(idx => {
        console.log(`- ${idx.indexname}`);
      });
    } else {
      console.log('No indexes found');
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await pgPool.end();
  }
}

checkOptimizationResultsSchema(); 