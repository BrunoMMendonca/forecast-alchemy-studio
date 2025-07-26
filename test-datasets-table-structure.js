const { Client } = require('pg');

async function checkDatasetsTable() {
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

    // Check the columns in datasets table
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'datasets' 
      ORDER BY ordinal_position;
    `;
    const columnsResult = await client.query(columnsQuery);
    console.log('📋 Datasets table columns:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });

    // Check if uploaded_by or created_by exists
    const specificColumnsQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'datasets' 
      AND column_name IN ('uploaded_by', 'created_by')
      ORDER BY column_name;
    `;
    const specificResult = await client.query(specificColumnsQuery);
    console.log('\n🔍 Specific columns check:');
    if (specificResult.rows.length === 0) {
      console.log('  ❌ Neither uploaded_by nor created_by found');
    } else {
      specificResult.rows.forEach(row => {
        console.log(`  ✅ Found: ${row.column_name} (${row.data_type})`);
      });
    }

    // Check the audit trigger function
    const functionQuery = `
      SELECT pg_get_functiondef(oid) as function_definition
      FROM pg_proc 
      WHERE proname = 'audit_table_changes';
    `;
    const functionResult = await client.query(functionQuery);
    console.log('\n🔧 Audit trigger function:');
    if (functionResult.rows.length > 0) {
      const funcDef = functionResult.rows[0].function_definition;
      if (funcDef.includes('uploaded_by')) {
        console.log('  ❌ Function still references uploaded_by');
      } else if (funcDef.includes('created_by')) {
        console.log('  ✅ Function uses created_by');
      } else {
        console.log('  ⚠️  Function found but no clear reference to either column');
      }
    } else {
      console.log('  ❌ Audit trigger function not found');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  } finally {
    await client.end();
  }
}

checkDatasetsTable(); 