import { pgPool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
  try {
    console.log('Initializing PostgreSQL database...');
    
    // Read the schema SQL file
    const schemaPath = path.join(__dirname, 'init-postgres-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    
    // Execute the schema
    await pgPool.query(schemaSQL);
    
    console.log('✅ PostgreSQL database schema initialized successfully!');
    
    // Test the connection
    const result = await pgPool.query('SELECT NOW() as current_time');
    console.log('Database connection test successful:', result.rows[0]);
    
  } catch (error) {
    console.error('❌ Error initializing PostgreSQL database:', error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Run if this file is executed directly
console.log('Script started, checking execution condition...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  initializeDatabase();
}

export { initializeDatabase }; 