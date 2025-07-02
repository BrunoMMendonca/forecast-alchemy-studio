import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath);

console.log('Testing backend settings initialization...\n');

// Test function to check if settings exist
function checkSettings() {
  console.log('Checking current settings in database...');
  
  db.all("SELECT key, value, description FROM settings WHERE key LIKE 'global_%'", [], (err, rows) => {
    if (err) {
      console.error('Error querying settings:', err);
      return;
    }
    
    if (rows.length === 0) {
      console.log('❌ No global settings found in database');
      console.log('This means the initialization function needs to be called');
    } else {
      console.log(`✅ Found ${rows.length} global settings:`);
      rows.forEach(row => {
        console.log(`  - ${row.key}: ${row.value} (${row.description})`);
      });
    }
    
    // Check specifically for CSV separator
    const csvSetting = rows.find(row => row.key === 'global_csvSeparator');
    if (csvSetting) {
      console.log(`\n✅ CSV Separator setting found: ${csvSetting.value}`);
    } else {
      console.log('\n❌ CSV Separator setting not found');
    }
    
    db.close();
  });
}

// Run the test
checkSettings(); 