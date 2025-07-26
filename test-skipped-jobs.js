const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./forecast-jobs.db');

db.all('SELECT id, sku, batchId, filePath, modelId, method, status, createdAt, optimizationId FROM optimization_jobs WHERE status = "skipped"', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Skipped optimization jobs:');
    console.table(rows);
  }
  db.close();
}); 
const db = new sqlite3.Database('./forecast-jobs.db');

db.all('SELECT id, sku, batchId, filePath, modelId, method, status, createdAt, optimizationId FROM optimization_jobs WHERE status = "skipped"', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Skipped optimization jobs:');
    console.table(rows);
  }
  db.close();
}); 