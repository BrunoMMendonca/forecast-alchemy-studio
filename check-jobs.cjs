const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./forecast-jobs.db');

const filePath = 'uploads/Original_CSV_Upload-1751379026335-e6e71ef3-processed.json';
const sku = '95000000';

console.log('Checking jobs in database for filePath and SKU...');

db.all('SELECT id, sku, method, status, modelId, result FROM jobs WHERE data LIKE ? AND sku = ? ORDER BY createdAt DESC LIMIT 10', [
  `%${filePath}%`, sku
], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  console.log(`Found ${rows.length} jobs for filePath=${filePath} and sku=${sku}`);
  rows.forEach(row => {
    console.log(`- Job ${row.id}: Model=${row.modelId}, Status=${row.status}, Method=${row.method}`);
    if (row.result) {
      try {
        const result = JSON.parse(row.result);
        if (result.results && Array.isArray(result.results)) {
          result.results.forEach((modelResult, i) => {
            console.log(`  ModelResult[${i}]: modelType=${modelResult.modelType}, success=${modelResult.success}, accuracy=${modelResult.accuracy}`);
          });
        } else {
          console.log('  result:', result);
        }
      } catch (e) {
        console.log('  Could not parse result JSON');
      }
    } else {
      console.log('  No result');
    }
  });
  db.close();
});

console.log('Checking jobs in database...');

// Check total jobs
db.all('SELECT COUNT(*) as count FROM jobs', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Total jobs:', rows[0].count);
  }
  
  // Check jobs for the new dataset
  db.all('SELECT id, sku, method, status, modelId, data FROM jobs WHERE data LIKE "%1751378378803%" ORDER BY createdAt DESC LIMIT 10', (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Jobs for new dataset (1751378378803):', rows.length);
      rows.forEach(row => {
        console.log(`- Job ${row.id}: SKU=${row.sku}, Method=${row.method}, Status=${row.status}, Model=${row.modelId}`);
        if (row.data) {
          try {
            const data = JSON.parse(row.data);
            console.log(`  Data: filePath=${data.filePath}`);
          } catch (e) {
            console.log(`  Data: ${row.data.substring(0, 100)}...`);
          }
        }
      });
    }
    
    // Check completed jobs
    db.all('SELECT COUNT(*) as count FROM jobs WHERE status = "completed"', (err, rows) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('Completed jobs:', rows[0].count);
      }
      db.close();
    });
  });
}); 