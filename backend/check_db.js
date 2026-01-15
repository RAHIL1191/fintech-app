const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);
const logFile = path.resolve(__dirname, 'migration_result.txt');

db.all("PRAGMA table_info(bill_exceptions)", (err, rows) => {
    let msg = "";
    if (err) {
        msg = "Error: " + err.message;
    } else {
        msg = "Columns: " + JSON.stringify(rows.map(r => r.name));
    }
    fs.writeFileSync(logFile, msg);
    console.log(msg);
    db.close();
});
