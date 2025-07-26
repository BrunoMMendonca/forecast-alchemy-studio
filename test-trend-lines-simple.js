// Simple test to check trend lines in the database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'forecast-jobs.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking trend lines in database...\n');

db.all("SELECT * FROM trend_lines LIMIT 10", [], (err, rows) => {
  if (err) {
    console.error('Error querying trend lines:', err);
    return;
  }
  
  console.log(`Found ${rows.length} trend lines:\n`);
  
  rows.forEach((row, index) => {
    console.log(`Trend Line ${index + 1}:`);
    console.log(`  ID: ${row.id}`);
    console.log(`  File Path: ${row.file_path}`);
    console.log(`  SKU: ${row.sku}`);
    console.log(`  Start Date: "${row.start_date}"`);
    console.log(`  End Date: "${row.end_date}"`);
    console.log(`  Start Value: ${row.start_value}`);
    console.log(`  End Value: ${row.end_value}`);
    
    // Test date validation
    const startDate = new Date(row.start_date);
    const endDate = new Date(row.end_date);
    const startValid = !isNaN(startDate.getTime());
    const endValid = !isNaN(endDate.getTime());
    
    console.log(`  Start Date Valid: ${startValid} (${startDate})`);
    console.log(`  End Date Valid: ${endValid} (${endDate})`);
    console.log('');
  });
  
  db.close();
}); 