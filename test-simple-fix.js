const { Client } = require('pg');

async function applySimpleFix() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'forecast_jobs',
    user: 'postgres',
    password: 'your_password_here' // Replace with your actual password
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Drop the audit trigger from datasets table
    const dropTriggerQuery = 'DROP TRIGGER IF EXISTS audit_datasets_changes ON datasets;';
    await client.query(dropTriggerQuery);
    console.log('✅ Dropped audit trigger from datasets table');

    // Verify the trigger was removed
    const verifyQuery = `
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE event_object_table = 'datasets' AND trigger_name = 'audit_datasets_changes';
    `;
    const result = await client.query(verifyQuery);
    
    if (result.rows.length === 0) {
      console.log('✅ Audit trigger successfully removed from datasets table');
    } else {
      console.log('❌ Audit trigger still exists:', result.rows);
    }

  } catch (error) {
    console.error('❌ Error applying fix:', error.message);
  } finally {
    await client.end();
  }
}

applySimpleFix(); 