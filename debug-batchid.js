import sqlite3 from 'sqlite3';

const dbPath = 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath);

console.log('Checking optimization jobs in database...');

// Check recent jobs and their batchId values
db.all(`
  SELECT id, sku, modelId, status, batchId, createdAt 
  FROM optimization_jobs 
  ORDER BY id DESC 
  LIMIT 10
`, (err, rows) => {
    if (err) {
        console.error('Error querying optimization jobs:', err);
    } else {
        console.log('Recent optimization jobs:');
        if (rows.length === 0) {
            console.log('  No optimization jobs found in database');
        } else {
            rows.forEach(row => {
                console.log(`  Job ${row.id}: SKU=${row.sku}, Model=${row.modelId}, Status=${row.status}, BatchId=${row.batchId || 'NULL'}, Created=${row.createdAt}`);
            });
        }
    }
    
    // Also check total count
    db.get('SELECT COUNT(*) as total FROM optimization_jobs', (err, row) => {
        if (err) {
            console.error('Error counting optimization jobs:', err);
        } else {
            console.log(`\nTotal optimization jobs in database: ${row.total}`);
        }
        
        // Close the database
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed');
            }
        });
    });
}); 