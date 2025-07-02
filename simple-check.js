const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./forecast-jobs.db');

db.get('SELECT COUNT(*) as count FROM jobs', (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Total jobs:', row.count);
  }
  
  db.get('SELECT COUNT(*) as count FROM jobs WHERE data LIKE "%1751378378803%"', (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Jobs for new dataset:', row.count);
    }
    
    db.get('SELECT COUNT(*) as count FROM jobs WHERE status = "completed"', (err, row) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('Completed jobs:', row.count);
      }
      db.close();
    });
  });
}); 