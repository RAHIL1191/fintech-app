const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cached_transactions'
        `);
        console.log('--- Columns in cached_transactions ---');
        console.table(res.rows);

        // Try to add it explicitly and see the error
        console.log('\n--- Attempting manual migration ---');
        await pool.query('ALTER TABLE cached_transactions ADD COLUMN IF NOT EXISTS personal_finance_category TEXT');
        console.log('Success: personal_finance_category added.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
