const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { manager } = require('./src/database');

const run = async () => {
    try {
        await manager.init();
        const items = await manager.getAllPlaidItems();
        console.log('\n--- PLAID ITEMS ---');
        if (items.length === 0) {
            console.log('No Plaid Items found.');
        } else {
            for (const item of items) {
                console.log(`[Item ID: ${item.item_id}]`);
                console.log(`Institution: ${item.institution_name}`);
                console.log(`Token Prefix: ${item.access_token.substring(0, 15)}...`);
                console.log(`Created: ${item.created_at}`);

                // Get Accounts for this item
                const accounts = await manager.getCachedAccountsByItem(item.item_id);
                console.log(`Accounts (${accounts.length}):`);
                accounts.forEach(acc => {
                    console.log(` - ${acc.name} (${acc.mask}) [${acc.type}/${acc.subtype}] $${acc.balances.current}`);
                });
                console.log('--------------------------');
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

run();
