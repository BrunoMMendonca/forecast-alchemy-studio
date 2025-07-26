import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
});

async function resetPasswords() {
  const password = 'password123';
  const saltRounds = 12;
  
  try {
    // Get all test users
    const result = await pool.query(`
      SELECT id, username, email, password_hash 
      FROM users 
      WHERE username IN (
        'acme_owner', 'acme_admin', 'acme_manager', 'acme_analyst', 'acme_viewer',
        'techstart_admin', 'techstart_analyst', 'global_admin', 'global_viewer'
      ) OR username = 'admin' OR email LIKE '%admin%'
      ORDER BY username
    `);
    
    console.log(`Found ${result.rows.length} users to update:`);
    console.log('==========================================');
    
    for (const user of result.rows) {
      // Generate a new hash for each user (each will have its own salt)
      const newHash = await bcrypt.hash(password, saltRounds);
      
      // Update the user's password
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newHash, user.id]
      );
      
      // Verify the hash works
      const isValid = await bcrypt.compare(password, newHash);
      
      console.log(`${user.username} (${user.email}):`);
      console.log(`  Old hash length: ${user.password_hash?.length || 0}`);
      console.log(`  New hash length: ${newHash.length}`);
      console.log(`  Verification: ${isValid ? 'PASSED' : 'FAILED'}`);
      console.log('');
    }
    
    console.log('All passwords have been reset to: password123');
    console.log('Each user now has a unique bcrypt hash with their own salt.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

resetPasswords(); 