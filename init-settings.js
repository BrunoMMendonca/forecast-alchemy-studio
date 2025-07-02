import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath);

console.log('Initializing default backend settings...\n');

// Function to initialize default settings
function initializeDefaultSettings() {
    const defaultSettings = [
        {
            key: 'global_frequency',
            value: JSON.stringify('monthly'),
            description: 'Data frequency (daily, weekly, monthly, quarterly, yearly)'
        },
        {
            key: 'global_seasonalPeriods',
            value: JSON.stringify(12),
            description: 'Number of periods in each season'
        },
        {
            key: 'global_autoDetectFrequency',
            value: JSON.stringify(true),
            description: 'Whether to automatically detect frequency from dataset'
        },
        {
            key: 'global_csvSeparator',
            value: JSON.stringify(','),
            description: 'Default CSV separator for import/export'
        }
    ];

    let completed = 0;
    let hasError = false;

    console.log('Creating settings table if it doesn\'t exist...');
    
    // First ensure the settings table exists
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating settings table:', err);
            process.exit(1);
        }
        
        console.log('Settings table ready. Inserting default settings...\n');
        
        defaultSettings.forEach(setting => {
            db.run(
                "INSERT OR IGNORE INTO settings (key, value, description, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                [setting.key, setting.value, setting.description],
                (err) => {
                    if (err) {
                        console.error(`❌ Error initializing setting ${setting.key}:`, err);
                        hasError = true;
                    } else {
                        console.log(`✅ Initialized: ${setting.key} = ${setting.value}`);
                    }
                    completed++;
                    
                    if (completed === defaultSettings.length) {
                        if (hasError) {
                            console.error('\n❌ Some default settings failed to initialize');
                        } else {
                            console.log('\n✅ All default settings initialized successfully!');
                        }
                        
                        // Verify the settings were created
                        console.log('\nVerifying settings...');
                        db.all("SELECT key, value, description FROM settings WHERE key LIKE 'global_%'", [], (err, rows) => {
                            if (err) {
                                console.error('Error verifying settings:', err);
                            } else {
                                console.log(`Found ${rows.length} settings in database:`);
                                rows.forEach(row => {
                                    console.log(`  - ${row.key}: ${row.value}`);
                                });
                            }
                            db.close(() => process.exit(0));
                        });
                    }
                }
            );
        });
    });
}

// Run the initialization
initializeDefaultSettings(); 