import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath);

console.log('Checking CSV separator setting in backend database...\n');

db.get("SELECT key, value, updatedAt FROM settings WHERE key = 'global_csvSeparator'", [], (err, row) => {
  if (err) {
    console.error('Error querying settings:', err);
    return;
  }
  
  if (row) {
    console.log(`✅ Found CSV separator setting:`);
    console.log(`   Key: ${row.key}`);
    console.log(`   Value: ${row.value}`);
    console.log(`   Last Updated: ${row.updatedAt}`);
    
    try {
      const parsedValue = JSON.parse(row.value);
      console.log(`   Parsed Value: "${parsedValue}"`);
    } catch (e) {
      console.log(`   Parse Error: ${e.message}`);
    }
  } else {
    console.log('❌ No CSV separator setting found in database');
  }
  
  // Also check all global settings
  console.log('\n--- All Global Settings ---');
  db.all("SELECT key, value, updatedAt FROM settings WHERE key LIKE 'global_%' ORDER BY key", [], (err, rows) => {
    if (err) {
      console.error('Error querying all settings:', err);
    } else {
      rows.forEach(row => {
        console.log(`   ${row.key}: ${row.value} (${row.updatedAt})`);
      });
    }
    db.close();
  });
}); 