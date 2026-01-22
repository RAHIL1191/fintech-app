require('dotenv').config();
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Check environment to determine DB type, similar to manager logic or just try both/one.
// Since we have separate scripts for PG, let's make this one handle both if possible or just PG if that's the primary target for "Production" features. 
// But local dev uses SQLite? The user has `backend/data.db`.
// Let's try to detect or just run for both safely.

const isPostgres = !!process.env.DATABASE_URL;

async function runPostgres() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('PG: Adding end_date to budgets table...');
        await pool.query('ALTER TABLE budgets ADD COLUMN end_date TEXT DEFAULT NULL');
        console.log('PG: Done!');
    } catch (err) {
        console.log('PG: ' + err.message); // Might already exist
    } finally {
        await pool.end();
    }
}

function runSqlite() {
    const dbPath = path.resolve(__dirname, 'data.db');
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        console.log('SQLite: Adding end_date to budgets table...');
        db.run('ALTER TABLE budgets ADD COLUMN end_date TEXT DEFAULT NULL', (err) => {
            if (err) {
                console.log('SQLite: ' + err.message);
            } else {
                console.log('SQLite: Done!');
            }
        });
    });
    db.close();
}

(async () => {
    if (isPostgres) {
        await runPostgres();
    }
    // Always run SQLite locally if file exists
    if (require('fs').existsSync(path.resolve(__dirname, 'data.db'))) {
        runSqlite();
    }
})();
