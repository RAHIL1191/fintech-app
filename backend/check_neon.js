const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const NEON_URL = process.env.DATABASE_URL;

async function check() {
    if (!NEON_URL) {
        console.error('DATABASE_URL not found');
        return;
    }

    const pool = new Pool({
        connectionString: NEON_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query('SELECT item_id, institution_name, created_at FROM plaid_items');
        console.log('--- Plaid Items in Neon ---');
        console.log(JSON.stringify(res.rows, null, 2));

        const countRes = await pool.query('SELECT COUNT(*) FROM plaid_items');
        console.log(`Total count in plaid_items: ${countRes.rows[0].count}`);

        const meta = await pool.query('SELECT count(*) FROM transaction_metadata');
        console.log(`Total metadata rows: ${meta.rows[0].count}`);

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await pool.end();
    }
}

check();
