const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

function cleanMerchantName(name) {
    if (!name) return '';
    return name
        .toUpperCase()
        .replace(/[0-9#*-]/g, '') // Remove numbers, hashtags, stars, dashes
        .replace(/\s+/g, ' ')      // Normalize whitespace
        .trim();
}

const DB_PATH = path.join(__dirname, '../data.db');

class DatabaseManager {
    constructor() {
        this.db = null; // SQLite handle
        this.pool = null; // PG handle
        this.isPostgres = false;
    }

    async init() {
        const databaseUrl = process.env.DATABASE_URL;

        if (databaseUrl) {
            console.log('Database: Using PostgreSQL (Neon)');
            this.pool = new Pool({
                connectionString: databaseUrl,
                ssl: { rejectUnauthorized: false } // Required for Neon
            });
            this.isPostgres = true;
        } else {
            console.log('Database: Using SQLite local at:', DB_PATH);
            this.db = await open({
                filename: DB_PATH,
                driver: sqlite3.Database
            });
            this.isPostgres = false;
        }

        await this.createTables();
        await this.runMigrations();
        await this.seedCategories();
    }

    async runMigrations() {
        // Helper to add column if it doesn't exist
        const addColumn = async (table, column, type, defaultValue = null) => {
            if (this.isPostgres) {
                try {
                    const defaultSql = defaultValue !== null ? `DEFAULT ${defaultValue}` : '';
                    await this.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type} ${defaultSql}`);
                } catch (err) {
                    console.log(`Migration (${table}.${column}) info:`, err.message);
                }
            } else {
                try {
                    const defaultSql = defaultValue !== null ? `DEFAULT ${defaultValue}` : '';
                    await this.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} ${defaultSql}`);
                    console.log(`Migration: Added ${column} to ${table}`);
                } catch (err) {
                    // SQLite throws if column exists
                    if (!err.message.includes('duplicate column name')) {
                        // Keep console clean if it's just a duplicate column error
                        // console.log(`Migration (${table}.${column}) already applied or failed:`, err.message);
                    }
                }
            }
        };

        await addColumn('transaction_metadata', 'merchant_name', 'TEXT');
        await addColumn('transaction_metadata', 'account_id', 'TEXT');
        await addColumn('transaction_metadata', 'date', 'TEXT');
        await addColumn('transaction_metadata', 'recurring_frequency', 'TEXT');
        await addColumn('transaction_metadata', 'is_transfer', 'INTEGER', 0);
        await addColumn('transaction_metadata', 'time', 'TEXT');
        await addColumn('transaction_metadata', 'device_info', 'TEXT');
        await addColumn('transaction_metadata', 'splits', 'TEXT'); // Store as JSON string
        await addColumn('transaction_metadata', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');
        await addColumn('transaction_metadata', 'manual_budget_id', 'TEXT');
        await addColumn('transaction_metadata', 'exclude_from_budget', 'INTEGER', 0);

        // Ensure manual_transactions also has these columns
        await addColumn('manual_transactions', 'splits', 'TEXT');
        await addColumn('manual_transactions', 'device_info', 'TEXT');
        await addColumn('manual_transactions', 'recurring_frequency', 'TEXT');
        await addColumn('manual_transactions', 'manual_budget_id', 'TEXT');
        await addColumn('manual_transactions', 'exclude_from_budget', 'INTEGER', 0);

        // Add authorized_date to cached_transactions for better date accuracy
        await addColumn('cached_transactions', 'authorized_date', 'TEXT');

        // Categories migration
        await addColumn('categories', 'parent_category', 'TEXT');

        // Account metadata migration
        await addColumn('account_metadata', 'owner_name', 'TEXT');

        if (this.isPostgres) {
            try {
                await this.run('ALTER TABLE transaction_metadata ALTER COLUMN created_at TYPE TIMESTAMPTZ');
                await this.run('ALTER TABLE transaction_metadata ALTER COLUMN updated_at TYPE TIMESTAMPTZ');
                await this.run('ALTER TABLE manual_transactions ALTER COLUMN created_at TYPE TIMESTAMPTZ');
                await this.run('ALTER TABLE manual_transactions ALTER COLUMN updated_at TYPE TIMESTAMPTZ');
            } catch (e) { /* ignore */ }
        }
    }

    async createTables() {
        const queries = [
            // Transaction Metadata
            `CREATE TABLE IF NOT EXISTS transaction_metadata (
                transaction_id TEXT PRIMARY KEY,
                category TEXT,
                merchant_name TEXT,
                account_id TEXT,
                date TEXT,
                time TEXT,
                note TEXT,
                recurring_frequency TEXT,
                is_transfer ${this.isPostgres ? 'INTEGER' : 'INTEGER'} DEFAULT 0,
                device_info TEXT,
                splits TEXT,
                manual_budget_id TEXT,
                exclude_from_budget INTEGER DEFAULT 0,
                created_at ${this.isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP'} DEFAULT CURRENT_TIMESTAMP,
                updated_at ${this.isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP'} DEFAULT CURRENT_TIMESTAMP
            )`,
            // Account Metadata
            `CREATE TABLE IF NOT EXISTS account_metadata (
                account_id TEXT PRIMARY KEY,
                custom_name TEXT,
                owner_name TEXT,
                is_hidden INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Merchant Metadata
            `CREATE TABLE IF NOT EXISTS merchant_metadata (
                merchant_name TEXT PRIMARY KEY,
                category TEXT,
                logo_url TEXT,
                is_favorite INTEGER DEFAULT 0,
                is_transfer INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Categories
            `CREATE TABLE IF NOT EXISTS categories (
                id ${this.isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${this.isPostgres ? '' : 'AUTOINCREMENT'},
                name TEXT UNIQUE,
                parent_category TEXT,
                icon TEXT,
                color TEXT,
                is_custom INTEGER DEFAULT 0
            )`,
            // Category Normalizations
            `CREATE TABLE IF NOT EXISTS category_normalizations (
                id ${this.isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${this.isPostgres ? '' : 'AUTOINCREMENT'},
                from_category TEXT UNIQUE NOT NULL,
                to_category TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Plaid Items
            `CREATE TABLE IF NOT EXISTS plaid_items (
                item_id TEXT PRIMARY KEY,
                access_token TEXT NOT NULL,
                institution_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Cached Accounts
            `CREATE TABLE IF NOT EXISTS cached_accounts (
                account_id TEXT PRIMARY KEY,
                item_id TEXT,
                name TEXT,
                mask TEXT,
                official_name TEXT,
                type TEXT,
                subtype TEXT,
                current_balance REAL,
                iso_currency_code TEXT,
                last_updated_datetime TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Cached Transactions
            `CREATE TABLE IF NOT EXISTS cached_transactions (
                transaction_id TEXT PRIMARY KEY,
                account_id TEXT,
                amount REAL,
                date TEXT,
                name TEXT,
                merchant_name TEXT,
                category TEXT,
                personal_finance_category TEXT,
                pending INTEGER,
                iso_currency_code TEXT,
                item_id TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Manual Transactions
            `CREATE TABLE IF NOT EXISTS manual_transactions(
                transaction_id TEXT PRIMARY KEY,
                account_id TEXT,
                amount REAL,
                date TEXT,
                time TEXT,
                name TEXT,
                merchant_name TEXT,
                category TEXT,
                note TEXT,
                recurring_frequency TEXT,
                is_transfer INTEGER DEFAULT 0,
                device_info TEXT,
                splits TEXT,
                manual_budget_id TEXT,
                exclude_from_budget INTEGER DEFAULT 0,
                created_at ${this.isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP'} DEFAULT CURRENT_TIMESTAMP,
                updated_at ${this.isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP'} DEFAULT CURRENT_TIMESTAMP
            )`,
            // Bills
            `CREATE TABLE IF NOT EXISTS bills (
                id ${this.isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${this.isPostgres ? '' : 'AUTOINCREMENT'},
                user_id INTEGER,
                category TEXT NOT NULL,
                description TEXT,
                bill_number TEXT,
                amount REAL NOT NULL,
                account_id TEXT,
                due_date TEXT NOT NULL,
                recurrence_frequency TEXT NOT NULL,
                reminder TEXT,
                is_auto_paid INTEGER DEFAULT 0,
                add_expense_entry INTEGER DEFAULT 1,
                note TEXT,
                is_active INTEGER DEFAULT 1,
                created_at ${this.isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP'} DEFAULT CURRENT_TIMESTAMP,
                updated_at ${this.isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP'} DEFAULT CURRENT_TIMESTAMP
            )`,
            // Bill Exceptions (For single occurrence overrides)
            `CREATE TABLE IF NOT EXISTS bill_exceptions (
                id ${this.isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${this.isPostgres ? '' : 'AUTOINCREMENT'},
                bill_id INTEGER NOT NULL,
                original_date TEXT NOT NULL,
                new_amount REAL,
                note TEXT,
                is_skipped INTEGER DEFAULT 0,
                created_at ${this.isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP'} DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(bill_id) REFERENCES bills(id)
            )`,
            // Budgets
            `CREATE TABLE IF NOT EXISTS budgets (
                id ${this.isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${this.isPostgres ? '' : 'AUTOINCREMENT'},
                name TEXT NOT NULL,
                amount REAL NOT NULL,
                type TEXT, -- 'Group' or 'Personal'
                category_type TEXT, -- 'Expense' or 'Income'
                recurrence_frequency TEXT,
                start_date TEXT,
                categories TEXT, -- JSON array
                accounts TEXT, -- JSON array
                is_rollover INTEGER DEFAULT 0,
                alert_percent INTEGER DEFAULT 70,
                is_active INTEGER DEFAULT 1,
                created_at ${this.isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP'} DEFAULT CURRENT_TIMESTAMP,
                updated_at ${this.isPostgres ? 'TIMESTAMPTZ' : 'TIMESTAMP'} DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const q of queries) {
            await this.exec(q);
        }

        await this.exec(`CREATE INDEX IF NOT EXISTS idx_metadata_trans_id ON transaction_metadata(transaction_id)`);
    }

    // Helper: Execute SQL without results
    async exec(sql) {
        if (this.isPostgres) {
            return this.pool.query(sql);
        } else {
            return this.db.exec(sql);
        }
    }

    // Helper: Parameterized query
    async all(sql, params = []) {
        const querySql = this.isPostgres ? this.convertPlaceholders(sql) : sql;
        if (this.isPostgres) {
            const res = await this.pool.query(querySql, params);
            return res.rows;
        } else {
            return this.db.all(querySql, params);
        }
    }

    async get(sql, params = []) {
        const querySql = this.isPostgres ? this.convertPlaceholders(sql) : sql;
        if (this.isPostgres) {
            const res = await this.pool.query(querySql, params);
            return res.rows[0];
        } else {
            return this.db.get(querySql, params);
        }
    }

    async run(sql, params = []) {
        const querySql = this.isPostgres ? this.convertPlaceholders(sql) : sql;
        if (this.isPostgres) {
            const res = await this.pool.query(querySql, params);
            return { lastID: res.rows[0]?.id || null, changes: res.rowCount };
        } else {
            return this.db.run(querySql, params);
        }
    }

    // Convert ? to $1, $2, etc for Postgres
    convertPlaceholders(sql) {
        let index = 1;
        return sql.replace(/\?/g, () => `$${index++} `);
    }

    async seedCategories() {
        const defaultCategories = [
            { name: 'Food & Drink', icon: 'utensils', color: '#EF4444' },
            { name: 'Shopping', icon: 'shopping-bag', color: '#F59E0B' },
            { name: 'Housing', icon: 'home', color: '#10B981' },
            { name: 'Transport', icon: 'car', color: '#3B82F6' },
            { name: 'Entertainment', icon: 'film', color: '#8B5CF6' },
            { name: 'Health', icon: 'heart', color: '#EC4899' },
            { name: 'Utilities', icon: 'zap', color: '#06B6D4' },
            { name: 'Income', icon: 'trending-up', color: '#10B981' },
            { name: 'Transfer', icon: 'repeat', color: '#6366F1' },
            { name: 'Personal Care', icon: 'user', color: '#F472B6' },
            { name: 'Travel', icon: 'map', color: '#14B8A6' },
            { name: 'Education', icon: 'book', color: '#F97316' },
            { name: 'Gifts & Donations', icon: 'gift', color: '#F43F5E' },
            { name: 'Taxes', icon: 'file-text', color: '#64748B' },
            { name: 'Others', icon: 'grid', color: '#94A3B8' }
        ];

        for (const cat of defaultCategories) {
            await this.run('INSERT INTO categories (name, icon, color) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING', [cat.name, cat.icon, cat.color]);
        }
    }

    async setMetadata(type, id, data) {
        if (type === 'transaction') {
            return this.setTransactionMetadata(id, data);
        } else if (type === 'account') {
            return this.setAccountMetadata(id, data);
        } else if (type === 'merchant') {
            return this.setMerchantMetadata(id, data);
        } else {
            throw new Error(`Unsupported metadata type: ${type} `);
        }
    }

    async setAccountMetadata(id, data) {
        const { custom_name, owner_name, is_hidden } = data;
        let sql;
        if (this.isPostgres) {
            sql = `
                INSERT INTO account_metadata(account_id, custom_name, owner_name, is_hidden, updated_at)
        VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(account_id) DO UPDATE SET
        custom_name = EXCLUDED.custom_name,
            owner_name = EXCLUDED.owner_name,
            is_hidden = EXCLUDED.is_hidden,
            updated_at = CURRENT_TIMESTAMP
                `;
        } else {
            sql = `
                INSERT INTO account_metadata(account_id, custom_name, owner_name, is_hidden, updated_at)
        VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(account_id) DO UPDATE SET
        custom_name = COALESCE(?, custom_name),
            owner_name = COALESCE(?, owner_name),
            is_hidden = COALESCE(?, is_hidden),
            updated_at = CURRENT_TIMESTAMP
                `;
        }
        const params = this.isPostgres
            ? [id, custom_name, owner_name, is_hidden]
            : [id, custom_name, owner_name, is_hidden, custom_name, owner_name, is_hidden];
        await this.run(sql, params);
    }

    async setMerchantMetadata(name, data) {
        if (!this.pool && !this.db) await this.init();
        const { category, logo_url, is_favorite, is_transfer } = data;
        const cleanedName = cleanMerchantName(name);

        let sql;
        if (this.isPostgres) {
            sql = `
                INSERT INTO merchant_metadata(merchant_name, category, logo_url, is_favorite, is_transfer, updated_at)
        VALUES($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                ON CONFLICT(merchant_name) DO UPDATE SET
        category = COALESCE(EXCLUDED.category, merchant_metadata.category),
            logo_url = COALESCE(EXCLUDED.logo_url, merchant_metadata.logo_url),
            is_favorite = COALESCE(EXCLUDED.is_favorite, merchant_metadata.is_favorite),
            is_transfer = COALESCE(EXCLUDED.is_transfer, merchant_metadata.is_transfer),
            updated_at = CURRENT_TIMESTAMP
                `;
        } else {
            sql = `
                INSERT INTO merchant_metadata(merchant_name, category, logo_url, is_favorite, is_transfer, updated_at)
        VALUES(?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(merchant_name) DO UPDATE SET
        category = COALESCE(excluded.category, merchant_metadata.category),
            logo_url = COALESCE(excluded.logo_url, merchant_metadata.logo_url),
            is_favorite = COALESCE(excluded.is_favorite, merchant_metadata.is_favorite),
            is_transfer = COALESCE(excluded.is_transfer, merchant_metadata.is_transfer),
            updated_at = CURRENT_TIMESTAMP
                `;
        }
        // Save for BOTH exact name AND cleaned name to be safe
        await this.run(sql, [name, category, logo_url, is_favorite, is_transfer]);
        if (cleanedName && cleanedName !== name.toUpperCase()) {
            await this.run(sql, [cleanedName, category, logo_url, is_favorite, is_transfer]);
        }
    }

    async applyMerchantRuleToTransactions(merchantName, category, isTransfer) {
        if (!merchantName) return { changes: 0 };
        if (!this.pool && !this.db) await this.init();

        // We need to find transactions that match this merchant.
        // Logic: Update transaction_metadata where merchant_name matches OR (merchant_name is null and cached_transactions.merchant_name matches)
        // Since we only really write to transaction_metadata when overriding, we will Upsert into transaction_metadata for all matching cached_transactions.

        // 1. Get all matching transactions from Cache
        const exactName = merchantName;
        const cleaned = cleanMerchantName(merchantName);

        // Find IDs of transactions that look like this merchant
        const findSql = this.isPostgres
            ? `SELECT transaction_id FROM cached_transactions WHERE merchant_name = $1 OR merchant_name = $2 OR name = $1 OR name = $2`
            : `SELECT transaction_id FROM cached_transactions WHERE merchant_name = ? OR merchant_name = ? OR name = ? OR name = ? `;

        const rows = await this.all(findSql, [exactName, cleaned]);

        let changeCount = 0;
        for (const row of rows) {
            // Upsert metadata
            // We preserve existing notes/dates/etc if they exist, but OVERWRITE category and is_transfer
            await this.setTransactionMetadata(row.transaction_id, {
                category: category,
                is_transfer: isTransfer
            });
            changeCount++;
        }
        return { changes: changeCount };
    }

    async setTransactionMetadata(id, data) {
        const { category, merchant_name, account_id, date, time, note, recurring_frequency, is_transfer, device_info, splits, manual_budget_id, exclude_from_budget } = data;

        // Dynamic Categorization: If a category is set for a transaction, 
        // also set it as the default for this merchant name globally.
        if (merchant_name && category) {
            await this.setMerchantMetadata(merchant_name, { category });
        }

        let sql;
        if (this.isPostgres) {
            sql = `
                INSERT INTO transaction_metadata(transaction_id, category, merchant_name, account_id, date, time, note, recurring_frequency, is_transfer, device_info, splits, manual_budget_id, exclude_from_budget, created_at, updated_at)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT(transaction_id) DO UPDATE SET
        category = COALESCE(EXCLUDED.category, transaction_metadata.category),
            merchant_name = COALESCE(EXCLUDED.merchant_name, transaction_metadata.merchant_name),
            account_id = COALESCE(EXCLUDED.account_id, transaction_metadata.account_id),
            date = COALESCE(EXCLUDED.date, transaction_metadata.date),
            time = COALESCE(EXCLUDED.time, transaction_metadata.time),
            note = COALESCE(EXCLUDED.note, transaction_metadata.note),
            recurring_frequency = COALESCE(EXCLUDED.recurring_frequency, transaction_metadata.recurring_frequency),
            is_transfer = COALESCE(EXCLUDED.is_transfer, transaction_metadata.is_transfer),
            device_info = COALESCE(EXCLUDED.device_info, transaction_metadata.device_info),
            splits = COALESCE(EXCLUDED.splits, transaction_metadata.splits),
            manual_budget_id = COALESCE(EXCLUDED.manual_budget_id, transaction_metadata.manual_budget_id),
            exclude_from_budget = COALESCE(EXCLUDED.exclude_from_budget, transaction_metadata.exclude_from_budget),
            updated_at = EXCLUDED.updated_at
                `;
        } else {
            sql = `
                INSERT INTO transaction_metadata(transaction_id, category, merchant_name, account_id, date, time, note, recurring_frequency, is_transfer, device_info, splits, manual_budget_id, exclude_from_budget, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(transaction_id) DO UPDATE SET
        category = COALESCE(?, category),
            merchant_name = COALESCE(?, merchant_name),
            account_id = COALESCE(?, account_id),
            date = COALESCE(?, date),
            time = COALESCE(?, time),
            note = COALESCE(?, note),
            recurring_frequency = COALESCE(?, recurring_frequency),
            is_transfer = COALESCE(?, is_transfer),
            device_info = COALESCE(?, device_info),
            splits = COALESCE(?, splits),
            manual_budget_id = COALESCE(?, manual_budget_id),
            exclude_from_budget = COALESCE(?, exclude_from_budget),
            updated_at = ?
                `;
        }

        const now = new Date().toISOString();
        const splitsJson = splits ? (typeof splits === 'string' ? splits : JSON.stringify(splits)) : null;
        const params = this.isPostgres
            ? [id, category, merchant_name, account_id, date, time, note, recurring_frequency, is_transfer, device_info, splitsJson, manual_budget_id, exclude_from_budget, now, now]
            : [id, category, merchant_name, account_id, date, time, note, recurring_frequency, is_transfer, device_info, splitsJson, manual_budget_id, exclude_from_budget, now, now, category, merchant_name, account_id, date, time, note, recurring_frequency, is_transfer, device_info, splitsJson, manual_budget_id, exclude_from_budget, now, id];

        await this.run(sql, params);
    }

    async getTransactionMetadataMap() {
        const rows = await this.all('SELECT * FROM transaction_metadata');
        return rows.reduce((map, row) => {
            map[row.transaction_id] = row;
            return map;
        }, {});
    }

    async getMerchantMetadataMap() {
        if (!this.pool && !this.db) await this.init();
        const rows = await this.all('SELECT * FROM merchant_metadata');
        return rows.reduce((map, row) => {
            // Store by name as provided in DB
            map[row.merchant_name] = row;
            // Also store by cleaned name if different
            const cleaned = cleanMerchantName(row.merchant_name);
            if (cleaned && cleaned !== row.merchant_name) {
                map[cleaned] = row;
            }
            return map;
        }, {});
    }

    async getCategories() {
        if (!this.pool && !this.db) await this.init();

        // Mapping of Plaid category names to parent categories
        const dynamicParentMap = {
            'BANK_FEES': 'Financial',
            'Bank Fees': 'Financial',
            'GENERAL_MERCHANDISE': 'Shopping',
            'General Merchandise': 'Shopping',
            'GENERAL_SERVICES': 'Other',
            'General Services': 'Other',
            'GOVERNMENT_AND_NON_PROFIT': 'Other',
            'Government And Non Profit': 'Other',
            'HOME_IMPROVEMENT': 'Housing',
            'Home Improvement': 'Housing',
            'LOAN_PAYMENTS': 'Financial',
            'Loan Payments': 'Financial',
            'MEDICAL': 'Health',
            'Medical': 'Health',
            'RENT_AND_UTILITIES': 'Bills & Utilities',
            'Rent And Utilities': 'Bills & Utilities',
            'TRANSFER_IN': 'Financial',
            'Transfer In': 'Financial',
            'TRANSFER_OUT': 'Financial',
            'Transfer Out': 'Financial',
            'TRANSPORTATION': 'Transportation',
            'Transportation': 'Transportation',
            'FOOD_AND_DRINK': 'Food & Drink',
            'Food And Drink': 'Food & Drink',
            'ENTERTAINMENT': 'Entertainment',
            'Entertainment': 'Entertainment',
            'INCOME': 'Income',
            'Income': 'Income',
            'PERSONAL_CARE': 'Health',
            'Personal Care': 'Health'
        };

        // Helper to normalize names for comparison
        const normalize = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '').replace('and', '');

        // 1. Get seeded/hardcoded categories
        const baseCategories = await this.all('SELECT * FROM categories ORDER BY name ASC');
        const normalizedSeen = new Map();

        baseCategories.forEach(c => {
            normalizedSeen.set(normalize(c.name), c.name);
        });

        // 2. Get unique categories currently in use in transactions
        const txCategoriesSql = this.isPostgres
            ? "SELECT DISTINCT (personal_finance_category::json->>'primary') as name FROM cached_transactions WHERE personal_finance_category IS NOT NULL"
            : "SELECT DISTINCT json_extract(personal_finance_category, '$.primary') as name FROM cached_transactions WHERE personal_finance_category IS NOT NULL";

        try {
            const txCategories = await this.all(txCategoriesSql);
            const merged = [...baseCategories];

            for (const row of txCategories) {
                if (!row.name) continue;

                // Beautify name if it looks like a Plaid slug
                let displayName = row.name;
                if (displayName.includes('_')) {
                    displayName = displayName.replace(/_/g, ' ')
                        .toLowerCase()
                        .replace(/\b\w/g, l => l.toUpperCase());
                }

                const normName = normalize(displayName);
                if (!normalizedSeen.has(normName)) {
                    // Determine parent category
                    const parent = dynamicParentMap[row.name] || dynamicParentMap[displayName] || null;

                    merged.push({
                        id: 'dynamic_' + row.name,
                        name: displayName,
                        original_name: row.name,
                        icon: 'tag',
                        color: '#64748B',
                        parent_category: parent
                    });
                    normalizedSeen.set(normName, displayName);
                }
            }

            return merged.sort((a, b) => a.name.localeCompare(b.name));
        } catch (err) {
            console.error('Error fetching dynamic categories:', err);
            return baseCategories;
        }
    }

    async addCategory(name, color = '#94A3B8', icon = 'tag') {
        const result = await this.run(
            'INSERT INTO categories (name, icon, color, is_custom) VALUES (?, ?, ?, 1) ON CONFLICT(name) DO NOTHING',
            [name, icon, color]
        );
        return this.get('SELECT * FROM categories WHERE name = ?', [name]);
    }

    async updateCategory(name, data) {
        const { parent_category, icon, color } = data;
        let sql;
        if (this.isPostgres) {
            sql = `UPDATE categories SET 
                parent_category = COALESCE($1, parent_category),
                icon = COALESCE($2, icon),
                color = COALESCE($3, color)
                WHERE name = $4`;
        } else {
            sql = `UPDATE categories SET 
                parent_category = COALESCE(?, parent_category),
                icon = COALESCE(?, icon),
                color = COALESCE(?, color)
                WHERE name = ?`;
        }
        await this.run(sql, [parent_category, icon, color, name]);
        return this.get('SELECT * FROM categories WHERE name = ?', [name]);
    }

    async deleteCategory(name) {
        await this.run('DELETE FROM categories WHERE name = ?', [name]);
        return { deleted: true };
    }

    async getCachedTransactionIds(itemId, startDate, endDate) {
        if (!this.pool && !this.db) await this.init();
        const sql = this.isPostgres
            ? 'SELECT transaction_id FROM cached_transactions WHERE item_id = $1 AND date >= $2 AND date <= $3'
            : 'SELECT transaction_id FROM cached_transactions WHERE item_id = ? AND date >= ? AND date <= ?';
        const rows = await this.all(sql, [itemId, startDate, endDate]);
        return new Set(rows.map(r => r.transaction_id));
    }

    async deleteCachedTransactions(transactionIds) {
        if (!transactionIds || transactionIds.length === 0) return;
        if (!this.pool && !this.db) await this.init();

        const placeholders = transactionIds.map(() => (this.isPostgres ? '$1' : '?')).join(',');
        // Note: For Postgres with array, we'd need dynamic $1, $2... construction or ANY/IN logic.
        // Simplest portable way is loop or constructed IN clause.

        // Better construction for mapped placeholders:
        if (this.isPostgres) {
            const params = transactionIds;
            const placeholders = params.map((_, i) => `$${i + 1}`).join(',');
            await this.run(`DELETE FROM cached_transactions WHERE transaction_id IN (${placeholders})`, params);
        } else {
            const placeholders = transactionIds.map(() => '?').join(',');
            await this.run(`DELETE FROM cached_transactions WHERE transaction_id IN (${placeholders})`, transactionIds);
        }

        console.log(`Pruned ${transactionIds.length} stale transactions.`);
    }

    async upsertPlaidItem(itemId, accessToken, institutionName) {
        let sql;
        if (this.isPostgres) {
            sql = `
                INSERT INTO plaid_items(item_id, access_token, institution_name, created_at)
        VALUES(?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(item_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
            institution_name = COALESCE(EXCLUDED.institution_name, plaid_items.institution_name),
            created_at = CURRENT_TIMESTAMP
                `;
        } else {
            sql = `
                INSERT INTO plaid_items(item_id, access_token, institution_name, created_at)
        VALUES(?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(item_id) DO UPDATE SET
        access_token = excluded.access_token,
            institution_name = COALESCE(excluded.institution_name, plaid_items.institution_name),
            created_at = CURRENT_TIMESTAMP
                `;
        }
        await this.run(sql, [itemId, accessToken, institutionName]);
    }

    async getAllPlaidItems() {
        return this.all('SELECT * FROM plaid_items');
    }

    async deletePlaidItem(itemId) {
        if (!this.pool && !this.db) await this.init();

        // 0. Cleanup Budgets: Remove associated accounts from any budgets
        try {
            // Get accounts for this item
            const accountsSql = this.isPostgres
                ? 'SELECT account_id FROM cached_accounts WHERE item_id = $1'
                : 'SELECT account_id FROM cached_accounts WHERE item_id = ?';
            const accounts = await this.all(accountsSql, [itemId]);
            const accountIdsToRemove = new Set(accounts.map(a => a.account_id));

            if (accountIdsToRemove.size > 0) {
                const budgets = await this.all('SELECT * FROM budgets');
                for (const budget of budgets) {
                    if (!budget.accounts) continue;

                    let budgetAccounts = [];
                    try {
                        budgetAccounts = typeof budget.accounts === 'string'
                            ? JSON.parse(budget.accounts)
                            : budget.accounts;
                    } catch (e) { continue; }

                    if (!Array.isArray(budgetAccounts)) continue;

                    const originalLength = budgetAccounts.length;
                    const filteredAccounts = budgetAccounts.filter(id => !accountIdsToRemove.has(id));

                    if (filteredAccounts.length !== originalLength) {
                        console.log(`Cleanup: Remove ${originalLength - filteredAccounts.length} stale accounts from Budget ${budget.id}`);
                        const updateSql = this.isPostgres
                            ? 'UPDATE budgets SET accounts = $1 WHERE id = $2'
                            : 'UPDATE budgets SET accounts = ? WHERE id = ?';
                        await this.run(updateSql, [JSON.stringify(filteredAccounts), budget.id]);
                    }
                }
            }
        } catch (err) {
            console.error('Error cleaning up budgets during Plaid deletion:', err);
        }

        // 1. Delete transactions associated with this item
        const txDeleteSql = this.isPostgres
            ? 'DELETE FROM cached_transactions WHERE item_id = $1'
            : 'DELETE FROM cached_transactions WHERE item_id = ?';
        await this.run(txDeleteSql, [itemId]);

        // 2. Delete accounts associated with this item
        const accDeleteSql = this.isPostgres
            ? 'DELETE FROM cached_accounts WHERE item_id = $1'
            : 'DELETE FROM cached_accounts WHERE item_id = ?';
        await this.run(accDeleteSql, [itemId]);

        // 3. Delete the item itself
        const itemDeleteSql = this.isPostgres
            ? 'DELETE FROM plaid_items WHERE item_id = $1'
            : 'DELETE FROM plaid_items WHERE item_id = ?';
        await this.run(itemDeleteSql, [itemId]);

        console.log(`Deleted Plaid Item ${itemId} and all associated data.`);
    }

    async getAllAccounts() {
        if (!this.pool && !this.db) await this.init();
        let sql;
        if (this.isPostgres) {
            sql = `
                SELECT a.*, am.custom_name, am.is_hidden
                FROM accounts a
                LEFT JOIN account_metadata am ON a.account_id = am.account_id
            `;
        } else {
            sql = `
                SELECT a.*, am.custom_name, am.is_hidden
                FROM accounts a
                LEFT JOIN account_metadata am ON a.account_id = am.account_id
            `;
        }
        return this.all(sql);
    }

    async upsertAccounts(accounts, itemId) {
        for (const acc of accounts) {
            let sql;
            if (this.isPostgres) {
                sql = `
                    INSERT INTO cached_accounts(
                    account_id, item_id, name, mask, official_name, type, subtype,
                    current_balance, iso_currency_code, last_updated_datetime, updated_at
                )
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                    ON CONFLICT(account_id) DO UPDATE SET
        current_balance = EXCLUDED.current_balance,
            last_updated_datetime = EXCLUDED.last_updated_datetime,
            updated_at = CURRENT_TIMESTAMP
                `;
            } else {
                sql = `
                    INSERT INTO cached_accounts(
                    account_id, item_id, name, mask, official_name, type, subtype,
                    current_balance, iso_currency_code, last_updated_datetime, updated_at
                )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(account_id) DO UPDATE SET
        current_balance = excluded.current_balance,
            last_updated_datetime = excluded.last_updated_datetime,
            updated_at = CURRENT_TIMESTAMP
                `;
            }
            await this.run(sql, [
                acc.account_id,
                itemId,
                acc.name,
                acc.mask,
                acc.official_name,
                acc.type,
                acc.subtype,
                acc.balances.current,
                acc.balances.iso_currency_code,
                new Date().toISOString()
            ]);
        }
    }

    async getUniqueMerchants() {
        if (!this.pool && !this.db) await this.init();
        const rows = await this.all(`
            SELECT DISTINCT merchant_name as name FROM transaction_metadata WHERE merchant_name IS NOT NULL
        UNION
            SELECT DISTINCT name FROM cached_transactions WHERE merchant_name IS NULL
            ORDER BY name ASC
            `);

        // Use a Set to deduplicate cleaned names
        const seen = new Set();
        const result = [];

        for (const row of rows) {
            const cleaned = cleanMerchantName(row.name);
            if (cleaned && !seen.has(cleaned)) {
                result.push(row.name); // Keep one representative name
                seen.add(cleaned);
            } else if (!cleaned && row.name && !seen.has(row.name.toUpperCase())) {
                result.push(row.name);
                seen.add(row.name.toUpperCase());
            }
        }

        return result.sort((a, b) => a.localeCompare(b));
    }

    async getCachedAccountsByItem(itemId) {
        const rows = await this.all('SELECT * FROM cached_accounts WHERE item_id = ?', [itemId]);
        return rows.map(row => ({
            account_id: row.account_id,
            item_id: row.item_id,
            name: row.name,
            mask: row.mask,
            official_name: row.official_name,
            type: row.type,
            subtype: row.subtype,
            balances: {
                current: row.current_balance,
                iso_currency_code: row.iso_currency_code,
                last_updated_datetime: row.last_updated_datetime
            }
        }));
    }

    async upsertTransactions(transactions, itemId) {
        if (!this.pool && !this.db) await this.init();
        for (const tx of transactions) {
            let sql;
            if (this.isPostgres) {
                sql = `
                    INSERT INTO cached_transactions(
                transaction_id, account_id, amount, date, authorized_date, name, merchant_name,
                category, personal_finance_category, pending, iso_currency_code, item_id, updated_at
            )
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
                    ON CONFLICT(transaction_id) DO UPDATE SET
        amount = EXCLUDED.amount,
            date = EXCLUDED.date,
            authorized_date = EXCLUDED.authorized_date,
            pending = EXCLUDED.pending,
            category = EXCLUDED.category,
            personal_finance_category = EXCLUDED.personal_finance_category,
            updated_at = CURRENT_TIMESTAMP
                `;
            } else {
                sql = `
                    INSERT INTO cached_transactions(
                    transaction_id, account_id, amount, date, authorized_date, name, merchant_name,
                    category, personal_finance_category, pending, iso_currency_code, item_id, updated_at
                )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(transaction_id) DO UPDATE SET
        amount = excluded.amount,
            date = excluded.date,
            authorized_date = excluded.authorized_date,
            pending = excluded.pending,
            category = excluded.category,
            personal_finance_category = excluded.personal_finance_category,
            updated_at = CURRENT_TIMESTAMP
                `;
            }
            await this.run(sql, [
                tx.transaction_id,
                tx.account_id,
                tx.amount,
                tx.date,
                tx.authorized_date || null,
                tx.name,
                tx.merchant_name,
                tx.category ? tx.category.join(',') : null,
                tx.personal_finance_category ? JSON.stringify(tx.personal_finance_category) : null,
                tx.pending ? 1 : 0,
                tx.iso_currency_code,
                itemId
            ]);
        }
    }

    async getCachedTransactions(itemIds = []) {
        if (!this.pool && !this.db) await this.init();
        let sql = `
            SELECT t.*, a.name as account_name, a.type as account_type, a.subtype as account_subtype, 
                   a.official_name as account_official_name,
                   am.owner_name as account_owner_name, am.custom_name as account_custom_name,
                   p.institution_name,
                   tm.manual_budget_id, tm.exclude_from_budget
            FROM cached_transactions t
            LEFT JOIN cached_accounts a ON t.account_id = a.account_id
            LEFT JOIN account_metadata am ON t.account_id = am.account_id
            LEFT JOIN plaid_items p ON t.item_id = p.item_id
            LEFT JOIN transaction_metadata tm ON t.transaction_id = tm.transaction_id
        `;
        let params = [];

        if (itemIds.length > 0) {
            const placeholders = this.isPostgres
                ? itemIds.map((_, i) => `$${i + 1}`).join(',')
                : itemIds.map(() => '?').join(',');
            sql += ` WHERE t.item_id IN (${placeholders})`;
            params = itemIds;
        }

        sql += ' ORDER BY t.date DESC';
        const rows = await this.all(sql, params);

        return rows.map(row => ({
            transaction_id: row.transaction_id,
            account_id: row.account_id,
            amount: row.amount,
            date: row.date,
            authorized_date: row.authorized_date,
            name: row.name,
            merchant_name: row.merchant_name,
            category: row.category ? row.category.split(',') : [],
            personal_finance_category: row.personal_finance_category ? JSON.parse(row.personal_finance_category) : null,
            pending: row.pending === 1,
            iso_currency_code: row.iso_currency_code,
            item_id: row.item_id,
            updated_at: row.updated_at,
            account_name: row.account_custom_name || row.account_name,
            account_type: row.account_type,
            account_subtype: row.account_subtype,
            account_official_name: row.account_official_name,
            account_owner_name: row.account_owner_name,
            institution_name: row.institution_name,
            manual_budget_id: row.manual_budget_id,
            exclude_from_budget: row.exclude_from_budget === 1
        }));
    }

    async addManualTransaction(id, data) {
        const { account_id, amount, date, time, name, merchant_name, category, note, recurring_frequency, is_transfer, device_info, splits, manual_budget_id, exclude_from_budget } = data;
        let sql;
        const now = new Date().toISOString();
        if (this.isPostgres) {
            sql = `
                INSERT INTO manual_transactions(
                    transaction_id, account_id, amount, date, time, name, merchant_name,
                    category, note, recurring_frequency, is_transfer, device_info, splits, manual_budget_id, exclude_from_budget, created_at, updated_at
                ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    `;
        } else {
            sql = `
                INSERT INTO manual_transactions(
                        transaction_id, account_id, amount, date, time, name, merchant_name,
                        category, note, recurring_frequency, is_transfer, device_info, splits, manual_budget_id, exclude_from_budget, created_at, updated_at
                    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `;
        }
        const splitsJson = splits ? (typeof splits === 'string' ? splits : JSON.stringify(splits)) : null;

        // Ensure no undefined values for PG
        const params = [
            id,
            account_id ?? null,
            amount ?? 0,
            date,
            time ?? null,
            name,
            merchant_name ?? null,
            category ?? null,
            note ?? null,
            recurring_frequency ?? null,
            is_transfer ?? 0,
            device_info ?? null,
            splitsJson,
            manual_budget_id ?? null,
            exclude_from_budget ?? 0,
            now,
            now
        ];
        return this.run(sql, params);
    }

    async updateManualTransaction(id, data) {
        const { account_id, amount, date, time, name, merchant_name, category, note, recurring_frequency, is_transfer, device_info, splits, manual_budget_id, exclude_from_budget } = data;
        const now = new Date().toISOString();
        let sql;
        if (this.isPostgres) {
            sql = `
                UPDATE manual_transactions SET
        account_id = $2, amount = $3, date = $4, time = $5, name = $6, merchant_name = $7,
            category = $8, note = $9, recurring_frequency = $10, is_transfer = $11, device_info = $12, splits = $13, manual_budget_id = $14, exclude_from_budget = $15, updated_at = $16
                WHERE transaction_id = $1
            `;
        } else {
            sql = `
                UPDATE manual_transactions SET
        account_id = ?, amount = ?, date = ?, time = ?, name = ?, merchant_name = ?,
            category = ?, note = ?, recurring_frequency = ?, is_transfer = ?, device_info = ?, splits = ?, manual_budget_id = ?, exclude_from_budget = ?, updated_at = ?
                WHERE transaction_id = ?
            `;
        }
        const splitsJson = splits ? (typeof splits === 'string' ? splits : JSON.stringify(splits)) : null;

        // Ensure no undefined values
        const paramsValues = [
            account_id ?? null,
            amount ?? 0,
            date,
            time ?? null,
            name,
            merchant_name ?? null,
            category ?? null,
            note ?? null,
            recurring_frequency ?? null,
            is_transfer ?? 0,
            device_info ?? null,
            splitsJson,
            manual_budget_id ?? null,
            exclude_from_budget ?? 0,
            now
        ];

        const params = this.isPostgres
            ? [id, ...paramsValues] // PG: id is $1
            : [...paramsValues, id]; // SQLite: id is last

        return this.run(sql, params);
    }

    async getManualTransactions() {
        const sql = `
            SELECT t.*, a.name as account_name, a.type as account_type
            FROM manual_transactions t
            LEFT JOIN cached_accounts a ON t.account_id = a.account_id
            ORDER BY t.date DESC
        `;
        return this.all(sql);
    }

    async getManualTransaction(id) {
        const sql = `
            SELECT t.*, a.name as account_name
            FROM manual_transactions t
            LEFT JOIN cached_accounts a ON t.account_id = a.account_id
            WHERE t.transaction_id = ?
        `;
        const pgSql = `
            SELECT t.*, a.name as account_name
            FROM manual_transactions t
            LEFT JOIN cached_accounts a ON t.account_id = a.account_id
            WHERE t.transaction_id = $1
        `;
        if (this.isPostgres) {
            const rows = await this.all(pgSql, [id]);
            return rows[0];
        }
        return this.get(sql, [id]);
    }

    // Proxy to underlying get/all depending on DB
    async get(sql, params = []) {
        if (this.isPostgres) {
            const rows = await this.all(sql, params);
            return rows[0];
        } else {
            return this.db.get(sql, params);
        }
    }

    async deleteManualTransaction(id) {
        return this.run('DELETE FROM manual_transactions WHERE transaction_id = ?', [id]);
    }
    async addCategory(name, parentCategory, color, icon) {
        const sql = `
            INSERT INTO categories (name, parent_category, color, icon, is_custom)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(name) DO UPDATE SET
                parent_category = excluded.parent_category,
                color = excluded.color,
                icon = excluded.icon
        `;
        const params = [name, parentCategory || null, color, icon];
        if (this.isPostgres) {
            const pgSql = `
                INSERT INTO categories (name, parent_category, color, icon, is_custom)
                VALUES ($1, $2, $3, $4, 1)
                ON CONFLICT(name) DO UPDATE SET
                    parent_category = EXCLUDED.parent_category,
                    color = EXCLUDED.color,
                    icon = EXCLUDED.icon
            `;
            return this.run(pgSql, params);
        }
        return this.run(sql, params);
    }

    async getAllCategories() {
        return this.all('SELECT * FROM categories ORDER BY name ASC');
    }

    async deleteCategory(name) {
        const sql = 'DELETE FROM categories WHERE name = ?';
        const pgSql = 'DELETE FROM categories WHERE name = $1';
        if (this.isPostgres) {
            return this.run(pgSql, [name]);
        }
        return this.run(sql, [name]);
    }

    // ==================== Category Normalizations ====================

    async getCategoryNormalizations() {
        const sql = 'SELECT * FROM category_normalizations ORDER BY from_category';
        return this.all(sql);
    }

    async createCategoryNormalization(from_category, to_category) {
        const sql = 'INSERT INTO category_normalizations (from_category, to_category) VALUES (?, ?)';
        const pgSql = 'INSERT INTO category_normalizations (from_category, to_category) VALUES ($1, $2) RETURNING *';

        if (this.isPostgres) {
            const result = await this.all(pgSql, [from_category, to_category]);
            return result[0];
        }
        const result = await this.run(sql, [from_category, to_category]);
        return { id: result.lastID, from_category, to_category };
    }

    async updateCategoryNormalization(id, from_category, to_category) {
        const sql = 'UPDATE category_normalizations SET from_category = ?, to_category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        const pgSql = 'UPDATE category_normalizations SET from_category = $1, to_category = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *';

        if (this.isPostgres) {
            const result = await this.all(pgSql, [from_category, to_category, id]);
            return result[0];
        }
        await this.run(sql, [from_category, to_category, id]);
        return { id, from_category, to_category };
    }

    async deleteCategoryNormalization(id) {
        const sql = 'DELETE FROM category_normalizations WHERE id = ?';
        const pgSql = 'DELETE FROM category_normalizations WHERE id = $1';
        if (this.isPostgres) {
            return this.run(pgSql, [id]);
        }
        return this.run(sql, [id]);
    }

    async getPaidBills() {
        // Fetch manual transactions that start with 'bill_pay_'
        // These are transactions created explicitly from the Bills tab
        const sql = `
            SELECT t.*, a.name as account_name
            FROM manual_transactions t
            LEFT JOIN cached_accounts a ON t.account_id = a.account_id
            WHERE t.transaction_id LIKE 'bill_pay_%'
            ORDER BY t.date DESC
        `;
        // Note: For Postgres, LIKE is case-sensitive, which is fine here.
        // If we needed standard SQL, 'bill_pay_%' works for both.
        return this.all(sql);
    }
}

module.exports = {
    manager: new DatabaseManager(),
    cleanMerchantName
};
