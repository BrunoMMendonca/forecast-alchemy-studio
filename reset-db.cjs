#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Database connection (you'll need to update these values)
const { Pool } = require('pg');

// Read database configuration from environment or use defaults
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'forecast_jobs',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password_here'
});

async function resetDatabase() {
  console.log('🧹 Database Reset Tool');
  console.log('=' .repeat(50));
  
  try {
    // Read the SQL reset script
    const sqlPath = path.join(__dirname, 'reset-test-database.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📖 Reading reset script...');
    console.log('🔍 Connecting to database...');
    
    // Connect to database
    const client = await pool.connect();
    
    console.log('✅ Connected to database');
    console.log('🗑️  Starting database reset...');
    
    // Execute the reset script
    await client.query(sqlScript);
    
    console.log('✅ Database reset completed successfully!');
    
    // Show final counts
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM companies) as companies,
        (SELECT COUNT(*) FROM divisions) as divisions,
        (SELECT COUNT(*) FROM clusters) as clusters,
        (SELECT COUNT(*) FROM sop_cycles) as sop_cycles,
        (SELECT COUNT(*) FROM datasets) as datasets,
        (SELECT COUNT(*) FROM optimization_jobs) as optimization_jobs
    `);
    
    const counts = result.rows[0];
    console.log('\n📊 Final Database Status:');
    console.log(`   👥 Users: ${counts.users}`);
    console.log(`   🏢 Companies: ${counts.companies}`);
    console.log(`   🏭 Divisions: ${counts.divisions}`);
    console.log(`   🌍 Clusters: ${counts.clusters}`);
    console.log(`   📅 S&OP Cycles: ${counts.sop_cycles}`);
    console.log(`   📊 Datasets: ${counts.datasets}`);
    console.log(`   ⚙️  Optimization Jobs: ${counts.optimization_jobs}`);
    
    client.release();
    
  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    console.error('💡 Make sure:');
    console.error('   1. Your database is running');
    console.error('   2. Database credentials are correct');
    console.error('   3. You have permission to delete data');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Add confirmation prompt
async function confirmReset() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\n⚠️  WARNING: This will delete ALL test data from your database!\nAre you sure you want to continue? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Main execution
async function main() {
  const confirmed = await confirmReset();
  
  if (confirmed) {
    await resetDatabase();
    console.log('\n🎉 Database reset completed! You can now run your tests with a clean database.');
  } else {
    console.log('❌ Database reset cancelled.');
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Database reset cancelled.');
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
}); 