const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DB_PATH = path.join(__dirname, 'data.db');
const NEON_URL = process.env.DATABASE_URL;

async function migrate() {
    if (!NEON_URL) {
        console.error('Error: DATABASE_URL not found in .env');
        return;
    }

    console.log('--- Starting Migration ---');

    // 1. Connect to SQLite
    const sqliteDb = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    // 2. Connect to Neon
    const pool = new Pool({
        connectionString: NEON_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 3. Fetch Items from SQLite
        const items = await sqliteDb.all('SELECT * FROM plaid_items');
        console.log(`Found ${items.length} Plaid items in local database.`);

        if (items.length === 0) {
            console.log('Nothing to migrate.');
            return;
        }

        // 4. Insert into Neon
        for (const item of items) {
            console.log(`Migrating: ${item.institution_name} (${item.item_id})...`);

            const sql = `
                INSERT INTO plaid_items (item_id, access_token, institution_name, created_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT(item_id) DO UPDATE SET
                    access_token = EXCLUDED.access_token,
                    institution_name = EXCLUDED.institution_name
            `;

            await pool.query(sql, [
                item.item_id,
                item.access_token,
                item.institution_name,
                item.created_at || new Date().toISOString()
            ]);
        }

        // 5. Migrate Metadata (optional but helpful)
        const metadata = await sqliteDb.all('SELECT * FROM transaction_metadata');
        console.log(`Found ${metadata.length} transaction custom labels/notes.`);

        for (const m of metadata) {
            const sql = `
                INSERT INTO transaction_metadata 
                (transaction_id, category, merchant_name, account_id, date, note, recurring_frequency, is_transfer, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT(transaction_id) DO NOTHING
            `;
            await pool.query(sql, [
                m.transaction_id, m.category, m.merchant_name, m.account_id,
                m.date, m.note, m.recurring_frequency, m.is_transfer, m.updated_at
            ]);
        }

        // 6. Migrate Cached Accounts (This fixes the blank Accounts tab!)
        const cachedAccounts = await sqliteDb.all('SELECT * FROM cached_accounts');
        console.log(`Found ${cachedAccounts.length} cached accounts (balances/details).`);

        for (const acc of cachedAccounts) {
            const sql = `
                INSERT INTO cached_accounts 
                (account_id, item_id, name, mask, official_name, type, subtype, current_balance, iso_currency_code, last_updated_datetime, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT(account_id) DO UPDATE SET
                    current_balance = EXCLUDED.current_balance,
                    last_updated_datetime = EXCLUDED.last_updated_datetime,
                    updated_at = EXCLUDED.updated_at
            `;
            await pool.query(sql, [
                acc.account_id, acc.item_id, acc.name, acc.mask, acc.official_name,
                acc.type, acc.subtype, acc.current_balance, acc.iso_currency_code,
                acc.last_updated_datetime, acc.updated_at || new Date().toISOString()
            ]);
        }

        console.log('--- Migration Successful! ---');
        console.log('Your mobile app should now show your accounts and transactions after a refresh.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sqliteDb.close();
        await pool.end();
    }
}

migrate();
function convertPlaceholders(sql) {
    let count = 1;
    return sql.replace(/\?/g, () => `$${count++}`);
}
