require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const normalizations = [
    { from: 'Grocery', to: 'Groceries' },
    { from: 'grocery', to: 'Groceries' },
    { from: 'Restaurant', to: 'Restaurants' },
    { from: 'restaurant', to: 'Restaurants' },
    { from: 'Food And Drink Restaurant', to: 'Restaurants' },
    { from: 'Food And Drink Fast Food', to: 'Fast Food' },
    { from: 'Food And Drink Coffee', to: 'Coffee' },
    { from: 'Food And Drink Groceries', to: 'Groceries' },
    { from: 'General Merchandise', to: 'Shopping' },
    { from: 'Home Improvement', to: 'Home Improvement' },
    { from: 'Medical', to: 'Medical' },
    { from: 'Government And Non Profit', to: 'Government' },
    { from: 'General Services', to: 'Services' },
];

async function seedNormalizations() {
    try {
        console.log('Seeding category normalizations...');

        for (const norm of normalizations) {
            const result = await pool.query(
                `INSERT INTO category_normalizations (from_category, to_category) 
                 VALUES ($1, $2) 
                 ON CONFLICT (from_category) DO NOTHING`,
                [norm.from, norm.to]
            );
            if (result.rowCount > 0) {
                console.log(`✓ Added: "${norm.from}" → "${norm.to}"`);
            }
        }

        console.log('\nSeeding complete!');
        const count = await pool.query('SELECT COUNT(*) FROM category_normalizations');
        console.log(`Total normalizations: ${count.rows[0].count}`);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

seedNormalizations();
