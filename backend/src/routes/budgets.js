const express = require('express');
const router = express.Router();
const { manager, cleanMerchantName } = require('../database');

// Cache for category normalizations
let categoryNormalizations = null;
let lastNormalizationsLoad = null;
const NORMALIZATION_CACHE_DURATION = 60000; // 1 minute

// Load category normalizations from database
async function loadNormalizations() {
    try {
        const now = Date.now();
        // Only reload if cache is empty or expired
        if (!categoryNormalizations || !lastNormalizationsLoad || (now - lastNormalizationsLoad) > NORMALIZATION_CACHE_DURATION) {
            const rules = await manager.getCategoryNormalizations();
            categoryNormalizations = rules.reduce((acc, rule) => {
                acc[rule.from_category.toLowerCase()] = rule.to_category;
                return acc;
            }, {});
            lastNormalizationsLoad = now;
        }
        return categoryNormalizations;
    } catch (error) {
        console.error('Error loading category normalizations:', error);
        return {};
    }
}

// Explode transactions with splits into individual child transactions
// This mirrors the logic in server.js /api/transactions endpoint
function explodeSplits(transactions, metadata = {}) {
    const result = [];
    for (const t of transactions) {
        const txOverride = metadata[t.transaction_id] || {};
        let splits = txOverride.splits || t.splits;

        if (typeof splits === 'string') {
            try { splits = JSON.parse(splits); } catch (e) { splits = null; }
        }

        if (Array.isArray(splits) && splits.length > 0) {
            // Determine sign based on parent amount (Income is negative, Expense is positive)
            const sign = t.amount < 0 ? -1 : 1;

            splits.forEach((split, idx) => {
                const splitAmount = Math.abs(parseFloat(split.amount || 0)) * sign;
                result.push({
                    ...t,
                    transaction_id: `${t.transaction_id}_split_${idx}`,
                    original_transaction_id: t.transaction_id,
                    amount: splitAmount,
                    category: split.category,
                    personal_finance_category: { primary: split.category },
                    splits: null // Clear splits on children to prevent confusion
                });
            });
        } else {
            result.push(t);
        }
    }
    return result;
}

// Normalize category name using loaded rules
function normalizeCategory(category) {
    if (!category) return 'Uncategorized';

    const normalized = category.trim();
    const lowerNormalized = normalized.toLowerCase();

    // Use loaded normalizations if available
    if (categoryNormalizations && categoryNormalizations[lowerNormalized]) {
        return categoryNormalizations[lowerNormalized];
    }

    // Fallback: Pattern-based normalization for verbose Plaid names
    // e.g. "Food And Drink Restaurant" -> "Restaurants"
    const patterns = [
        { regex: /^food\s+and\s+drink\s+restaurant/i, result: 'Restaurants' },
        { regex: /^food\s+and\s+drink\s+coffee/i, result: 'Coffee' },
        { regex: /^food\s+and\s+drink/i, result: 'Food & Drink' },
        { regex: /^shops\s+-\s+/i, result: (match) => match.replace(/^shops\s+-\s+/i, '') },
        { regex: /^general\s+merchandise/i, result: 'Shopping' },
        { regex: /^travel/i, result: 'Entertainment' },
    ];

    for (const pattern of patterns) {
        if (pattern.regex.test(normalized)) {
            if (typeof pattern.result === 'function') {
                return pattern.result(normalized);
            }
            return pattern.result;
        }
    }

    return normalized;
}

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

    // Normalize both categories before comparison
    const txCat = normalizeCategory(txCategory).toLowerCase();
    const bdCat = normalizeCategory(budgetCategory).toLowerCase();

    // 1. Direct Match (after normalization)
    if (txCat === bdCat) return true;

    // 2. Parent Match: If budgetCategory is a Parent, check if txCategory is one of its children
    // Find the proper case key in taxonomy that matches budgetCategory
    const taxonomyKey = Object.keys(CATEGORY_TAXONOMY).find(k => k.toLowerCase() === bdCat);
    if (taxonomyKey) {
        const subCategories = CATEGORY_TAXONOMY[taxonomyKey];
        if (subCategories.some(sub => normalizeCategory(sub).toLowerCase() === txCat)) return true;
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
        // Load category normalizations
        await loadNormalizations();

        const queryDate = req.query.date ? new Date(req.query.date) : new Date();
        const year = queryDate.getFullYear();
        const month = queryDate.getMonth();
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        // 1. Fetch Budgets
        const budgets = await manager.all('SELECT * FROM budgets WHERE is_active = 1 ORDER BY created_at DESC');

        // 2. Fetch Transactions for the Month (Cached + Manual)
        // We need fields to determine match: category, overrides, manual_budget_id, exclude_from_budget
        const transactionSql = `
            SELECT 
                t.transaction_id, t.amount, t.date, t.personal_finance_category,
                m.category as manual_category, m.exclude_from_budget, m.manual_budget_id,
                'plaid' as source
            FROM cached_transactions t
            LEFT JOIN transaction_metadata m ON t.transaction_id = m.transaction_id
            WHERE t.date >= ? AND t.date <= ?
            
            UNION ALL
            
            SELECT 
                mt.transaction_id, mt.amount, mt.date, mt.category as personal_finance_category, 
                m.category as manual_category, m.exclude_from_budget, m.manual_budget_id,
                'manual' as source
            FROM manual_transactions mt
            LEFT JOIN transaction_metadata m ON mt.transaction_id = m.transaction_id
            WHERE mt.date >= ? AND mt.date <= ?
        `;

        const transactions = await manager.all(transactionSql, [startDate, endDate, startDate, endDate]);

        // 3. Process Budgets
        const parsedBudgets = budgets.map(b => {
            const budget = {
                ...b,
                categories: b.categories ? JSON.parse(b.categories) : [],
                accounts: b.accounts ? JSON.parse(b.accounts) : []
            };

            // Calculate Spent for this budget
            let spent = 0;
            const bStart = budget.start_date ? new Date(budget.start_date) : null;
            const bEnd = budget.end_date ? new Date(budget.end_date) : null;

            transactions.forEach(tx => {
                // 1. Exclude Check
                if (tx.exclude_from_budget) return;

                // 2. Manual Override Check
                if (tx.manual_budget_id) {
                    if (String(tx.manual_budget_id) === String(budget.id)) {
                        spent += tx.amount;
                    }
                    return; // If manual budget is set (even if not this one), it explicitly targets a budget, so skip auto-match
                }

                // 3. Auto-Match Logic

                // Date Overlap Check (Transaction vs Budget Active Period)
                // Note: We already filtered transactions by the requested month.
                // We just need to ensure the budget was active on the transaction date.
                const txDate = new Date(tx.date);
                if (bStart && txDate < bStart) return;
                if (bEnd && txDate > bEnd) return;

                // Category Match Check
                let txCategory = tx.personal_finance_category;
                // Resolve Category: Manual Override > Metadata Category > Transaction Category
                if (tx.manual_category) {
                    txCategory = tx.manual_category;
                } else if (tx.source === 'plaid' && typeof txCategory === 'string') {
                    // Parse JSON if plaid (it comes as string from DB usually)
                    try {
                        const parsed = JSON.parse(txCategory);
                        txCategory = parsed.primary;
                    } catch (e) {
                        // fallback if simple string
                    }
                }

                // Check against budget categories
                let isMatch = false;
                if (budget.categories && Array.isArray(budget.categories)) {
                    isMatch = budget.categories.some(cat => isCategoryMatch(txCategory, cat));
                } else {
                    isMatch = isCategoryMatch(txCategory, budget.category);
                }

                if (isMatch) {
                    spent += tx.amount;
                }
            });

            budget.spent = spent;
            budget.remaining = budget.amount - spent;
            return budget;
        });

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
        // Load category normalizations
        await loadNormalizations();

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
        // 2. Fetch and Filter Budgets (Optimized SQL)
        // Check Overlap: Budget Start <= Month End AND Budget End >= Month Start
        // Handled nulls: if end_date is null, it's effectively infinite.
        const budgetSql = `
            SELECT * FROM budgets 
            WHERE is_active = 1 
            AND (start_date IS NULL OR start_date <= ?) 
            AND (end_date IS NULL OR end_date >= ?)
        `;
        let budgets = await manager.all(budgetSql, [endOfMonth, startOfMonth]);

        // Deduplicate by Name: If multiple budgets exist for same period (e.g. edge case overlaps),
        // prefer the 'One Time' (Exception) budget over 'Monthly' (Recurring).
        const budgetMap = new Map();
        budgets.forEach(b => {
            if (!budgetMap.has(b.name)) {
                budgetMap.set(b.name, b);
            } else {
                const existing = budgetMap.get(b.name);
                // If current is One Time and existing is NOT, replace existing
                if (b.recurrence_frequency === 'One Time' && existing.recurrence_frequency !== 'One Time') {
                    budgetMap.set(b.name, b);
                }
                // If both same type, maybe pick most recently created?
                else if (b.recurrence_frequency === existing.recurrence_frequency) {
                    if (new Date(b.created_at) > new Date(existing.created_at)) {
                        budgetMap.set(b.name, b);
                    }
                }
            }
        });
        budgets = Array.from(budgetMap.values());

        // 3. Fetch Raw Transactions with account information
        const manualTxs = await manager.all(`
            SELECT 
                mt.*,
                ca.name as account_name,
                ca.type as account_type,
                ca.subtype as account_subtype,
                pi.institution_name,
                am.owner_name as account_owner_name
            FROM manual_transactions mt
            LEFT JOIN cached_accounts ca ON mt.account_id = ca.account_id
            LEFT JOIN plaid_items pi ON ca.item_id = pi.item_id
            LEFT JOIN account_metadata am ON mt.account_id = am.account_id
            WHERE mt.date >= ? AND mt.date <= ?
        `, [startOfMonth, endOfMonth]);

        const plaidTxs = await manager.all(`
            SELECT 
                ct.*,
                ca.name as account_name,
                ca.type as account_type,
                ca.subtype as account_subtype,
                pi.institution_name,
                am.owner_name as account_owner_name
            FROM cached_transactions ct
            LEFT JOIN cached_accounts ca ON ct.account_id = ca.account_id
            LEFT JOIN plaid_items pi ON ca.item_id = pi.item_id
            LEFT JOIN account_metadata am ON ct.account_id = am.account_id
            WHERE ct.date >= ? AND ct.date <= ?
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
            // Parse personal_finance_category if it's a JSON string
            let pfcObj = t.personal_finance_category;
            if (typeof pfcObj === 'string') {
                try {
                    pfcObj = JSON.parse(pfcObj);
                } catch (e) {
                    pfcObj = { primary: pfcObj };
                }
            }

            const pfDetailed = pfcObj?.detailed?.replace(/_/g, ' ')?.toLowerCase()?.replace(/\b\w/g, l => l.toUpperCase());
            const pfPrimary = pfcObj?.primary?.replace(/_/g, ' ')?.toLowerCase()?.replace(/\b\w/g, l => l.toUpperCase());
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
                pending: t.pending,
                manual_budget_id: txOverride.manual_budget_id,
                exclude_from_budget: txOverride.exclude_from_budget
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

        // 6b. Explode split transactions so each portion counts towards its category
        const explodedTxs = explodeSplits(dedupedTxs, metadata);

        // 7. Calculate Spent per Budget
        const summary = budgets.map(b => {
            const budgetCats = b.categories ? JSON.parse(b.categories) : [];
            const budgetAccounts = b.accounts ? JSON.parse(b.accounts) : [];

            const relevantTxs = explodedTxs.filter(tx => {
                // 1. Exclude from Budget (Global Override)
                if (tx.exclude_from_budget === 1) return false;

                // 2. Manual Budget Assignment (Specific Override)
                // If manually assigned to THIS budget, include it
                if (tx.manual_budget_id && String(tx.manual_budget_id) === String(b.id)) return true;
                // If manually assigned to ANOTHER budget, exclude it
                if (tx.manual_budget_id && String(tx.manual_budget_id) !== String(b.id)) return false;

                // 3. Exclude Transfers (Standard Rule)
                if (tx.is_transfer) return false;

                // 4. Check Account Match (if accounts are selected)
                if (budgetAccounts.length > 0) {
                    if (!budgetAccounts.includes(tx.account_id)) return false;
                }

                // 5. Check Category Match
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
                remaining: b.amount - spent,
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
        // Load category normalizations
        await loadNormalizations();

        const budget = await manager.get('SELECT * FROM budgets WHERE id = ?', [id]);
        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        const now = new Date();
        const targetYear = year ? parseInt(year) : now.getFullYear();
        const targetMonth = month ? parseInt(month) : now.getMonth() + 1; // 1-12

        const startOfMonth = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

        // Determine query range based on Rollover
        let queryStartDate = startOfMonth;
        const isRollover = !!budget.is_rollover;
        const budgetStartDate = budget.start_date ? new Date(budget.start_date) : new Date(budget.created_at);
        const budgetStartDateStr = budgetStartDate.toISOString().split('T')[0];

        if (isRollover && budgetStartDate < new Date(startOfMonth)) {
            queryStartDate = budgetStartDateStr;
        }

        // Fetch transactions for the extended range with account information
        const manualTxs = await manager.all(`
            SELECT 
                mt.*,
                ca.name as account_name,
                ca.type as account_type,
                ca.subtype as account_subtype,
                pi.institution_name,
                am.owner_name as account_owner_name
            FROM manual_transactions mt
            LEFT JOIN cached_accounts ca ON mt.account_id = ca.account_id
            LEFT JOIN plaid_items pi ON ca.item_id = pi.item_id
            LEFT JOIN account_metadata am ON mt.account_id = am.account_id
            WHERE mt.date >= ? AND mt.date <= ?
        `, [queryStartDate, endOfMonth]);

        const plaidTxs = await manager.all(`
            SELECT 
                ct.*,
                ca.name as account_name,
                ca.type as account_type,
                ca.subtype as account_subtype,
                pi.institution_name,
                am.owner_name as account_owner_name
            FROM cached_transactions ct
            LEFT JOIN cached_accounts ca ON ct.account_id = ca.account_id
            LEFT JOIN plaid_items pi ON ca.item_id = pi.item_id
            LEFT JOIN account_metadata am ON ct.account_id = am.account_id
            WHERE ct.date >= ? AND ct.date <= ?
        `, [queryStartDate, endOfMonth]);

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
            // Parse personal_finance_category if it's a JSON string
            let pfcObj = t.personal_finance_category;
            if (typeof pfcObj === 'string') {
                try {
                    pfcObj = JSON.parse(pfcObj);
                } catch (e) {
                    // If it's not JSON, treat it as a simple string category
                    pfcObj = { primary: pfcObj };
                }
            }

            const pfDetailed = pfcObj?.detailed?.replace(/_/g, ' ')?.toLowerCase()?.replace(/\b\w/g, l => l.toUpperCase());
            const pfPrimary = pfcObj?.primary?.replace(/_/g, ' ')?.toLowerCase()?.replace(/\b\w/g, l => l.toUpperCase());
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
                transaction_id: t.transaction_id,
                manual_budget_id: txOverride.manual_budget_id,
                exclude_from_budget: txOverride.exclude_from_budget
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

        // Explode split transactions so each portion counts towards its category
        const explodedTxs = explodeSplits(dedupedTxs, metadata);

        const budgetCats = budget.categories ? JSON.parse(budget.categories) : [];
        const budgetAccounts = budget.accounts ? JSON.parse(budget.accounts) : [];

        const relevantTxs = explodedTxs.filter(tx => {
            // 1. Exclude from Budget (Global Override)
            if (tx.exclude_from_budget === 1) return false;

            // 2. Manual Budget Assignment (Specific Override)
            if (tx.manual_budget_id && String(tx.manual_budget_id) === String(id)) return true;
            if (tx.manual_budget_id && String(tx.manual_budget_id) !== String(id)) return false;

            // 3. Exclude transfers from budget calculations
            if (tx.is_transfer) return false;

            // 4. Check Account Match (if accounts are selected)
            if (budgetAccounts.length > 0) {
                if (!budgetAccounts.includes(tx.account_id)) return false;
            }

            // 5. Check Category Match
            if (budgetCats.length > 0) {
                // Check if the transaction matches ANY of the selected budget categories
                const hasMatch = budgetCats.some(budgetCat => isCategoryMatch(tx.category, budgetCat));
                if (!hasMatch) return false;
            }
            return true;
        });

        // Filter for expenses only (amount > 0)
        const expenseTxs = relevantTxs.filter(tx => tx.amount > 0);
        const spent = expenseTxs.reduce((sum, tx) => sum + tx.amount, 0);

        const result = {
            ...budget,
            categories: budgetCats,
            accounts: budget.accounts ? JSON.parse(budget.accounts) : [],
            spent: spent,
            limit: budget.amount,
            period: new Date(targetYear, targetMonth - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' }),
            transactions: expenseTxs
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

            // Fix: Manual parse to avoid Timezone shift (UTC -> Local)
            // focusDate is "YYYY-MM-DD"
            const [fYearStr, fMonthStr] = focusDate.split('-');
            if (!fYearStr || !fMonthStr) return res.status(400).json({ error: 'Invalid focusDate format' });

            const fYear = parseInt(fYearStr);
            const fMonth = parseInt(fMonthStr) - 1; // 0-based index for Date constructor

            // Dates Calculation
            // Date(year, monthIndex, 0) gives last day of previous month.
            // Date(year, monthIndex, 1) gives first day of month.
            // Using components ensures we construct local midnight for the intended month.
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
