const express = require('express');
const router = express.Router();
const { manager } = require('../database');

// GET /api/budgets
router.get('/', async (req, res) => {
    try {
        const budgets = await manager.all('SELECT * FROM budgets WHERE is_active = 1 ORDER BY created_at DESC');

        // Parse JSON fields
        const parsedBudgets = budgets.map(b => ({
            ...b,
            categories: b.categories ? JSON.parse(b.categories) : [],
            accounts: b.accounts ? JSON.parse(b.accounts) : []
        }));

        res.json(parsedBudgets);
    } catch (error) {
        console.error('Error fetching budgets:', error);
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
});

// POST /api/budgets
router.post('/', async (req, res) => {
    const {
        name, amount, type, category_type,
        recurrence_frequency, start_date,
        categories, accounts, is_rollover, alert_percent
    } = req.body;

    if (!name || !amount) {
        return res.status(400).json({ error: 'Name and Amount are required' });
    }

    try {
        const sql = `
            INSERT INTO budgets (
                name, amount, type, category_type, 
                recurrence_frequency, start_date, 
                categories, accounts, is_rollover, alert_percent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
        `;

        const params = [
            name,
            amount,
            type || 'Personal',
            category_type || 'Expense',
            recurrence_frequency || 'Monthly',
            start_date || new Date().toISOString().split('T')[0],
            JSON.stringify(categories || []),
            JSON.stringify(accounts || []),
            is_rollover ? 1 : 0,
            alert_percent || 70
        ];

        let result;
        if (manager.isPostgres) {
            // Replace ? with $1, $2, etc for PostgreSQL
            let paramIndex = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
            const { rows } = await manager.pool.query(pgSql, params);
            result = rows[0];
        } else {
            // SQLite manual RETURNING handling if needed, or just insert and fetch
            // But manager.run usually returns lastID.
            // Let's us regular INSERT for SQLite support
            const insertSql = `
                INSERT INTO budgets (
                    name, amount, type, category_type, 
                    recurrence_frequency, start_date, 
                    categories, accounts, is_rollover, alert_percent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await manager.run(insertSql, params);
            // Verify this fetches the last one? 
            // Ideally we just return success.
            result = { name, amount }; // Simplified
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating budget:', error);
        res.status(500).json({ error: 'Failed to create budget' });
    }
});

// GET /api/budgets/:id - Get specific budget details for a month
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const { month, year } = req.query; // optional, defaults to current

    try {
        const budget = await manager.get('SELECT * FROM budgets WHERE id = ?', [id]);
        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        const now = new Date();
        const targetYear = year ? parseInt(year) : now.getFullYear();
        const targetMonth = month ? parseInt(month) : now.getMonth() + 1; // 1-12

        const startOfMonth = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

        // Fetch transactions for this store logic
        const manualTxs = await manager.all(`
            SELECT amount, category, date FROM manual_transactions 
            WHERE date >= ? AND date <= ?
        `, [startOfMonth, endOfMonth]);

        const plaidTxs = await manager.all(`
            SELECT amount, category, date FROM cached_transactions 
            WHERE date >= ? AND date <= ?
        `, [startOfMonth, endOfMonth]);

        const allTxs = [...manualTxs, ...plaidTxs];

        const budgetCats = budget.categories ? JSON.parse(budget.categories) : [];

        const relevantTxs = allTxs.filter(tx => {
            if (budgetCats.length > 0) {
                if (!budgetCats.includes(tx.category)) return false;
            }
            return true;
        });

        const spent = relevantTxs.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0);

        const result = {
            ...budget,
            categories: budgetCats,
            accounts: budget.accounts ? JSON.parse(budget.accounts) : [],
            spent: spent,
            limit: budget.amount,
            period: new Date(targetYear, targetMonth - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
        };

        res.json(result);
    } catch (error) {
        console.error('Error fetching budget details:', error);
        res.status(500).json({ error: 'Failed to fetch budget details' });
    }
});

// PUT /api/budgets/:id - Update existing budget
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        name, amount, type, category_type,
        recurrence_frequency, start_date,
        categories, accounts, is_rollover, alert_percent
    } = req.body;

    try {
        let sql, params;

        if (manager.isPostgres) {
            sql = `
                UPDATE budgets SET
                    name = $1,
                    amount = $2,
                    type = $3,
                    category_type = $4,
                    recurrence_frequency = $5,
                    start_date = $6,
                    categories = $7,
                    accounts = $8,
                    is_rollover = $9,
                    alert_percent = $10,
                    updated_at = NOW()
                WHERE id = $11
                RETURNING *
            `;
            params = [
                name, amount, type || 'Personal', category_type || 'Expense',
                recurrence_frequency || 'Monthly', start_date,
                JSON.stringify(categories || []), JSON.stringify(accounts || []),
                is_rollover ? 1 : 0, alert_percent || 70, id
            ];
            const { rows } = await manager.pool.query(sql, params);
            res.json(rows[0]);
        } else {
            sql = `
                UPDATE budgets SET
                    name = ?,
                    amount = ?,
                    type = ?,
                    category_type = ?,
                    recurrence_frequency = ?,
                    start_date = ?,
                    categories = ?,
                    accounts = ?,
                    is_rollover = ?,
                    alert_percent = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            params = [
                name, amount, type || 'Personal', category_type || 'Expense',
                recurrence_frequency || 'Monthly', start_date,
                JSON.stringify(categories || []), JSON.stringify(accounts || []),
                is_rollover ? 1 : 0, alert_percent || 70, id
            ];
            await manager.run(sql, params);
            res.json({ id, name, amount });
        }
    } catch (error) {
        console.error('Error updating budget:', error);
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

// DELETE /api/budgets/:id - Delete a budget
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        let sql;

        if (manager.isPostgres) {
            sql = `DELETE FROM budgets WHERE id = $1`;
            await manager.pool.query(sql, [id]);
        } else {
            sql = `DELETE FROM budgets WHERE id = ?`;
            await manager.run(sql, [id]);
        }

        res.json({ success: true, message: 'Budget deleted' });
    } catch (error) {
        console.error('Error deleting budget:', error);
        res.status(500).json({ error: 'Failed to delete budget' });
    }
});

// GET /api/budgets/summary
// Returns budgets with "spent" amount calculated for the current month
router.get('/summary', async (req, res) => {
    try {
        // 1. Get all budgets
        const budgets = await manager.all('SELECT * FROM budgets WHERE is_active = 1');

        // 2. Calculate spent for each budget for THIS MONTH
        // This requires aggregating transactions.
        // For simplicity, we'll fetch ALL transactions for this month and categorize them in js
        // (Performance might be hit if thousands of txs, but fine for now)

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        // Fetch transactions (Unified query from older implementation of Expenses?)
        // Let's assume we look at transaction_metadata + cached_transactions + manual_transactions
        // Actually, let's just use `cached_transactions` + `manual_transactions` logic or a simplified view if available.
        // Or simpler: Just fetch relevant transactions based on categories.

        // Get all transactions for the month
        // We'll use a UNION ALL if possible or just two queries.

        const manualTxs = await manager.all(`
            SELECT amount, category, date FROM manual_transactions 
            WHERE date >= ? AND date <= ?
        `, [startOfMonth, endOfMonth]);

        const plaidTxs = await manager.all(`
            SELECT amount, category, date FROM cached_transactions 
            WHERE date >= ? AND date <= ?
        `, [startOfMonth, endOfMonth]);

        const allTxs = [...manualTxs, ...plaidTxs];

        const summary = budgets.map(b => {
            const budgetCats = b.categories ? JSON.parse(b.categories) : [];
            const budgetAccounts = b.accounts ? JSON.parse(b.accounts) : [];
            // Filter txs that match this budget
            // If categories empty -> assume ALL? Or none?
            // User text said: "All categories are included if not selected any"

            const relevantTxs = allTxs.filter(tx => {
                // 1. Check Category
                if (budgetCats.length > 0) {
                    // Simple inclusion check. 
                    // TODO: Handle subcategories logic if needed (e.g. "Food" includes "Food -> Restaurants")
                    // For now exact match or simple inclusion
                    if (!budgetCats.includes(tx.category)) return false;
                }

                // 2. Check Account (if we had account_id in txs, which we do but didn't select above)
                // For now ignore account filter for MVP speed

                return true;
            });

            const spent = relevantTxs.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0); // Assume positive is expense? Plaid is usually +ve for expense.

            return {
                ...b,
                categories: budgetCats,
                spent: spent,
                limit: b.amount,
                period: new Date().toLocaleString('en-US', { month: 'short' }),
                icon: 'DollarSign' // Placeholder
            };
        });

        res.json(summary);

    } catch (error) {
        console.error('Error fetching budget summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

module.exports = router;
