const db = require('./src/database');

const run = async () => {
    try {
        await db.init();
        const items = await db.getAllPlaidItems();

        let targetItem = null;
        for (const item of items) {
            if (item.access_token.includes('production')) {
                targetItem = item;
                break;
            }
        }

        if (!targetItem) {
            console.log('No production item found to seed.');
            // Fallback: take the first non-legacy one
            if (items.length > 0) targetItem = items[0];
        }

        if (targetItem) {
            console.log(`Seeding placeholder for Item ID: ${targetItem.item_id} (${targetItem.institution_name})`);

            const placeholderAccount = [{
                account_id: 'repair-placeholder-' + Date.now(),
                name: 'Action Required',
                mask: '****',
                official_name: 'Connection Needs Repair',
                type: 'depository',
                subtype: 'checking',
                balances: {
                    current: 0,
                    iso_currency_code: 'USD'
                }
            }];

            await db.upsertAccounts(placeholderAccount, targetItem.item_id);
            console.log('Success! Placeholder account created. Refresh the app.');
        } else {
            console.error('No items found in DB at all.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
};

run();
