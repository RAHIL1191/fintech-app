const db = require('./src/database');
const path = require('path');
require('dotenv').config();

const run = async () => {
    // --- CONFIGURATION ---
    // REPLACE THIS WITH YOUR REAL ACCESS TOKEN
    const ACCESS_TOKEN = 'access-production-eaa6a307-0de3-4d4b-ba64-4405fc897a06';
    const INSTITUTION_NAME = 'CIBC';
    // ---------------------

    try {
        await db.init();
        const itemId = `imported_item_${Date.now()}`; // Generate a unique item ID

        console.log(`Adding token: ${ACCESS_TOKEN.substring(0, 10)}...`);

        await db.upsertPlaidItem(itemId, ACCESS_TOKEN, INSTITUTION_NAME);

        console.log('✅ Token successfully added to database!');
        console.log('You can now restart the backend or refresh the app to see the accounts.');

    } catch (error) {
        console.error('❌ Error adding token:', error);
    }
};

run();
