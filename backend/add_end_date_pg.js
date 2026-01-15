require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Adding recurrence_end_date to bills table...');
        await pool.query('ALTER TABLE bills ADD COLUMN recurrence_end_date TEXT DEFAULT NULL');
        console.log('Done!');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

run();
