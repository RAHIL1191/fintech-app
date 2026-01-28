const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const path = require('path');
const fs = require('fs');
const { manager: db, cleanMerchantName } = require('./database');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const logToFile = (msg) => {
    const logMsg = `${new Date().toISOString()} - ${msg}\n`;
    fs.appendFileSync(path.join(__dirname, '../backend.log'), logMsg);
};

logToFile('Server starting or restarting...');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
    const msg = `${req.method} ${req.url}`;
    console.log(`${new Date().toISOString()} - ${msg}`);
    logToFile(msg);
    next();
});

console.log('Plaid Env:', process.env.PLAID_ENV);
const clientId = (process.env.PLAID_CLIENT_ID || '').trim();
const secret = (process.env.PLAID_SECRET || '').trim();
console.log('Plaid Client ID Prefix:', clientId.substring(0, 3));
console.log('Plaid Secret Prefix:', secret.substring(0, 3));

const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID ? process.env.PLAID_CLIENT_ID.trim() : '',
            'PLAID-SECRET': process.env.PLAID_SECRET ? process.env.PLAID_SECRET.trim() : '',
        },
    },
});

const client = new PlaidApi(configuration);

// Import route modules
const billsRoutes = require('./routes/bills');
const budgetsRoutes = require('./routes/budgets');
const notificationsRoutes = require('./routes/notifications');

// --- Routes ---

// API Routes
app.use('/api/bills', billsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/notifications', notificationsRoutes);


app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'FinTech Backend API is live', mode: process.env.PLAID_ENV });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// Fetch Available Categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await db.getCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Duplicate POST /api/categories removed from here.
// Correct implementation is further down.

// Update a category (set parent_category, icon, color)
app.put('/api/categories/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const updated = await db.updateCategory(decodeURIComponent(name), req.body);
        res.json(updated);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete a category
app.delete('/api/categories/:name', async (req, res) => {
    try {
        const { name } = req.params;
        await db.deleteCategory(decodeURIComponent(name));
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// ==================== Category Normalizations ====================

// Get all normalization rules
app.get('/api/category-normalizations', async (req, res) => {
    try {
        const normalizations = await db.getCategoryNormalizations();
        res.json({ normalizations });
    } catch (error) {
        console.error('Error fetching normalizations:', error);
        res.status(500).json({ error: 'Failed to fetch normalizations' });
    }
});

// Create a new normalization rule
app.post('/api/category-normalizations', async (req, res) => {
    try {
        const { from_category, to_category } = req.body;
        if (!from_category || !to_category) {
            return res.status(400).json({ error: 'from_category and to_category are required' });
        }
        const normalization = await db.createCategoryNormalization(from_category, to_category);
        res.json(normalization);
    } catch (error) {
        console.error('Error creating normalization:', error);
        res.status(500).json({ error: 'Failed to create normalization' });
    }
});

// Update a normalization rule
app.put('/api/category-normalizations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { from_category, to_category } = req.body;
        const normalization = await db.updateCategoryNormalization(id, from_category, to_category);
        res.json(normalization);
    } catch (error) {
        console.error('Error updating normalization:', error);
        res.status(500).json({ error: 'Failed to update normalization' });
    }
});

// Delete a normalization rule
app.delete('/api/category-normalizations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.deleteCategoryNormalization(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting normalization:', error);
        res.status(500).json({ error: 'Failed to delete normalization' });
    }
});

// Duplicate route removed


// Update Metadata (Generic endpoint for Transactions, Accounts, Merchants)
app.post('/api/metadata/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const data = req.body;
    try {
        await db.setMetadata(type, id, data);
        res.json({ status: 'success' });
    } catch (error) {
        console.error('Metadata update failed:', error);
        res.status(500).json({ error: 'Failed to update metadata' });
    }
});

// Create a link token
app.post('/api/create_link_token', async (req, res) => {
    try {
        const { access_token, item_id } = req.body;

        const request = {
            user: { client_user_id: 'user-id' },
            client_name: 'FinTech App',
            country_codes: ['US', 'CA'],
            language: 'en',
        };

        let tokenToUse = access_token;

        // If item_id provided, look up the token from DB
        if (!tokenToUse && item_id) {
            const items = await db.getAllPlaidItems();
            const item = items.find(i => i.item_id === item_id);
            if (item) {
                tokenToUse = item.access_token;
                console.log(`Resolved Item ID ${item.item_id} to token ${tokenToUse.substring(0, 10)}...`);
            }
        }

        if (tokenToUse) {
            // Update Mode: Repair existing item
            request.access_token = tokenToUse;
            // Products cannot be populated in Update Mode
        } else {
            // New Link Mode
            request.products = ['transactions'];
        }

        const response = await client.linkTokenCreate(request);
        res.json(response.data);
    } catch (error) {
        const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Error creating link token:', errorMsg);
        logToFile(`Error creating link token: ${errorMsg}`);
        res.status(500).json({ error: 'Failed to create link token', details: errorMsg });
    }
});

// Exchange public token for access token
app.post('/api/exchange_public_token', async (req, res) => {
    const { public_token } = req.body;
    try {
        const response = await client.itemPublicTokenExchange({
            public_token: public_token,
        });
        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;

        // Save to database
        const { metadata } = req.body; // Expect metadata from frontend
        const institutionName = metadata?.institution?.name || 'Unknown Bank';

        await db.upsertPlaidItem(itemId, accessToken, institutionName);
        console.log(`Saved Plaid Item: ${itemId} (${institutionName})`);

        res.json({ access_token: accessToken, item_id: itemId });
    } catch (error) {
        console.error('Error exchanging public token:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to exchange token' });
    }
});

// Delete Plaid Item
app.post('/api/item/delete', async (req, res) => {
    const { item_id } = req.body;
    if (!item_id) {
        return res.status(400).json({ error: 'Missing item_id' });
    }

    try {
        console.log(`Request to delete item: ${item_id}`);

        // 1. Get access token to call Plaid
        const items = await db.getAllPlaidItems();
        const item = items.find(i => i.item_id === item_id);

        if (item) {
            try {
                // Call Plaid to remove (Stop Billing)
                await client.itemRemove({ access_token: item.access_token });
                console.log(`Plaid API: Item ${item_id} removed successfully.`);
            } catch (plaidErr) {
                // Ignore if already removed or invalid, valid to proceed with local cleanup
                console.warn(`Plaid API Remove Warning: ${plaidErr.message}`);
            }
        } else {
            console.warn(`Item ${item_id} not found locally, proceeding to delete any residuals.`);
        }

        // 2. Delete from DB (Items, Accounts, Transactions)
        await db.deletePlaidItem(item_id);

        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// Fetch Transactions
app.get('/api/transactions', async (req, res) => {
    const { sync } = req.query;

    try {
        const items = await db.getAllPlaidItems();
        if (items.length === 0) {
            return res.json({ transactions: [], total_transactions: 0 });
        }

        let allTransactions = [];
        const itemIds = items.map(i => i.item_id);

        // 1. Try Cache First
        if (sync !== 'true') {
            allTransactions = await db.getCachedTransactions(itemIds);
        }

        // 2. If sync=true or cache empty, fetch from Plaid
        if (sync === 'true' || allTransactions.length === 0) {
            console.log(`Backend: Syncing transactions from Plaid for ${items.length} items...`);
            const now = new Date();
            const endDate = now.toISOString().split('T')[0];

            // Optimization: Only sync/prune last 6 months
            const startObj = new Date();
            startObj.setMonth(startObj.getMonth() - 6);
            const startDate = startObj.toISOString().split('T')[0];

            const promises = items.map(async (item) => {
                try {
                    const response = await client.transactionsGet({
                        access_token: item.access_token,
                        start_date: startDate,
                        end_date: endDate,
                        options: { count: 500, offset: 0 }
                    });
                    const transactions = response.data.transactions;

                    // Debug: Show which transactions have authorized_date
                    const withAuthDate = transactions.filter(t => t.authorized_date).length;
                    console.log(`\n--- Plaid Sync Results ---`);
                    console.log(`Total: ${transactions.length} transactions, ${withAuthDate} have authorized_date\n`);

                    // Show transactions from mid-January to help find the gas transaction
                    const janTransactions = transactions.filter(t =>
                        t.date >= '2026-01-15' && t.date <= '2026-01-20'
                    );
                    if (janTransactions.length > 0) {
                        janTransactions.forEach(t => {
                            console.log(`  ${t.date} ${t.authorized_date ? `(auth: ${t.authorized_date})` : '(NO AUTH DATE)'} - ${t.name.substring(0, 40)} - $${t.amount}`);
                        });
                        console.log('');
                    }

                    // Update cache
                    await db.upsertTransactions(transactions, item.item_id);

                    // --- PRUNING / RECONCILIATION ---
                    // 1. Get all transaction IDs currently in DB for this item & time range
                    const cachedIdsSet = await db.getCachedTransactionIds(item.item_id, startDate, endDate);

                    // 2. Get all transaction IDs returned by Plaid now
                    const plaidIdsSet = new Set(transactions.map(t => t.transaction_id));

                    // 3. Identify stale IDs (In Cache but NOT in Plaid response)
                    const staleIds = [];
                    for (const cachedId of cachedIdsSet) {
                        if (!plaidIdsSet.has(cachedId)) {
                            staleIds.push(cachedId);
                        }
                    }

                    // 4. Delete stale transactions
                    if (staleIds.length > 0) {
                        console.log(`Pruning: Found ${staleIds.length} stale transactions for item ${item.item_id}. Deleting...`);
                        await db.deleteCachedTransactions(staleIds);
                    } else {
                        console.log('Pruning: No stale transactions found.');
                    }
                    // --------------------------------

                    return transactions;
                } catch (err) {
                    const errorData = err.response ? err.response.data : {};
                    console.error(`Error fetching transactions for ${item.institution_name}:`, errorData.error_message || err.message);

                    // Return error structure for aggregation
                    return {
                        error: {
                            institution: item.institution_name,
                            code: errorData.error_code || 'SYNC_ERROR',
                            message: errorData.error_message || err.message
                        },
                        transactions: []
                    };
                }
            });

            const results = await Promise.all(promises);

            // Extract errors and successful transactions
            const currentSyncErrors = results.filter(r => r && r.error).map(r => r.error);
            const successBatches = results.map(r => Array.isArray(r) ? r : (r.transactions || []));

            // After sync, reload everything from DB to ensure metadata merging is consistent
            // Note: DB upsert already happened in the loop for successful batches
            allTransactions = await db.getCachedTransactions(itemIds);

            // Attach current sync errors to metadata map for this request scope or return directly
            // We'll attach to the response object later
            req.sync_errors = currentSyncErrors;
        }

        // 3. Merge with local overrides (metadata), Merchant Rules, and ADD Manual Transactions
        const metadata = await db.getTransactionMetadataMap();
        const merchantRules = await db.getMerchantMetadataMap();
        const manualTransactions = await db.getManualTransactions();

        // Map manual transactions to the standard format
        const mappedManual = manualTransactions.map(t => {
            const finalCategory = t.category || 'General';
            return {
                ...t,
                transaction_id: t.transaction_id,
                personal_finance_category: { primary: finalCategory },
                category: [finalCategory],
                is_manual: true,
                created_at: t.created_at,
                updated_at: t.updated_at,
                device_info: t.device_info || 'Manual Entry'
            };
        });

        const mergedTransactions = allTransactions.map(t => {
            const txOverride = metadata[t.transaction_id] || {};
            // Use merchant_name if available, fallback to name for rule matching
            const merchantName = t.merchant_name || t.name;
            const cleanedMerchant = cleanMerchantName(t.merchant_name);
            const cleanedName = cleanMerchantName(t.name);

            const merchantOverride = merchantRules[merchantName] ||
                merchantRules[t.name] ||
                merchantRules[cleanedMerchant] ||
                merchantRules[cleanedName] || {};

            // Priority: Transaction Metadata > Merchant Rule > Plaid Detailed Category > Plaid Primary Category > Plaid Legacy Category
            const pfDetailed = t.personal_finance_category?.detailed?.replace(/_/g, ' ')
                ?.toLowerCase()
                ?.replace(/\b\w/g, l => l.toUpperCase());
            const pfPrimary = t.personal_finance_category?.primary?.replace(/_/g, ' ')
                ?.toLowerCase()
                ?.replace(/\b\w/g, l => l.toUpperCase());

            const legacyCategory = t.category && t.category.length > 0 ? t.category[0] : null;

            const pfCategory = pfDetailed || pfPrimary || legacyCategory || 'General';
            const finalCategory = txOverride.category || merchantOverride.category || pfCategory;

            return {
                ...t,
                personal_finance_category: {
                    primary: finalCategory
                },
                category: [finalCategory],
                name: txOverride.merchant_name || t.name,
                account_id: txOverride.account_id || t.account_id,
                date: txOverride.date || t.date,
                authorized_date: t.authorized_date,
                time: txOverride.time || null,
                note: txOverride.note || t.note,
                recurring_frequency: txOverride.recurring_frequency || t.recurring_frequency,
                is_transfer: txOverride.is_transfer !== undefined
                    ? !!txOverride.is_transfer
                    : (merchantOverride.is_transfer === 1 ? true : (t.is_transfer || (finalCategory && (finalCategory.toLowerCase().includes('transfer') || finalCategory.toLowerCase() === 'credit card payment')))),
                created_at: txOverride.created_at || t.updated_at || new Date().toISOString(),
                updated_at: txOverride.updated_at || t.updated_at || new Date().toISOString(),
                device_info: txOverride.device_info || 'Plaid Sync',
                splits: txOverride.splits || null
            };
        });

        // 4. Post-process: Explode Split Transactions
        let combined = [...mappedManual, ...mergedTransactions];

        // 4.1 Deduplicate: Remove pending transactions if their posted versions exist
        // Plaid creates different transaction_ids for pending vs posted transactions
        const deduped = [];
        const seenKey = new Set();

        // Sort so posted transactions come before pending ones (pending=true sorts after pending=false)
        combined.sort((a, b) => {
            if (a.pending === b.pending) return new Date(b.date) - new Date(a.date);
            return a.pending ? 1 : -1; // Posted first
        });

        for (const t of combined) {
            // Create a key: account_id + rounded amount + approximate date bucket (5-day window)
            const dateObj = new Date(t.date);
            const dateBucket = Math.floor(dateObj.getTime() / (5 * 24 * 60 * 60 * 1000)); // 5-day buckets
            const amountKey = Math.round(Math.abs(t.amount) * 100); // Round to cents
            const key = `${t.account_id}_${amountKey}_${dateBucket}`;

            // Also check adjacent date buckets to catch edge cases
            const prevBucket = `${t.account_id}_${amountKey}_${dateBucket - 1}`;
            const nextBucket = `${t.account_id}_${amountKey}_${dateBucket + 1}`;

            // Skip if we've seen a similar transaction (posted version already added)
            if (t.pending && (seenKey.has(key) || seenKey.has(prevBucket) || seenKey.has(nextBucket))) {
                console.log(`Dedup: Skipping pending transaction ${t.name} (${t.amount}) - posted version exists`);
                continue;
            }

            seenKey.add(key);
            deduped.push(t);
        }

        combined = deduped;

        // OPTIONAL: Filter by transaction_id if provided (e.g. for fetching details/siblings)
        if (req.query.transaction_id) {
            combined = combined.filter(t => t.transaction_id === req.query.transaction_id);
        }

        // OPTIONAL: Search filter
        if (req.query.search && req.query.search.trim().length > 0) {
            const searchLower = req.query.search.toLowerCase();
            combined = combined.filter(t =>
                (t.name && t.name.toLowerCase().includes(searchLower)) ||
                (t.merchant_name && t.merchant_name.toLowerCase().includes(searchLower)) ||
                (t.personal_finance_category?.primary && t.personal_finance_category.primary.toLowerCase().includes(searchLower))
            );
        }

        const finalTransactions = [];

        for (const t of combined) {
            let splits = t.splits;
            if (typeof splits === 'string') {
                try { splits = JSON.parse(splits); } catch (e) { splits = null; }
            }

            if (Array.isArray(splits) && splits.length > 0) {
                // Determine sign based on parent amount (Income is negative, Expense is positive)
                const sign = t.amount < 0 ? -1 : 1;
                console.log(`Exploding transaction ${t.transaction_id} into ${splits.length} splits.`);

                splits.forEach((split, idx) => {
                    const splitAmount = Math.abs(parseFloat(split.amount || 0)) * sign;
                    finalTransactions.push({
                        ...t,
                        transaction_id: `${t.transaction_id}_split_${idx}`,
                        original_transaction_id: t.transaction_id,
                        amount: splitAmount,
                        // We keep the main intent (name, date, etc) but override category/amount
                        category: [split.category],
                        personal_finance_category: {
                            primary: split.category
                        },
                        // Clear splits on children to prevent confusion
                        splits: null
                    });
                });
            } else {
                finalTransactions.push(t);
            }
        }

        res.json({
            transactions: finalTransactions,
            total_transactions: finalTransactions.length,
            sync_errors: req.sync_errors || []
        });

    } catch (error) {
        console.error('Error in /api/transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Fetch Accounts (Balances)
app.get('/api/accounts', async (req, res) => {
    const { sync } = req.query;

    try {
        const items = await db.getAllPlaidItems();
        if (items.length === 0) {
            return res.json({ accounts: [], item: {}, request_id: '' });
        }

        const allAccounts = [];
        const itemsToFetchFromPlaid = [];

        // 1. Check Cache first (unless sync=true)
        if (sync !== 'true') {
            for (const item of items) {
                const cached = await db.getCachedAccountsByItem(item.item_id);
                if (cached.length > 0) {
                    allAccounts.push(...cached.map(a => ({
                        ...a,
                        item_id: item.item_id,
                        institution_name: item.institution_name
                    })));
                } else {
                    itemsToFetchFromPlaid.push(item);
                }
            }
        } else {
            itemsToFetchFromPlaid.push(...items);
        }

        // 2. Fetch from Plaid for missing/sync
        if (itemsToFetchFromPlaid.length > 0) {
            console.log(`Backend: Fetching accounts AND transactions from Plaid for ${itemsToFetchFromPlaid.length} items...`);

            const now = new Date();
            const endDate = now.toISOString().split('T')[0];
            const startDate = '2023-01-01'; // Default range matching /transactions endpoint

            const promises = itemsToFetchFromPlaid.map(async (item) => {
                try {
                    // Fetch Accounts and Transactions in parallel
                    const [accountsResponse, transactionsResponse] = await Promise.allSettled([
                        client.accountsGet({ access_token: item.access_token }),
                        client.transactionsGet({
                            access_token: item.access_token,
                            start_date: startDate,
                            end_date: endDate,
                            options: { count: 100, offset: 0 }
                        })
                    ]);

                    // Handle Accounts Response
                    let accounts = [];
                    if (accountsResponse.status === 'fulfilled') {
                        accounts = accountsResponse.value.data.accounts;
                        await db.upsertAccounts(accounts, item.item_id);
                    } else {
                        throw accountsResponse.reason; // Re-throw to handle in outer catch for error object creation
                    }

                    // Handle Transactions Response (Log error but don't fail the request)
                    if (transactionsResponse.status === 'fulfilled') {
                        const transactions = transactionsResponse.value.data.transactions;
                        if (transactions && transactions.length > 0) {
                            console.log(`Synced ${transactions.length} transactions for ${item.institution_name}`);
                            await db.upsertTransactions(transactions, item.item_id);
                        }
                    } else {
                        console.error(`Warning: Failed to sync transactions for ${item.institution_name}:`, transactionsResponse.reason.message);
                    }

                    return accounts.map(a => ({
                        ...a,
                        item_id: item.item_id,
                        institution_name: item.institution_name
                    }));

                } catch (err) {
                    const errorData = err.response ? err.response.data : {};
                    const errorCode = errorData.error_code || 'UNKNOWN_ERROR';
                    console.error(`Error fetching for ${item.institution_name}:`, errorData.error_message || err.message);

                    const cached = await db.getCachedAccountsByItem(item.item_id);
                    if (cached.length > 0) {
                        return cached.map(acc => ({
                            ...acc,
                            item_id: item.item_id,
                            error_code: errorCode,
                            institution_name: item.institution_name
                        }));
                    }

                    return [{
                        account_id: `error_${item.item_id}`,
                        name: `Connection Required: ${item.institution_name || 'Bank'}`,
                        mask: '!!!!',
                        type: 'depository',
                        subtype: 'checking',
                        balances: { current: 0, available: 0 },
                        institution_name: item.institution_name,
                        item_id: item.item_id,
                        error_code: errorCode
                    }];
                }
            });

            const results = await Promise.all(promises);
            results.forEach(batch => allAccounts.push(...batch));
        }

        res.json({ accounts: allAccounts, request_id: 'merged' });
    } catch (error) {
        console.error('Error in /api/accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// Fetch Accounts
app.get('/api/accounts', async (req, res) => {
    try {
        const accounts = await db.getAllAccounts();
        res.json({ accounts });
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// Fetch Merchants (Unique list)
app.get('/api/merchants', async (req, res) => {
    logToFile('HIT /api/merchants handler'); // DEBUG
    console.log('HIT /api/merchants endpoint'); // DEBUG
    try {
        const merchants = await db.getUniqueMerchants();
        console.log(`Found ${merchants.length} merchants`); // DEBUG
        res.json({ merchants });
    } catch (error) {
        const msg = error.message || error.toString();
        console.error('Error fetching merchants:', error);
        logToFile(`Error fetching merchants: ${msg}`); // Capture invalid function calls etc
        res.status(500).json({ error: 'Failed to fetch merchants' });
    }
});

// Fetch Categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await db.getAllCategories();
        res.json({ categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create Category
app.post('/api/categories', async (req, res) => {
    const { name, parent_category, color, icon } = req.body;
    console.log(`SERVER: Received POST /categories. Name: '${name}', Parent: '${parent_category}', Color: '${color}'`);
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        await db.addCategory(name, parent_category, color, icon);
        console.log(`SERVER: Successfully added category '${name}' with parent '${parent_category}'`);
        res.json({ status: 'success' });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Delete Category
app.delete('/api/categories/:name', async (req, res) => {
    const { name } = req.params;
    try {
        await db.deleteCategory(name);
        res.json({ status: 'success' });
    } catch (error) {
        console.error('Failed to delete category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Apply Merchant Rule (Category + Transfer status) to ALL matching transactions
app.post('/api/merchants/apply-rule', async (req, res) => {
    const { merchant_name, category, is_transfer } = req.body;
    try {
        // 1. Update the Rule itself (future transactions)
        await db.setMerchantMetadata(merchant_name, {
            category,
            is_transfer: is_transfer ? 1 : 0
        });

        // 2. Apply to existing transactions
        const result = await db.applyMerchantRuleToTransactions(merchant_name, category, is_transfer ? 1 : 0);

        res.json({
            status: 'success',
            message: `Rule saved and applied to ${result.changes} transactions.`
        });
    } catch (error) {
        console.error('Error applying merchant rule:', error);
        const errorMsg = error.message || error.toString();
        logToFile(`Error applying merchant rule for ${merchant_name}: ${errorMsg}`);
        res.status(500).json({ error: 'Failed to apply merchant rule', details: errorMsg });
    }
});

// Create or Update Manual Transaction
app.post('/api/transactions', async (req, res) => {
    const data = req.body;
    console.log('POST /transactions BODY:', JSON.stringify(data, null, 2));
    logToFile(`POST /transactions BODY: ${JSON.stringify(data)}`);
    try {
        const id = data.transaction_id || `manual_${Date.now()}`;

        // Check if exists
        const existing = await db.getManualTransaction(id);

        if (existing) {
            await db.updateManualTransaction(id, data);
        } else {
            await db.addManualTransaction(id, data);
        }
        res.json({ status: 'success', transaction_id: id });
    } catch (error) {
        console.error('Failed to save manual transaction:', error);
        res.status(500).json({ error: 'Failed to save transaction' });
    }
});

// Delete Transaction (Manual Only)
// Delete Transaction (Manual Only)
app.delete('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`Attempting to delete transaction with ID: ${id}`);

    try {
        // Handle Split Deletion
        if (id.includes('_split_')) {
            const [originalId, splitIndexStr] = id.split('_split_');
            const splitIndex = parseInt(splitIndexStr, 10);

            const transaction = await db.getManualTransaction(originalId);

            if (!transaction) {

                return res.status(404).json({ error: 'Transaction not found' });
            }

            let splits = transaction.splits;
            if (typeof splits === 'string') {
                try { splits = JSON.parse(splits); } catch (e) { splits = null; }
            }

            if (!Array.isArray(splits) || !splits[splitIndex]) {
                const msg = `Split index ${splitIndex} invalid for transaction ${originalId}. Splits length: ${Array.isArray(splits) ? splits.length : 'N/A'}`;
                console.error(msg);
                return res.status(400).json({ error: 'Split not found in transaction' });
            }

            // Remove the split
            // Remove the split
            const removedSplit = splits.splice(splitIndex, 1)[0];


            // Re-calculate amount (reduce absolute value of total)
            const sign = transaction.amount < 0 ? -1 : 1;
            const reducedAmount = Math.abs(transaction.amount) - Math.abs(parseFloat(removedSplit.amount || 0));

            // If no splits left or amount is zero, delete the whole transaction
            if (splits.length === 0 || reducedAmount <= 0.01) {
                await db.deleteManualTransaction(originalId);

            } else {
                // Update parent with new amount and remaining splits
                const newAmount = reducedAmount * sign;
                const updatedData = {
                    ...transaction,
                    amount: newAmount,
                    splits: splits
                    // Keep other fields (date, merchant, etc) same
                };

                // We need to use updateManualTransaction, but it expects specific fields
                // Simpler to just call update with the constructed object
                await db.updateManualTransaction(originalId, updatedData);
            }


            return res.json({ status: 'success' });
        }

        // Standard Deletion
        await db.deleteManualTransaction(id);
        res.json({ status: 'success' });

    } catch (error) {
        console.error('Failed to delete transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// Fix Corrupted Categories
app.post('/api/fix-categories', async (req, res) => {
    try {
        await db.run("UPDATE categories SET parent_category = 'Income' WHERE parent_category LIKE '#%'");
        // Also fix specific known bad ones if any
        await db.run("UPDATE categories SET parent_category = 'Income' WHERE parent_category = 'undefined'");
        res.json({ status: 'success', message: 'Fixed corrupted categories' });
    } catch (error) {
        console.error('Failed to fix categories:', error);
        res.status(500).json({ error: 'Failed to fix categories' });
    }
});

app.listen(PORT, '0.0.0.0', async () => {
    try {
        await db.init();
        console.log(`Server running on port ${PORT} (0.0.0.0)`);
    } catch (err) {
        console.error('Failed to start server due to DB error:', err);
        process.exit(1);
    }
});
