import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || 'forecast-jobs.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Enable WAL mode to prevent database locking issues
        db.run('PRAGMA journal_mode=WAL', (err) => {
            if (err) {
                console.error('Error enabling WAL mode:', err.message);
            } else {
                console.log('WAL mode enabled successfully');
            }
        });
        
        // Set busy timeout to handle concurrent access
        db.run('PRAGMA busy_timeout=30000', (err) => {
            if (err) {
                console.error('Error setting busy timeout:', err.message);
            } else {
                console.log('Busy timeout set to 30 seconds');
            }
        });
    }
});

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

    defaultSettings.forEach(setting => {
        db.run(
            "INSERT OR IGNORE INTO settings (key, value, description, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            [setting.key, setting.value, setting.description],
            (err) => {
                if (err) {
                    console.error('Error initializing setting:', setting.key, err);
                    hasError = true;
                }
                completed++;
                
                if (completed === defaultSettings.length) {
                    if (hasError) {
                        console.error('Some default settings failed to initialize');
                    } else {
                        console.log('Default settings initialized successfully');
                    }
                }
            }
        );
    });
}

const dbReady = new Promise((resolve, reject) => {
    db.serialize(() => {
        // Organizations table
        db.run(`CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => { if (err) reject(err); });

        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organizationId INTEGER,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (organizationId) REFERENCES organizations (id)
        )`, (err) => { if (err) reject(err); });

        // Jobs table
        db.run(`CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organizationId INTEGER,
            userId TEXT,
            sku TEXT,
            modelId TEXT,
            method TEXT DEFAULT 'grid',
            payload TEXT,
            reason TEXT,
            batchId TEXT,
            status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
            progress INTEGER DEFAULT 0,
            result TEXT,
            error TEXT,
            priority INTEGER DEFAULT 1,
            data TEXT, -- Storing the full job data payload
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            startedAt DATETIME,
            completedAt DATETIME,
            FOREIGN KEY (organizationId) REFERENCES organizations (id)
        )`, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('Database schema is ready.');
                resolve();
            }
        });

        // Settings table for global application settings
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            description TEXT,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('Settings table is ready.');
                // Initialize default settings after table creation
                initializeDefaultSettings();
                resolve();
            }
        });
    });
});

export { db, dbReady };
