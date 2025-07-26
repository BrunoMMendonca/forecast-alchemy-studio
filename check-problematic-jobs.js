import { Pool } from 'pg';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/forecast_alchemy' 
});

async function checkProblematicJobs() {
  try {
    console.log('Checking for problematic jobs...');
    
    // Find jobs with invalid result data
    const result = await pool.query(`
      SELECT id, result, status, created_at 
      FROM optimization_jobs 
      WHERE result LIKE '%[object Object]%' 
         OR result = 'undefined' 
         OR result IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ No problematic jobs found!');
      return;
    }
    
    console.log(`\n❌ Found ${result.rows.length} problematic jobs:`);
    result.rows.forEach(row => {
      console.log(`Job ${row.id}: status=${row.status}, result="${row.result}", created=${row.created_at}`);
    });
    
    // Ask if user wants to clean them up
    console.log('\nThese jobs have invalid result data that will cause worker errors.');
    console.log('You can either:');
    console.log('1. Delete them (recommended for test data)');
    console.log('2. Update them with empty JSON objects');
    console.log('3. Leave them as-is');
    
    // For now, let's just update them with empty JSON objects
    console.log('\n🔄 Updating problematic jobs with empty JSON objects...');
    
    const updateResult = await pool.query(`
      UPDATE optimization_jobs 
      SET result = '{}' 
      WHERE result LIKE '%[object Object]%' 
         OR result = 'undefined' 
         OR result IS NULL
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} jobs successfully!`);
    
  } catch (error) {
    console.error('Error checking problematic jobs:', error);
  } finally {
    await pool.end();
  }
}

checkProblematicJobs(); 