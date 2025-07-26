import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
});

async function checkPasswordHashes() {
  try {
    const result = await pool.query('SELECT username, email, password_hash FROM users LIMIT 10');
    console.log('Current users and their password hashes:');
    console.log('==========================================');
    result.rows.forEach(row => {
      console.log(`${row.username} (${row.email}):`);
      console.log(`  Hash: ${row.password_hash}`);
      console.log(`  Length: ${row.password_hash?.length || 0}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPasswordHashes(); 