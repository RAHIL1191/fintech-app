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

async function forceSync() {
    try {
        await db.init();
        const items = await db.getAllPlaidItems();

        for (const item of items) {
            console.log(`Syncing: ${item.institution_name}`);
            const response = await client.transactionsGet({
                access_token: item.access_token,
                start_date: '2024-01-01',
                end_date: '2025-12-31',
                options: { count: 100 }
            });
            const txs = response.data.transactions;
            console.log(`Fetched ${txs.length} transactions.`);

            await db.upsertTransactions(txs, item.item_id);
            console.log('Upsert complete.');
        }

        // Final Check
        const countRes = await db.all('SELECT COUNT(*) as total, COUNT(personal_finance_category) as has_pf FROM cached_transactions');
        console.log('Final Database Stats:', countRes[0]);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

forceSync();
