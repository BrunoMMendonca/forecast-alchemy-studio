const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

async function checkDivisionsTable() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking divisions table structure...\n');
    
    // Check if table exists
    const tableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'divisions'
      );
    `;
    const tableExists = await client.query(tableQuery);
    console.log('Divisions table exists:', tableExists.rows[0].exists);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Divisions table does not exist!');
      return;
    }
    
    // Check columns
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'divisions'
      ORDER BY ordinal_position;
    `;
    const columns = await client.query(columnsQuery);
    
    console.log('📋 Divisions table columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check for soft delete columns
    const softDeleteColumns = ['is_active', 'deleted_at', 'deleted_by'];
    const existingColumns = columns.rows.map(col => col.column_name);
    
    console.log('\n🔍 Checking soft delete columns:');
    softDeleteColumns.forEach(col => {
      const exists = existingColumns.includes(col);
      console.log(`  - ${col}: ${exists ? '✅' : '❌'}`);
    });
    
    // Check for inactive divisions
    const inactiveQuery = `
      SELECT COUNT(*) as count 
      FROM divisions 
      WHERE is_active = false
    `;
    const inactiveCount = await client.query(inactiveQuery);
    console.log(`\n📊 Inactive divisions count: ${inactiveCount.rows[0].count}`);
    
    if (inactiveCount.rows[0].count > 0) {
      const sampleQuery = `
        SELECT id, name, is_active, deleted_at, deleted_by
        FROM divisions 
        WHERE is_active = false
        LIMIT 3
      `;
      const sample = await client.query(sampleQuery);
      console.log('\n📋 Sample inactive divisions:');
      sample.rows.forEach(div => {
        console.log(`  - ID: ${div.id}, Name: ${div.name}, Deleted: ${div.deleted_at}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking divisions table:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDivisionsTable(); 
 
 
 
 
 
 
 
 
 