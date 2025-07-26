const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./forecast-jobs.db');

db.get('SELECT COUNT(*) as count FROM optimization_jobs', (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Total optimization jobs:', row.count);
  }
  
  db.get('SELECT COUNT(*) as count FROM optimization_jobs WHERE data LIKE "%1751378378803%"', (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Optimization jobs for new dataset:', row.count);
    }
    
    db.get('SELECT COUNT(*) as count FROM optimization_jobs WHERE status = "completed"', (err, row) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('Completed optimization jobs:', row.count);
      }
      db.close();
    });
  });
}); 