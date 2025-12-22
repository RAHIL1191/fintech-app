const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

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
        // Migration: Add merchant_name to transaction_metadata if missing
        try {
            await this.exec('ALTER TABLE transaction_metadata ADD COLUMN IF NOT EXISTS merchant_name TEXT');
        } catch (err) { }

        // Migration: Add account_id to transaction_metadata if missing
        try {
            await this.exec('ALTER TABLE transaction_metadata ADD COLUMN IF NOT EXISTS account_id TEXT');
        } catch (err) { }

        // Migration: Add date to transaction_metadata if missing
        try {
            await this.exec('ALTER TABLE transaction_metadata ADD COLUMN IF NOT EXISTS date TEXT');
        } catch (err) { }
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
                note TEXT,
                recurring_frequency TEXT,
                is_transfer ${this.isPostgres ? 'INTEGER' : 'INTEGER'} DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Account Metadata
            `CREATE TABLE IF NOT EXISTS account_metadata (
                account_id TEXT PRIMARY KEY,
                custom_name TEXT,
                is_hidden INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Merchant Metadata
            `CREATE TABLE IF NOT EXISTS merchant_metadata (
                merchant_name TEXT PRIMARY KEY,
                category TEXT,
                logo_url TEXT,
                is_favorite INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Categories
            `CREATE TABLE IF NOT EXISTS categories (
                id ${this.isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${this.isPostgres ? '' : 'AUTOINCREMENT'},
                name TEXT UNIQUE,
                icon TEXT,
                color TEXT,
                is_custom INTEGER DEFAULT 0
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
                pending INTEGER,
                iso_currency_code TEXT,
                item_id TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        return sql.replace(/\?/g, () => `$${index++}`);
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
            throw new Error(`Unsupported metadata type: ${type}`);
        }
    }

    async setAccountMetadata(id, data) {
        const { custom_name, is_hidden } = data;
        let sql;
        if (this.isPostgres) {
            sql = `
                INSERT INTO account_metadata (account_id, custom_name, is_hidden, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(account_id) DO UPDATE SET
                    custom_name = EXCLUDED.custom_name,
                    is_hidden = EXCLUDED.is_hidden,
                    updated_at = CURRENT_TIMESTAMP
            `;
        } else {
            sql = `
                INSERT INTO account_metadata (account_id, custom_name, is_hidden, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(account_id) DO UPDATE SET
                    custom_name = COALESCE(?, custom_name),
                    is_hidden = COALESCE(?, is_hidden),
                    updated_at = CURRENT_TIMESTAMP
            `;
        }
        const params = this.isPostgres
            ? [id, custom_name, is_hidden]
            : [id, custom_name, is_hidden, custom_name, is_hidden];
        await this.run(sql, params);
    }

    async setMerchantMetadata(id, data) {
        const { category, logo_url, is_favorite } = data;
        let sql;
        if (this.isPostgres) {
            sql = `
                INSERT INTO merchant_metadata (merchant_name, category, logo_url, is_favorite, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(merchant_name) DO UPDATE SET
                    category = COALESCE(EXCLUDED.category, merchant_metadata.category),
                    logo_url = COALESCE(EXCLUDED.logo_url, merchant_metadata.logo_url),
                    is_favorite = COALESCE(EXCLUDED.is_favorite, merchant_metadata.is_favorite),
                    updated_at = CURRENT_TIMESTAMP
            `;
        } else {
            sql = `
                INSERT INTO merchant_metadata (merchant_name, category, logo_url, is_favorite, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(merchant_name) DO UPDATE SET
                    category = COALESCE(?, category),
                    logo_url = COALESCE(?, logo_url),
                    is_favorite = COALESCE(?, is_favorite),
                    updated_at = CURRENT_TIMESTAMP
            `;
        }
        const params = this.isPostgres
            ? [id, category, logo_url, is_favorite]
            : [id, category, logo_url, is_favorite, category, logo_url, is_favorite];
        await this.run(sql, params);
    }

    async setTransactionMetadata(id, data) {
        const { category, merchant_name, account_id, date, note, recurring_frequency, is_transfer } = data;

        // Dynamic Categorization: If a category is set for a transaction, 
        // also set it as the default for this merchant name globally.
        if (merchant_name && category) {
            await this.setMerchantMetadata(merchant_name, { category });
        }

        let sql;
        if (this.isPostgres) {
            sql = `
                INSERT INTO transaction_metadata (transaction_id, category, merchant_name, account_id, date, note, recurring_frequency, is_transfer, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(transaction_id) DO UPDATE SET
                    category = EXCLUDED.category,
                    merchant_name = EXCLUDED.merchant_name,
                    account_id = EXCLUDED.account_id,
                    date = EXCLUDED.date,
                    note = EXCLUDED.note,
                    recurring_frequency = EXCLUDED.recurring_frequency,
                    is_transfer = EXCLUDED.is_transfer,
                    updated_at = CURRENT_TIMESTAMP
            `;
        } else {
            sql = `
                INSERT INTO transaction_metadata (transaction_id, category, merchant_name, account_id, date, note, recurring_frequency, is_transfer, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(transaction_id) DO UPDATE SET
                    category = COALESCE(?, category),
                    merchant_name = COALESCE(?, merchant_name),
                    account_id = COALESCE(?, account_id),
                    date = COALESCE(?, date),
                    note = COALESCE(?, note),
                    recurring_frequency = COALESCE(?, recurring_frequency),
                    is_transfer = COALESCE(?, is_transfer),
                    updated_at = CURRENT_TIMESTAMP
            `;
        }

        const params = this.isPostgres
            ? [id, category, merchant_name, account_id, date, note, recurring_frequency, is_transfer]
            : [id, category, merchant_name, account_id, date, note, recurring_frequency, is_transfer, category, merchant_name, account_id, date, note, recurring_frequency, is_transfer];

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
        const rows = await this.all('SELECT * FROM merchant_metadata');
        return rows.reduce((map, row) => {
            map[row.merchant_name] = row;
            return map;
        }, {});
    }

    async getCategories() {
        return this.all('SELECT * FROM categories ORDER BY name ASC');
    }

    async addCategory(name, color = '#94A3B8', icon = 'tag') {
        const result = await this.run(
            'INSERT INTO categories (name, icon, color, is_custom) VALUES (?, ?, ?, 1) ON CONFLICT(name) DO NOTHING',
            [name, icon, color]
        );
        return this.get('SELECT * FROM categories WHERE name = ?', [name]);
    }

    async upsertPlaidItem(itemId, accessToken, institutionName) {
        let sql;
        if (this.isPostgres) {
            sql = `
                INSERT INTO plaid_items (item_id, access_token, institution_name, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(item_id) DO UPDATE SET
                    access_token = EXCLUDED.access_token,
                    institution_name = COALESCE(EXCLUDED.institution_name, plaid_items.institution_name),
                    created_at = CURRENT_TIMESTAMP
            `;
        } else {
            sql = `
                INSERT INTO plaid_items (item_id, access_token, institution_name, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
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

    async upsertAccounts(accounts, itemId) {
        for (const acc of accounts) {
            let sql;
            if (this.isPostgres) {
                sql = `
                    INSERT INTO cached_accounts (
                        account_id, item_id, name, mask, official_name, type, subtype, 
                        current_balance, iso_currency_code, last_updated_datetime, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                    ON CONFLICT(account_id) DO UPDATE SET
                        current_balance = EXCLUDED.current_balance,
                        last_updated_datetime = EXCLUDED.last_updated_datetime,
                        updated_at = CURRENT_TIMESTAMP
                `;
            } else {
                sql = `
                    INSERT INTO cached_accounts (
                        account_id, item_id, name, mask, official_name, type, subtype, 
                        current_balance, iso_currency_code, last_updated_datetime, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
            SELECT DISTINCT merchant_name 
            FROM transaction_metadata 
            WHERE merchant_name IS NOT NULL AND merchant_name != ''
            ORDER BY merchant_name ASC
        `);
        return rows.map(r => r.merchant_name);
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
                    INSERT INTO cached_transactions (
                        transaction_id, account_id, amount, date, name, merchant_name, 
                        category, pending, iso_currency_code, item_id, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                    ON CONFLICT(transaction_id) DO UPDATE SET
                        amount = EXCLUDED.amount,
                        pending = EXCLUDED.pending,
                        updated_at = CURRENT_TIMESTAMP
                `;
            } else {
                sql = `
                    INSERT INTO cached_transactions (
                        transaction_id, account_id, amount, date, name, merchant_name, 
                        category, pending, iso_currency_code, item_id, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(transaction_id) DO UPDATE SET
                        amount = excluded.amount,
                        pending = excluded.pending,
                        updated_at = CURRENT_TIMESTAMP
                `;
            }
            await this.run(sql, [
                tx.transaction_id,
                tx.account_id,
                tx.amount,
                tx.date,
                tx.name,
                tx.merchant_name,
                tx.category ? tx.category.join(',') : null,
                tx.pending ? 1 : 0,
                tx.iso_currency_code,
                itemId
            ]);
        }
    }

    async getCachedTransactions(itemIds = []) {
        if (!this.pool && !this.db) await this.init();
        let sql = 'SELECT * FROM cached_transactions';
        let params = [];

        if (itemIds.length > 0) {
            const placeholders = this.isPostgres
                ? itemIds.map((_, i) => `$${i + 1}`).join(',')
                : itemIds.map(() => '?').join(',');
            sql += ` WHERE item_id IN (${placeholders})`;
            params = itemIds;
        }

        sql += ' ORDER BY date DESC';
        const rows = await this.all(sql, params);

        return rows.map(row => ({
            transaction_id: row.transaction_id,
            account_id: row.account_id,
            amount: row.amount,
            date: row.date,
            name: row.name,
            merchant_name: row.merchant_name,
            category: row.category ? row.category.split(',') : [],
            pending: row.pending === 1,
            iso_currency_code: row.iso_currency_code,
            item_id: row.item_id
        }));
    }
}

module.exports = new DatabaseManager();
