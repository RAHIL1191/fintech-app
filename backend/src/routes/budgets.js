const express = require('express');
const router = express.Router();
const { manager, cleanMerchantName } = require('../database');

// Simple Taxonomy Map for Backend (Needs to match frontend constants/CategoryTaxonomy.js)
const CATEGORY_TAXONOMY = {
    "Food & Drink": ["Groceries", "Restaurants", "Coffee", "Alcohol", "Fast Food", "Snacks", "Grocery", "FOOD_AND_DRINK"],
    "Shopping": ["Clothing", "Electronics", "Home & Garden", "Beauty", "Kids", "Pets", "Gifts", "Laptop Purchase", "General Merchandise", "GENERAL_MERCHANDISE"],
    "Housing": ["Rent", "Mortgage", "Maintenance", "Furniture", "Utilities", "Services", "Home Improvement", "HOME_IMPROVEMENT"],
    "Transportation": ["Fuel", "Public Transit", "Taxi/Uber", "Car Payment", "Insurance", "Repairs", "Parking", "Petrol", "License fees", "Parking fees", "TRANSPORTATION", "Transport"],
    "Entertainment": ["Movies", "Games", "Music", "Sports", "Events", "Hobbies", "Travel", "Recreational Stuff", "ENTERTAINMENT"],
    "Financial": ["Investments", "Taxes", "Insurance", "Fees", "Loan Payment", "Transfer", "Wise Withdrawal", "Bank Fees", "BANK_FEES", "Loan Payments", "LOAN_PAYMENTS", "Transfer In", "TRANSFER_IN", "Transfer Out", "TRANSFER_OUT"],
    "Health": ["Doctor", "Pharmacy", "Gym", "Therapy", "Dental", "Vision", "Massage", "MEDICAL", "Medical"],
    "Bills & Utilities": ["Phone", "Internet", "Water", "Electricity", "Gas", "Subscriptions", "Mobile Bill", "Internet home", "Subscription", "Rent And Utilities", "RENT_AND_UTILITIES"],
    "Education": ["Books", "Tuition", "Courses", "Supplies", "Student Loan"],
    "Income": ["Salary", "Bonus", "Freelance", "Investment Return", "Refund", "Bank Fees Refund", "INCOME"],
    "Gifts & Donations": ["Gift", "Gifts", "Charity", "Donations", "Birthday", "Wedding", "Holiday"],
    "Other": ["Miscellaneous", "Unknown", "General Services", "GENERAL_SERVICES", "Government And Non Profit", "GOVERNMENT_AND_NON_PROFIT"]
};

// Helper: Check if txCategory belongs to budgetCategory (Direct match or Child of Parent)
const isCategoryMatch = (txCategory, budgetCategory) => {
    if (!txCategory || !budgetCategory) return false;
    const txCat = txCategory.toLowerCase();
    const bdCat = budgetCategory.toLowerCase();

    // 1. Direct Match
    if (txCat === bdCat) return true;

    // 2. Parent Match: If budgetCategory is a Parent, check if txCategory is one of its children
    // Find the proper case key in taxonomy that matches budgetCategory
    const taxonomyKey = Object.keys(CATEGORY_TAXONOMY).find(k => k.toLowerCase() === bdCat);
    if (taxonomyKey) {
        const subCategories = CATEGORY_TAXONOMY[taxonomyKey];
        if (subCategories.some(sub => sub.toLowerCase() === txCat)) return true;
    }

    // 3. Reverse: If budgetCategory is a Sub, it only matches that specific Sub (already covered by Direct Match)
    // However, sometimes Plaid categories are "Parent - Sub" strings.
    // e.g. "Shops - Clothing" should match "Shopping"

    // We can also check if txCategory STARTS with budgetCategory (e.g. budget="Shopping", tx="Shopping - Clothing")
    if (txCat.startsWith(bdCat)) return true;

    return false;
};

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

// GET /api/budgets/summary
// Returns budgets with "spent" amount calculated for the current month
// GET /api/budgets/summary
// Returns budgets with "spent" amount calculated for the current month
router.get('/summary', async (req, res) => {
    try {
        // 1. Prepare Date Range
        const { month, year } = req.query;
        let startOfMonth, endOfMonth;

        if (month && year) {
            const m = parseInt(month) - 1; // 0-11
            const y = parseInt(year);
            startOfMonth = new Date(y, m, 1).toISOString().split('T')[0];
            endOfMonth = new Date(y, m + 1, 0).toISOString().split('T')[0];
        } else {
            const now = new Date();
            startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }

        // 2. Fetch and Filter Budgets
        // Fetch all active, then filter by validity period
        let budgets = await manager.all('SELECT * FROM budgets WHERE is_active = 1');

        budgets = budgets.filter(b => {
            // Include budget if its date range overlaps with the current month
            const bStart = b.start_date;
            const bEnd = b.end_date;

            // If budget starts strictly after the end of this month, skip it
            if (bStart && bStart > endOfMonth) return false;

            // If budget ended strictly before the start of this month, skip it
            if (bEnd && bEnd < startOfMonth) return false;

            return true;
        });

        // 3. Fetch Raw Transactions
        const manualTxs = await manager.all(`
            SELECT * FROM manual_transactions 
            WHERE date >= ? AND date <= ?
        `, [startOfMonth, endOfMonth]);

        const plaidTxs = await manager.all(`
            SELECT * FROM cached_transactions 
            WHERE date >= ? AND date <= ?
        `, [startOfMonth, endOfMonth]);

        const allTxs = [...manualTxs, ...plaidTxs];

        // 4. Fetch Metadata & Rules
        const metadata = await manager.getTransactionMetadataMap();
        const merchantRules = await manager.getMerchantMetadataMap();

        // 5. Process Transactions (Normalize, Overrides, Transfer Detection)
        const processedTxs = allTxs.map(t => {
            const txOverride = metadata[t.transaction_id] || {};
            const merchantName = t.merchant_name || t.name;
            const cleanedMerchant = cleanMerchantName(t.merchant_name);
            const cleanedName = cleanMerchantName(t.name);

            const merchantOverride = merchantRules[merchantName] ||
                merchantRules[t.name] ||
                merchantRules[cleanedMerchant] ||
                merchantRules[cleanedName] || {};

            // Resolve Category
            const pfDetailed = t.personal_finance_category?.detailed?.replace(/_/g, ' ')?.toLowerCase()?.replace(/\b\w/g, l => l.toUpperCase());
            const pfPrimary = t.personal_finance_category?.primary?.replace(/_/g, ' ')?.toLowerCase()?.replace(/\b\w/g, l => l.toUpperCase());
            const legacyCategory = t.category && t.category.length > 0 ? t.category[0] : null;

            const pfCategory = pfDetailed || pfPrimary || legacyCategory || 'General';
            const finalCategory = txOverride.category || merchantOverride.category || pfCategory;

            // Resolve Is Transfer
            // Logic: Metadata > Merchant Rule > Category Name > Plaid/Manual Data
            const isTransfer = txOverride.is_transfer !== undefined
                ? !!txOverride.is_transfer
                : (merchantOverride.is_transfer === 1 ? true : (t.is_transfer || (finalCategory && (finalCategory.toLowerCase().includes('transfer') || finalCategory.toLowerCase() === 'credit card payment'))));

            return {
                ...t,
                category: finalCategory, // Normalized for budget check
                is_transfer: isTransfer,
                amount: t.amount,
                date: t.date,
                transaction_id: t.transaction_id,
                pending: t.pending
            };
        });

        // 6. Deduplication (Remove pending if posted exists)
        const dedupedTxs = [];
        const seenKey = new Set();

        // Sort: Posted (pending=false/null) first, then by date desc
        processedTxs.sort((a, b) => {
            const aPending = !!a.pending;
            const bPending = !!b.pending;
            if (aPending === bPending) return new Date(b.date) - new Date(a.date);
            return aPending ? 1 : -1; // Posted first
        });

        for (const t of processedTxs) {
            // Create a key: account_id + rounded amount + approximate date bucket (5-day window)
            const dateObj = new Date(t.date);
            const dateBucket = Math.floor(dateObj.getTime() / (5 * 24 * 60 * 60 * 1000));
            // Round amount to cents
            const amountKey = Math.round(Math.abs(t.amount) * 100);

            const key = `${t.account_id}_${amountKey}_${dateBucket}`;
            const prevBucket = `${t.account_id}_${amountKey}_${dateBucket - 1}`;
            const nextBucket = `${t.account_id}_${amountKey}_${dateBucket + 1}`;

            if (t.pending && (seenKey.has(key) || seenKey.has(prevBucket) || seenKey.has(nextBucket))) {
                continue;
            }

            seenKey.add(key);
            dedupedTxs.push(t);
        }

        // 7. Calculate Spent per Budget
        const summary = budgets.map(b => {
            const budgetCats = b.categories ? JSON.parse(b.categories) : [];

            const relevantTxs = dedupedTxs.filter(tx => {
                // 1. Exclude Transfers
                if (tx.is_transfer) return false;

                // 2. Check Category Match
                if (budgetCats.length > 0) {
                    const hasMatch = budgetCats.some(budgetCat => isCategoryMatch(tx.category, budgetCat));
                    if (!hasMatch) return false;
                }

                return true;
            });

            const spent = relevantTxs.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0);

            // Use the date of the requested month context
            const periodDate = new Date(startOfMonth); // e.g. "2025-01-01"
            // Adjust for timezone offset issue? "yyyy-mm-dd" usually parses as UTC. 
            // construct explicit date from y/m params?
            // startOfMonth is constructed from local y/m in the "Prepare Date Range" block, but turned to string.
            // Let's rely on the y/m params directly if available.

            let periodStr;
            if (month && year) {
                const mIndex = parseInt(month) - 1;
                const d = new Date(year, mIndex);
                periodStr = d.toLocaleString('en-US', { month: 'short' });
            } else {
                periodStr = new Date().toLocaleString('en-US', { month: 'short' });
            }

            return {
                ...b,
                categories: budgetCats,
                spent: spent,
                limit: b.amount,
                period: periodStr,
                icon: 'DollarSign' // Placeholder
            };
        });

        res.json(summary);

    } catch (error) {
        console.error('Error fetching budget summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
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
            SELECT * FROM manual_transactions 
            WHERE date >= ? AND date <= ?
        `, [startOfMonth, endOfMonth]);

        const plaidTxs = await manager.all(`
            SELECT * FROM cached_transactions 
            WHERE date >= ? AND date <= ?
        `, [startOfMonth, endOfMonth]);

        const allTxs = [...manualTxs, ...plaidTxs];

        // Fetch Metadata & Rules for accurate categorization/transfer status
        const metadata = await manager.getTransactionMetadataMap();
        const merchantRules = await manager.getMerchantMetadataMap();

        const processedTxs = allTxs.map(t => {
            const txOverride = metadata[t.transaction_id] || {};
            const merchantName = t.merchant_name || t.name;
            const cleanedMerchant = cleanMerchantName(t.merchant_name);
            const cleanedName = cleanMerchantName(t.name);

            const merchantOverride = merchantRules[merchantName] ||
                merchantRules[t.name] ||
                merchantRules[cleanedMerchant] ||
                merchantRules[cleanedName] || {};

            // Resolve Category
            const pfDetailed = t.personal_finance_category?.detailed?.replace(/_/g, ' ')?.toLowerCase()?.replace(/\b\w/g, l => l.toUpperCase());
            const pfPrimary = t.personal_finance_category?.primary?.replace(/_/g, ' ')?.toLowerCase()?.replace(/\b\w/g, l => l.toUpperCase());
            const legacyCategory = t.category && t.category.length > 0 ? t.category[0] : null;

            const pfCategory = pfDetailed || pfPrimary || legacyCategory || 'General';
            const finalCategory = txOverride.category || merchantOverride.category || pfCategory;

            // Resolve Is Transfer
            // Logic: Metadata > Merchant Rule > Category Name > Plaid/Manual Data
            const isTransfer = txOverride.is_transfer !== undefined
                ? !!txOverride.is_transfer
                : (merchantOverride.is_transfer === 1 ? true : (t.is_transfer || (finalCategory && (finalCategory.toLowerCase().includes('transfer') || finalCategory.toLowerCase() === 'credit card payment'))));

            return {
                ...t,
                category: finalCategory, // Normalized for budget check
                is_transfer: isTransfer,
                // We typically just need amount/date/category for budgets, but preserving other fields helps UI
                amount: t.amount,
                date: t.date,
                name: t.name,
                merchant_name: t.merchant_name,
                transaction_id: t.transaction_id
            };
        });

        // Deduplication Logic (same as server.js)
        // Remove pending transactions if their posted versions exist
        const dedupedTxs = [];
        const seenKey = new Set();

        // Sort: Posted (pending=false/null) first, then by date desc
        processedTxs.sort((a, b) => {
            const aPending = !!a.pending;
            const bPending = !!b.pending;
            if (aPending === bPending) return new Date(b.date) - new Date(a.date);
            return aPending ? 1 : -1; // Posted first
        });

        for (const t of processedTxs) {
            // Create a key: account_id + rounded amount + approximate date bucket (5-day window)
            // Just in case date strings differ slightly between pending/posted
            const dateObj = new Date(t.date);
            const dateBucket = Math.floor(dateObj.getTime() / (5 * 24 * 60 * 60 * 1000));
            // Round amount to cents to avoid floating point mismatch
            const amountKey = Math.round(Math.abs(t.amount) * 100);

            // Key format: account_id_amount_dateBucket
            const key = `${t.account_id}_${amountKey}_${dateBucket}`;

            // Check adjacent buckets for date shifts
            const prevBucket = `${t.account_id}_${amountKey}_${dateBucket - 1}`;
            const nextBucket = `${t.account_id}_${amountKey}_${dateBucket + 1}`;

            // If pending and we've seen a posted match, skip it
            if (t.pending && (seenKey.has(key) || seenKey.has(prevBucket) || seenKey.has(nextBucket))) {
                continue;
            }

            seenKey.add(key);
            dedupedTxs.push(t);
        }

        const budgetCats = budget.categories ? JSON.parse(budget.categories) : [];

        const relevantTxs = dedupedTxs.filter(tx => {
            // Exclude transfers from budget calculations
            if (tx.is_transfer) return false;

            if (budgetCats.length > 0) {
                // Check if the transaction matches ANY of the selected budget categories
                const hasMatch = budgetCats.some(budgetCat => isCategoryMatch(tx.category, budgetCat));
                if (!hasMatch) return false;
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
            period: new Date(targetYear, targetMonth - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' }),
            transactions: relevantTxs
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
        categories, accounts, is_rollover, alert_percent,
        editMode, focusDate
    } = req.body;

    // DB-Agnostic Query Helper
    const execute = async (sql, params) => {
        if (manager.isPostgres) {
            let pIdx = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++pIdx}`);
            const { rows } = await manager.pool.query(pgSql, params);
            return rows[0];
        } else {
            await manager.run(sql, params);
            return { id, name }; // Minimal return for SQLite
        }
    };

    try {
        // Fetch original budget to determine split values
        const originalBudget = await manager.get('SELECT * FROM budgets WHERE id = ?', [id]);
        if (!originalBudget) return res.status(404).json({ error: 'Budget not found' });

        // Handle Split Logic (Exception / Future)
        // Guard: Do not split if the budget is already One Time (no recurrence to split)
        if (editMode && focusDate && ['this_only', 'all_future'].includes(editMode) && originalBudget.recurrence_frequency !== 'One Time') {
            const focus = new Date(focusDate);
            if (isNaN(focus.getTime())) return res.status(400).json({ error: 'Invalid focusDate' });

            const fYear = focus.getFullYear();
            const fMonth = focus.getMonth(); // 0-11

            // Dates Calculation
            const prevMonthEnd = new Date(fYear, fMonth, 0).toISOString().split('T')[0];
            const thisMonthStart = new Date(fYear, fMonth, 1).toISOString().split('T')[0];
            const thisMonthEnd = new Date(fYear, fMonth + 1, 0).toISOString().split('T')[0];
            const nextMonthStart = new Date(fYear, fMonth + 1, 1).toISOString().split('T')[0];

            const ensureString = (val) => typeof val === 'string' ? val : JSON.stringify(val || []);

            // 1. Close Old Budget (Ends previous month)
            await execute(
                'UPDATE budgets SET end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [prevMonthEnd, id]
            );

            // Common Insert SQL
            const insertSql = `
                INSERT INTO budgets (
                    name, amount, type, category_type, 
                    recurrence_frequency, start_date, end_date,
                    categories, accounts, is_rollover, alert_percent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            if (editMode === 'this_only') {
                // 2. Exception Budget (This Month Only)
                // Usies NEW values from req.body
                await execute(insertSql, [
                    name, amount, type || 'Personal', category_type || 'Expense',
                    'One Time', thisMonthStart, thisMonthEnd,
                    JSON.stringify(categories || []), JSON.stringify(accounts || []),
                    is_rollover ? 1 : 0, alert_percent || 70
                ]);

                // 3. Future Budget (Recurring, Starts Next Month, Reverts to OLD values)
                // Use originalBudget values
                await execute(insertSql, [
                    originalBudget.name, originalBudget.amount, originalBudget.type, originalBudget.category_type,
                    originalBudget.recurrence_frequency, nextMonthStart, null, // No end date
                    ensureString(originalBudget.categories), ensureString(originalBudget.accounts),
                    originalBudget.is_rollover, originalBudget.alert_percent
                ]);

            } else {
                // all_future
                // 2. Future Budget (Recurring, Starts This Month, NEW values)
                await execute(insertSql, [
                    name, amount, type || 'Personal', category_type || 'Expense',
                    recurrence_frequency || 'Monthly', thisMonthStart, null,
                    JSON.stringify(categories || []), JSON.stringify(accounts || []),
                    is_rollover ? 1 : 0, alert_percent || 70
                ]);
            }

            return res.json({ success: true, message: 'Budget split successfully' });
        }

        // Standard Update (In Place)
        const updateSql = `
            UPDATE budgets SET
                name = ?, amount = ?, type = ?, category_type = ?,
                recurrence_frequency = ?, start_date = ?,
                categories = ?, accounts = ?,
                is_rollover = ?, alert_percent = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const result = await execute(updateSql, [
            name, amount, type || 'Personal', category_type || 'Expense',
            recurrence_frequency || 'Monthly', start_date,
            JSON.stringify(categories || []), JSON.stringify(accounts || []),
            is_rollover ? 1 : 0, alert_percent || 70, id
        ]);

        res.json(result);

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



module.exports = router;
