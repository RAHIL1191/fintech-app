require('dotenv').config();
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("DATABASE_URL is not defined in .env");
    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log("Connecting to Postgres...");
        const client = await pool.connect();

        console.log("Checking bill_exceptions table...");

        // Check if column exists
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='bill_exceptions' AND column_name='note'
        `);

        if (res.rows.length === 0) {
            console.log("Adding 'note' column to bill_exceptions...");
            await client.query("ALTER TABLE bill_exceptions ADD COLUMN note TEXT");
            console.log("Success: Added 'note' column.");
        } else {
            console.log("Column 'note' already exists.");
        }

        client.release();
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrate();
