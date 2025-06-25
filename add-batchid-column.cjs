const sqlite3 = require('sqlite3').verbose();

const dbPath = 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath);

console.log('Adding batchId column to jobs table...');

// Add the batchId column to the existing jobs table
db.run(`
  ALTER TABLE jobs 
  ADD COLUMN batchId TEXT
`, function(err) {
    if (err) {
        console.error('Error adding batchId column:', err.message);
    } else {
        console.log('✅ Successfully added batchId column to jobs table');
    }
    
    // Verify the column was added
    db.all("PRAGMA table_info(jobs)", (err, rows) => {
        if (err) {
            console.error('Error checking table schema:', err);
        } else {
            console.log('\nUpdated jobs table schema:');
            rows.forEach(row => {
                console.log(`  ${row.name} (${row.type}) - ${row.notnull ? 'NOT NULL' : 'NULL'} - Default: ${row.dflt_value || 'none'}`);
            });
            
            // Check if batchId column exists
            const batchIdColumn = rows.find(row => row.name === 'batchId');
            if (batchIdColumn) {
                console.log('\n✅ batchId column now exists in jobs table');
            } else {
                console.log('\n❌ batchId column is still missing from jobs table');
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
});