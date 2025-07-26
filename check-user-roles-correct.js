import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
});

async function checkUserRoles() {
  try {
    console.log('Checking user roles in PostgreSQL database...\n');
    
    // Check the structure of both tables
    console.log('Checking table structures...');
    
    const usersTableCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nUsers table structure:');
    usersTableCheck.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    const userRolesTableCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_roles' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nUser_roles table structure:');
    userRolesTableCheck.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    console.log('\n---\n');
    
    // Check current users and their roles
    const usersResult = await pool.query(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.company_id,
        array_agg(ur.role) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      GROUP BY u.id, u.username, u.email, u.first_name, u.last_name, u.company_id
      ORDER BY u.id
    `);
    
    if (usersResult.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    console.log(`Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach(user => {
      console.log(`\nUser ID: ${user.id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.first_name} ${user.last_name}`);
      console.log(`  Roles: ${JSON.stringify(user.roles)}`);
      console.log(`  Company ID: ${user.company_id}`);
      
      // Check if user has admin roles
      const hasAdminRole = user.roles && user.roles.length > 0 && (
        user.roles.includes('company_admin') || 
        user.roles.includes('division_admin')
      );
      console.log(`  Is Admin: ${hasAdminRole ? 'Yes' : 'No'}`);
    });
    
  } catch (error) {
    console.error('Error checking user roles:', error);
  } finally {
    await pool.end();
  }
}

checkUserRoles(); 