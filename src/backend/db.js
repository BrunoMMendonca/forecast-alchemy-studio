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
    });
});

export { db, dbReady };
