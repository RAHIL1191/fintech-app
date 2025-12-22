const db = require('./src/database');
const path = require('path');
require('dotenv').config();

const run = async () => {
    // --- ADD YOUR TOKENS HERE ---
    const TOKENS_TO_ADD = [
        { token: 'access-production-YOUR_TANGERINE_TOKEN', name: 'Tangerine' },
        { token: 'access-production-YOUR_BMO_TOKEN', name: 'BMO' },
    ];
    // ----------------------------

    try {
        await db.init();

        for (const item of TOKENS_TO_ADD) {
            if (item.token.includes('YOUR_ACCESS_TOKEN')) continue; // Skip placeholders

            const itemId = `manual_item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            console.log(`Adding token for ${item.name}...`);
            await db.upsertPlaidItem(itemId, item.token, item.name);
        }

        console.log('✅ All tokens successfully added to local database!');
        console.log('Now you can run "node migrate_to_neon.js" to upload everything to the cloud!');

    } catch (error) {
        console.error('❌ Error:', error);
    }
};

run();
