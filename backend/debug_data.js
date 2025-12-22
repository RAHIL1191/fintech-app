const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query('SELECT transaction_id, name, category, personal_finance_category FROM cached_transactions LIMIT 10');
        console.log('--- Transactions in DB ---');
        console.table(res.rows);

        const countRes = await pool.query('SELECT COUNT(*) as total, COUNT(personal_finance_category) as has_pf FROM cached_transactions');
        console.log('\n--- Stats ---');
        console.table(countRes.rows);
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await pool.end();
    }
}

check();
