import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
});

async function addSetupCompletedColumn() {
  try {
    console.log('Adding setup_completed column to companies table...\n');
    
    // Add the column
    await pool.query(`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE
    `);
    console.log('✅ Column added successfully');
    
    // Update existing companies to have setup_completed = false
    const updateResult = await pool.query(`
      UPDATE companies 
      SET setup_completed = FALSE 
      WHERE setup_completed IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} existing companies`);
    
    // Add comment
    await pool.query(`
      COMMENT ON COLUMN companies.setup_completed IS 'Indicates whether the company has completed the initial setup wizard'
    `);
    console.log('✅ Comment added successfully');
    
    // Verify the column exists
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'setup_completed'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n✅ Verification successful:');
      console.log(`  Column: ${verifyResult.rows[0].column_name}`);
      console.log(`  Type: ${verifyResult.rows[0].data_type}`);
      console.log(`  Nullable: ${verifyResult.rows[0].is_nullable}`);
      console.log(`  Default: ${verifyResult.rows[0].column_default}`);
    }
    
    // Show current companies and their setup status
    const companiesResult = await pool.query(`
      SELECT id, name, setup_completed 
      FROM companies 
      ORDER BY id
    `);
    
    console.log('\n📋 Current companies setup status:');
    companiesResult.rows.forEach(company => {
      console.log(`  Company ${company.id} (${company.name}): setup_completed = ${company.setup_completed}`);
    });
    
  } catch (error) {
    console.error('❌ Error adding setup_completed column:', error);
  } finally {
    await pool.end();
  }
}

addSetupCompletedColumn(); 