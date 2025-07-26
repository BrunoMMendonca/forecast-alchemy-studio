import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
});

async function resetSetupStatus() {
  try {
    console.log('Resetting setup status...\n');
    
    // Check current state
    const currentState = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM divisions WHERE company_id = 1) as division_count,
        (SELECT COUNT(*) FROM clusters WHERE company_id = 1) as cluster_count
    `);
    
    console.log('Current state:');
    console.log(`  Divisions: ${currentState.rows[0].division_count}`);
    console.log(`  Clusters: ${currentState.rows[0].cluster_count}`);
    
    // Remove extra divisions (keep only the first one)
    const extraDivisions = await pool.query(`
      DELETE FROM divisions 
      WHERE company_id = 1 
      AND id NOT IN (
        SELECT id FROM divisions WHERE company_id = 1 ORDER BY id LIMIT 1
      )
      RETURNING id, name
    `);
    
    console.log(`\nRemoved ${extraDivisions.rowCount} extra divisions:`, 
      extraDivisions.rows.map(d => d.name));
    
    // Remove extra clusters (keep only the first one)
    const extraClusters = await pool.query(`
      DELETE FROM clusters 
      WHERE company_id = 1 
      AND id NOT IN (
        SELECT id FROM clusters WHERE company_id = 1 ORDER BY id LIMIT 1
      )
      RETURNING id, name
    `);
    
    console.log(`\nRemoved ${extraClusters.rowCount} extra clusters:`, 
      extraClusters.rows.map(c => c.name));
    
    // Check final state
    const finalState = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM divisions WHERE company_id = 1) as division_count,
        (SELECT COUNT(*) FROM clusters WHERE company_id = 1) as cluster_count
    `);
    
    console.log('\nFinal state:');
    console.log(`  Divisions: ${finalState.rows[0].division_count}`);
    console.log(`  Clusters: ${finalState.rows[0].cluster_count}`);
    
    const hasCustomSetup = finalState.rows[0].division_count > 1 || finalState.rows[0].cluster_count > 1;
    console.log(`\nSetup required: ${!hasCustomSetup}`);
    
    if (!hasCustomSetup) {
      console.log('✅ Setup status reset successfully! Setup wizard should now be accessible.');
    } else {
      console.log('❌ Setup still considered complete. Manual cleanup may be needed.');
    }
    
  } catch (error) {
    console.error('Error resetting setup status:', error);
  } finally {
    await pool.end();
  }
}

resetSetupStatus(); 