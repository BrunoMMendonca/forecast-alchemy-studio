import sqlite3 from 'sqlite3';

const dbPath = 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath);

console.log('Checking database schema...');

// Check if the jobs table exists and get its schema
db.all("PRAGMA table_info(jobs)", (err, rows) => {
    if (err) {
        console.error('Error checking table schema:', err);
    } else {
        console.log('Jobs table schema:');
        rows.forEach(row => {
            console.log(`  ${row.name} (${row.type}) - ${row.notnull ? 'NOT NULL' : 'NULL'} - Default: ${row.dflt_value || 'none'}`);
        });
        
        // Check if batchId column exists
        const batchIdColumn = rows.find(row => row.name === 'batchId');
        if (batchIdColumn) {
            console.log('\n✅ batchId column exists in jobs table');
        } else {
            console.log('\n❌ batchId column is missing from jobs table');
        }
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