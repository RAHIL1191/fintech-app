require('dotenv').config({ path: '../.env' }); // try root .env
const db = require('./src/database');

async function checkTransaction() {
    await db.manager.init();

    try {
        const txs = await db.manager.getManualTransactions();
        console.log(`Found ${txs.length} manual transactions.`);

        txs.forEach(t => {
            console.log(`ID: ${t.transaction_id} | Splits: ${t.splits ? 'YES' : 'NO'}`);
            if (t.transaction_id.includes('1766698830874')) {
                console.log('--- FOUND TARGET ---');
                console.log(JSON.stringify(t, null, 2));
            }
        });

    } catch (e) {
        console.error(e);
    }
}

checkTransaction();
