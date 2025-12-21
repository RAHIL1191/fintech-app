const db = require('./src/database');

const run = async () => {
    try {
        await db.init();
        const items = await db.getAllPlaidItems();
        console.log('--- Stored Plaid Items ---');
        items.forEach(item => {
            console.log(`ID: ${item.item_id}`);
            console.log(`Institution: ${item.institution_name}`);
            console.log(`Token: ${item.access_token.substring(0, 15)}...`);
            console.log('--------------------------');
        });
        if (items.length === 0) {
            console.log('No items found in database.');
        }
    } catch (error) {
        console.error('Error reading DB:', error);
    }
};

run();
