const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const path = require('path');
const fs = require('fs');
const db = require('./database');
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

// --- Routes ---

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

app.post('/api/categories', async (req, res) => {
    try {
        const { name, color, icon } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const newCategory = await db.addCategory(name, color, icon);
        res.json(newCategory);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
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

// Fetch Transactions
app.get('/api/transactions', async (req, res) => {
    const { access_token } = req.query;

    // Always fetch all stored tokens from DB
    const items = await db.getAllPlaidItems();
    let tokensToFetch = items.map(i => i.access_token);

    // If request provided a token not in DB, try it too (legacy support)
    if (access_token && !tokensToFetch.includes(access_token)) {
        const isProduction = process.env.PLAID_ENV === 'production';
        if (isProduction && access_token.startsWith('access-sandbox')) {
            console.log(`Skipping Sandbox token ${access_token.substring(0, 10)}... in Production mode.`);
        } else {
            tokensToFetch.push(access_token);
        }
    }

    // Validate we have something to fetch
    if (tokensToFetch.length === 0) {
        console.log('No valid tokens to fetch (Sandbox tokens ignored).');
        return res.json({ transactions: [], total_transactions: 0 });
    }

    console.log(`Backend: Preparing to fetch transactions for ${tokensToFetch.length} tokens.`);
    tokensToFetch.forEach(t => console.log(` - Token: ${t.substring(0, 20)}...`));

    logToFile(`Backend: Fetching transactions for ${tokensToFetch.length} items...`);

    try {
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        // Wide range for Sandbox to be safe
        const startDate = '2023-01-01';

        // Fetch concurrently
        const promises = tokensToFetch.map(token =>
            client.transactionsGet({
                access_token: token,
                start_date: startDate,
                end_date: endDate,
                options: { count: 100, offset: 0 }
            }).then(res => res.data.transactions)
                .catch(err => {
                    const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
                    console.error(`Error fetching for token (${token.substring(0, 20)}...):`, errorMsg);
                    return [];
                })
        );

        const results = await Promise.all(promises);
        const allTransactions = results.flat();

        // Merge with local overrides
        // Merge with local overrides
        const metadata = await db.getTransactionMetadataMap();
        const mergedTransactions = allTransactions.map(t => {
            const override = metadata[t.transaction_id] || {};
            return {
                ...t,
                personal_finance_category: {
                    ...(t.personal_finance_category || {}),
                    primary: override.category || t.personal_finance_category?.primary
                },
                name: override.merchant_name || t.name,
                account_id: override.account_id || t.account_id,
                date: override.date || t.date,
                note: override.note || t.note,
                recurring_frequency: override.recurring_frequency || t.recurring_frequency,
                is_transfer: override.is_transfer !== undefined ? !!override.is_transfer : false
            };
        });

        const transferCount = mergedTransactions.filter(t => t.is_transfer).length;
        logToFile(`Backend: Merged ${mergedTransactions.length} transactions (${transferCount} transfers)`);
        res.json({
            transactions: mergedTransactions,
            total_transactions: mergedTransactions.length
        });
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        logToFile(`Backend: Error fetching transactions: ${JSON.stringify(errorData)}`);
        res.status(500).json({ error: 'Failed to fetch transactions', details: errorData });
    }
});

// Fetch Accounts (Balances)
app.get('/api/accounts', async (req, res) => {
    const { access_token } = req.query;

    // Always fetch all stored tokens from DB
    const items = await db.getAllPlaidItems();

    // Convert to object array for processing
    let itemsToFetch = [...items];
    if (access_token) {
        // If specific token requested
        const exists = items.find(i => i.access_token === access_token);
        if (!exists) {
            const isProduction = process.env.PLAID_ENV === 'production';
            if (isProduction && access_token.startsWith('access-sandbox')) {
                console.log(`Skipping Sandbox token ${access_token.substring(0, 10)}... in Production mode.`);
            } else {
                itemsToFetch.push({ access_token, item_id: 'legacy' });
            }
        } else {
            itemsToFetch = [exists];
        }
    }

    console.log(`Backend: Preparing to fetch accounts for ${itemsToFetch.length} items.`);
    itemsToFetch.forEach(i => console.log(` - Item: ${i.item_id}, Token: ${i.access_token.substring(0, 20)}...`));

    if (itemsToFetch.length === 0) {
        return res.json({ accounts: [], item: {}, request_id: '' });
    }

    logToFile(`Backend: Fetching accounts for ${itemsToFetch.length} items...`);
    try {
        const promises = itemsToFetch.map(async (item) => {
            try {
                const response = await client.accountsGet({ access_token: item.access_token });
                const accounts = response.data.accounts;

                // Cache success
                if (item.item_id !== 'legacy') {
                    await db.upsertAccounts(accounts, item.item_id);
                }

                // Attach item_id to accounts so frontend can request repair
                return accounts.map(a => ({ ...a, item_id: item.item_id }));
            } catch (err) {
                const errorData = err.response ? err.response.data : {};
                const errorCode = errorData.error_code || 'UNKNOWN_ERROR';
                const errorMsg = errorData.error_message || err.message;

                console.error(`Error fetching accounts for token (${item.access_token.substring(0, 10)}...):`, errorMsg);

                // --- CRITICAL FIX FOR NEW DEPLOYMENTS ---
                // If the fetch fails and we have no cache (fresh database), 
                // return a "Placeholder" account so the user can see the bank and trigger REPAIR.
                const cached = item.item_id && item.item_id !== 'legacy'
                    ? await db.getCachedAccountsByItem(item.item_id)
                    : [];

                if (cached.length > 0) {
                    return cached.map(acc => ({
                        ...acc,
                        error_code: errorCode // Inject error status
                    }));
                } else if (item.institution_name) {
                    // Return a fake "Synthetic" account representing the broken item
                    return [{
                        account_id: `error_${item.item_id}`,
                        name: `Connection Required: ${item.institution_name}`,
                        mask: '!!!!',
                        type: 'depository',
                        subtype: 'checking',
                        balances: { current: 0, available: 0 },
                        institution_name: item.institution_name,
                        item_id: item.item_id,
                        error_code: errorCode // Trigger the Red Alert in UI
                    }];
                }
                return [];
            }
        });

        const results = await Promise.all(promises);
        const allAccounts = results.flat();

        logToFile(`Backend: Found ${allAccounts.length} accounts total`);
        res.json({ accounts: allAccounts, item: {}, request_id: 'merged' });
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        logToFile(`Backend: Error fetching accounts: ${JSON.stringify(errorData)}`);
        res.status(500).json({ error: 'Failed to fetch accounts', details: errorData });
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

app.listen(PORT, async () => {
    try {
        await db.init();
        console.log(`Server running on port ${PORT}`);
    } catch (err) {
        console.error('Failed to start server due to DB error:', err);
        process.exit(1);
    }
});
