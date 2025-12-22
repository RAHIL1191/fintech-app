const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const db = require('./src/database');
require('dotenv').config();

const configuration = new Configuration({
    basePath: PlaidEnvironments.production,
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
        },
    },
});

const client = new PlaidApi(configuration);

async function testSync() {
    try {
        await db.init();
        const items = await db.getAllPlaidItems();
        console.log(`Checking ${items.length} items...`);

        for (const item of items) {
            console.log(`Testing: ${item.institution_name} (${item.item_id})`);
            try {
                const response = await client.transactionsGet({
                    access_token: item.access_token,
                    start_date: '2024-12-01',
                    end_date: '2025-12-01',
                    options: { count: 5 }
                });
                console.log(`✅ Success! Fetched ${response.data.transactions.length} transactions.`);
                if (response.data.transactions.length > 0) {
                    const tx = response.data.transactions[0];
                    console.log('Sample Category:', tx.category);
                    console.log('Sample PF Category:', tx.personal_finance_category);
                }
            } catch (err) {
                console.error(`❌ Failed: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
            }
        }
    } catch (err) {
        console.error('Init failed:', err);
    } finally {
        process.exit();
    }
}

testSync();
