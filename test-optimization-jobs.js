import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath);

console.log('Checking optimization jobs in database...\n');

// Check all jobs
db.all("SELECT id, sku, method, status, createdAt, completedAt FROM jobs ORDER BY createdAt DESC LIMIT 10", [], (err, rows) => {
  if (err) {
    console.error('Error querying jobs:', err);
    return;
  }
  
  console.log(`Found ${rows.length} total jobs:`);
  rows.forEach(row => {
    console.log(`  - Job ${row.id}: ${row.sku} (${row.method}) - Status: ${row.status} - Created: ${row.createdAt}`);
  });
  
  // Check completed jobs specifically
  db.all("SELECT COUNT(*) as count FROM jobs WHERE status = 'completed'", [], (err, completedRows) => {
    if (err) {
      console.error('Error querying completed jobs:', err);
    } else {
      console.log(`\nCompleted jobs: ${completedRows[0].count}`);
    }
    
    // Check jobs with results
    db.all("SELECT COUNT(*) as count FROM jobs WHERE status = 'completed' AND result IS NOT NULL", [], (err, resultRows) => {
      if (err) {
        console.error('Error querying jobs with results:', err);
      } else {
        console.log(`Jobs with results: ${resultRows[0].count}`);
      }
      
      db.close();
    });
  });
}); 