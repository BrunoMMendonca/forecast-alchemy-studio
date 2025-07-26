const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'forecast_alchemy',
  user: 'postgres',
  password: 'password'
});

async function checkJobs() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM optimization_jobs');
    console.log('Jobs count:', result.rows[0].count);
    
    if (result.rows[0].count > 0) {
      const jobs = await pool.query('SELECT * FROM optimization_jobs LIMIT 5');
      console.log('Sample jobs:', jobs.rows);
    }
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await pool.end();
  }
}

checkJobs(); 