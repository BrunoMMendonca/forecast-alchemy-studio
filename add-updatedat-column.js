import sqlite3 from 'sqlite3';

const dbPath = 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath);

console.log('Adding updatedAt column to existing jobs table...');

// Add the updatedAt column to the existing jobs table (without default)
db.run(`
  ALTER TABLE jobs 
  ADD COLUMN updatedAt DATETIME
`, function(err) {
  if (err) {
    console.error('Error adding updatedAt column:', err);
  } else {
    console.log('Successfully added updatedAt column to jobs table');
  }
  
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
}); 