const db = require('./src/database');

async function check() {
    await db.init();
    const metadata = await db.getTransactionMetadataMap();
    console.log('Transaction Metadata entries:', Object.keys(metadata).length);
    const transfers = Object.values(metadata).filter(m => m.is_transfer === 1);
    console.log('Manually marked transfers in DB:', transfers.length);
    transfers.forEach(t => {
        console.log(`- ID: ${t.transaction_id}, Merchant: ${t.merchant_name}, IsTransfer: ${t.is_transfer}`);
    });
    process.exit(0);
}

check();
