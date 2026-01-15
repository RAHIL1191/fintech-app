const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { manager } = require('./src/database');

async function check() {
    try {
        console.log("Initializing DB...");
        await manager.init();
        console.log("DB Initialized.");

        // Check getPaidBills
        try {
            const paidBills = await manager.getPaidBills();
            console.log(`getPaidBills returned ${paidBills.length} items.`);
            if (paidBills.length > 0) {
                console.log("Found Bills:");
                paidBills.forEach(b => {
                    console.log(` - ID: ${b.transaction_id}, Date: ${b.date}, Amount: ${b.amount}, Name: ${b.name}`);
                });
            } else {
                console.log("No paid bills found in database.");
            }
        } catch (e) {
            console.error("getPaidBills failed:", e.message);
        }

    } catch (err) {
        console.error("Global Error:", err);
    }
}

check();
