import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath);

console.log('Updating existing jobs with updatedAt field...');

// Update existing jobs to have updatedAt = createdAt
db.run(`
  UPDATE jobs 
  SET updatedAt = createdAt 
  WHERE updatedAt IS NULL OR updatedAt = ''
`, function(err) {
  if (err) {
    console.error('Error updating jobs:', err);
  } else {
    console.log(`Updated ${this.changes} existing jobs with updatedAt field`);
  }
  
  // Close the database
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database updated successfully');
    }
  });
}); 