const express = require('express');
const router = express.Router();
const { manager: db } = require('../database');

// Helper function to calculate next N occurrences based on recurrence frequency
function calculateUpcomingInstances(bill, exceptions = [], maxInstances = 50, maxMonths = 6) {
    const instances = [];
    const startDate = new Date(bill.due_date + 'T12:00:00'); // Force midday to avoid timezone shifts
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + maxMonths);

    let currentDate = new Date(startDate);
    let count = 0;

    // Filter exceptions for this bill
    const billExceptions = exceptions.filter(e => e.bill_id === bill.id);

    // Debug Log
    // if (bill.id === 1) console.log(`Calc Instances for Bill ${bill.id}:`, { endDate: bill.recurrence_end_date });

    while (currentDate <= endDate && count < maxInstances) {
        // Enforce end date if set
        if (bill.recurrence_end_date) {
            const cutoff = new Date(bill.recurrence_end_date + 'T23:59:59');
            if (currentDate > cutoff) {
                // console.log(`Breaking at ${currentDate.toISOString()} > ${cutoff.toISOString()}`);
                break;
            }
        }

        const currentDateStr = currentDate.toISOString().split('T')[0];

        // Check for exception
        const exception = billExceptions.find(e => e.original_date === currentDateStr);

        // Skip if marked as skipped
        if (exception && exception.is_skipped) {
            // Apply recurrence logic to move next even if skipped
        } else {
            // Normalize 'now' to noon to ensure accurate day-difference calculation
            const now = new Date();
            const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

            // Calculate difference in full days
            const daysUntilDue = Math.round((currentDate - todayNoon) / (1000 * 60 * 60 * 24));
            const instanceAmount = exception && exception.new_amount !== null ? exception.new_amount : bill.amount;
            const instanceNote = exception && exception.note !== undefined ? exception.note : bill.note;

            instances.push({
                billId: bill.id,
                category: bill.category,
                description: bill.description,
                billNumber: bill.bill_number,
                amount: instanceAmount,
                originalAmount: bill.amount,
                isException: !!exception,
                accountId: bill.account_id,
                dueDate: currentDateStr,
                recurrenceFrequency: bill.recurrence_frequency,
                reminder: bill.reminder,
                isAutoPaid: bill.is_auto_paid,
                note: instanceNote,
                daysUntilDue: daysUntilDue,
                isPastDue: daysUntilDue < 0,
                isToday: daysUntilDue === 0,
                monthYear: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                createdAt: bill.created_at,
                updatedAt: exception ? (exception.updated_at || exception.created_at) : bill.updated_at,
                masterDueDate: bill.due_date // Original anchor date of the recurring series
            });
        }

        // Calculate next occurrence based on frequency
        switch (bill.recurrence_frequency) {
            case 'Once':
                count = maxInstances; // Exit loop
                break;
            case 'Daily':
                currentDate.setDate(currentDate.getDate() + 1);
                break;
            case 'Weekly':
                currentDate.setDate(currentDate.getDate() + 7);
                break;
            case 'Bi-weekly':
                currentDate.setDate(currentDate.getDate() + 14);
                break;
            case 'Monthly':
                currentDate.setMonth(currentDate.getMonth() + 1);
                break;
            case 'Bimonthly':
                currentDate.setMonth(currentDate.getMonth() + 2);
                break;
            case 'Yearly':
                currentDate.setFullYear(currentDate.getFullYear() + 1);
                break;
            default:
                count = maxInstances; // Unknown frequency, exit
        }

        count++;
    }

    return instances;
}

// POST /api/bills - Create a new bill
router.post('/', async (req, res) => {
    try {
        const {
            category,
            description,
            billNumber,
            amount,
            accountId,
            dueDate,
            recurrenceFrequency,
            reminder,
            isAutoPaid,
            addExpenseEntry,
            note
        } = req.body;

        // Validation
        if (!category || !amount || !dueDate || !recurrenceFrequency) {
            return res.status(400).json({
                error: 'Missing required fields: category, amount, dueDate, recurrenceFrequency'
            });
        }

        const sql = `
            INSERT INTO bills (
                user_id, category, description, bill_number, amount, account_id,
                due_date, recurrence_frequency, reminder, is_auto_paid, add_expense_entry, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.run(sql, [
            1, // TODO: Replace with actual user_id from auth
            category,
            description || null,
            billNumber || null,
            amount,
            accountId || null,
            dueDate,
            recurrenceFrequency,
            reminder || 'Remind 5 days before',
            isAutoPaid ? 1 : 0,
            addExpenseEntry ? 1 : 0,
            note || null
        ]);

        // Fetch the created bill
        const createdBill = await db.get('SELECT * FROM bills WHERE id = ?', [result.lastID]);

        res.json({
            success: true,
            bill: createdBill
        });
    } catch (error) {
        console.error('Error creating bill:', error);
        res.status(500).json({ error: 'Failed to create bill' });
    }
});

// GET /api/bills/upcoming - Get upcoming bill instances
router.get('/upcoming', async (req, res) => {
    try {
        // Fetch all active bills
        const bills = await db.all('SELECT * FROM bills WHERE is_active = 1 ORDER BY due_date ASC');

        // Fetch all exceptions
        const exceptions = await db.all('SELECT * FROM bill_exceptions');

        // Calculate upcoming instances for each bill
        const allInstances = [];
        for (const bill of bills) {
            const instances = calculateUpcomingInstances(bill, exceptions);
            allInstances.push(...instances);
        }

        // Sort by due date
        allInstances.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        // Group by month
        const groupedByMonth = {};
        for (const instance of allInstances) {
            const monthKey = instance.monthYear;
            if (!groupedByMonth[monthKey]) {
                groupedByMonth[monthKey] = {
                    month: monthKey,
                    total: 0,
                    bills: []
                };
            }
            groupedByMonth[monthKey].bills.push(instance);
            groupedByMonth[monthKey].total += instance.amount;
        }

        const grouped = Object.values(groupedByMonth);

        res.json({
            success: true,
            grouped,
            total: allInstances.length
        });
    } catch (error) {
        console.error('Error fetching upcoming bills:', error);
        res.status(500).json({ error: 'Failed to fetch upcoming bills' });
    }
});

// GET /api/bills/paid - Get paid bill history
router.get('/paid', async (req, res) => {
    try {
        const transactions = await db.getPaidBills();

        // Fetch original bills to get their details (created_at, recurrence, reminder)
        const bills = await db.all('SELECT id, created_at, recurrence_frequency, reminder FROM bills');
        const billMap = new Map(bills.map(b => [b.id, b]));

        const groupedByMonth = {};
        const now = new Date();
        const currentYear = now.getFullYear();

        for (const tx of transactions) {
            const dateObj = new Date(tx.date);
            const isCurrentYear = dateObj.getFullYear() === currentYear;
            const monthKey = dateObj.toLocaleString('default', { month: 'long' }) + (isCurrentYear ? '' : ` ${dateObj.getFullYear()}`);

            if (!groupedByMonth[monthKey]) {
                groupedByMonth[monthKey] = {
                    month: monthKey,
                    total: 0,
                    bills: []
                };
            }
            // Add extra fields expected by frontend if needed
            // Extract original due date from transaction_id if possible (bill_pay_ID_YYYYMMDD)
            let originalDueDate = tx.date;
            const parts = tx.transaction_id.split('_');
            const billId = parts.length > 2 ? parseInt(parts[2]) : 0;

            if (parts.length >= 4 && parts[0] === 'bill' && parts[1] === 'pay') {
                // parts[3] is the date string YYYYMMDD
                const dateStr = parts[3];
                if (dateStr && dateStr.length === 8) {
                    originalDueDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                }
            }

            // Use original bill's details if available
            const originalBill = billMap.get(billId);
            const originalCreatedAt = originalBill ? originalBill.created_at : tx.created_at;
            const recurrenceFrequency = originalBill ? originalBill.recurrence_frequency : 'One-time';
            const reminder = originalBill ? originalBill.reminder : 'No reminder';

            const billItem = {
                ...tx,
                billId: billId,
                dueDate: originalDueDate, // The original due date
                paidDate: tx.date, // The actual payment date
                isPaid: true,
                createdAt: originalCreatedAt,
                updatedAt: tx.updated_at,
                recurrenceFrequency: recurrenceFrequency,
                reminder: reminder
            };

            groupedByMonth[monthKey].bills.push(billItem);
            groupedByMonth[monthKey].total += tx.amount;
        }

        // Convert to array
        const grouped = Object.values(groupedByMonth);

        // Sort groups by date descending (most recent month first)
        // We need a way to sort months. 
        // Simple hack: Sort by the date of the first bill in the group.
        grouped.sort((a, b) => {
            if (a.bills.length > 0 && b.bills.length > 0) {
                return new Date(b.bills[0].date) - new Date(a.bills[0].date);
            }
            return 0;
        });

        res.json({
            success: true,
            grouped
        });
    } catch (error) {
        console.error('Error fetching paid bills:', error);
        res.status(500).json({ error: 'Failed to fetch paid bills' });
    }
});

// GET /api/bills - Get all user bills
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT * FROM bills WHERE user_id = ?';
        const params = [1]; // TODO: Replace with actual user_id from auth

        if (status === 'active') {
            sql += ' AND is_active = 1';
        } else if (status === 'inactive') {
            sql += ' AND is_active = 0';
        }

        sql += ' ORDER BY created_at DESC';

        const bills = await db.all(sql, params);

        res.json({
            success: true,
            bills
        });
    } catch (error) {
        console.error('Error fetching bills:', error);
        res.status(500).json({ error: 'Failed to fetch bills' });
    }
});

// PUT /api/bills/:id - Update a bill
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            category,
            description,
            billNumber,
            amount,
            accountId,
            dueDate,
            recurrenceFrequency,
            reminder,
            isAutoPaid,
            addExpenseEntry,
            note,
            splitFromDate,
            splitCutoffDate
        } = req.body;

        console.log('PUT /bills/:id - Payload:', { id, splitFromDate, splitCutoffDate, body: req.body });

        // If splitFromDate is provided, we terminate the current bill and create a new one
        if (splitFromDate) {
            // 1. Terminate the old bill
            // End date should be the day BEFORE the split cutoff (or split date if cutoff missing)
            // splitCutoffDate represents the first date of the *new* series logic, or the date of the instance being edited
            // Actually, if splitCutoffDate is passed (Original Date of Instance), we want to stop BEFORE that.
            const pivotDateStr = splitCutoffDate || splitFromDate;
            const pivotDate = new Date(pivotDateStr);

            const endDateObj = new Date(pivotDate);
            endDateObj.setDate(endDateObj.getDate() - 1);
            const endDateStr = endDateObj.toISOString().split('T')[0];

            console.log('Splitting Bill:', { pivotDateStr, endDateStr, id });

            await db.run('UPDATE bills SET recurrence_end_date = ? WHERE id = ?', [endDateStr, parseInt(id)]);

            // 2. Create the NEW bill
            const sqlInsert = `
                INSERT INTO bills (
                    user_id, category, description, bill_number, amount, account_id,
                    due_date, recurrence_frequency, reminder, is_auto_paid, add_expense_entry, note
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await db.run(sqlInsert, [
                1, // user_id
                category,
                description || null,
                billNumber || null,
                amount,
                accountId || null,
                splitFromDate, // New start date
                recurrenceFrequency,
                reminder || 'Remind 5 days before',
                isAutoPaid ? 1 : 0,
                addExpenseEntry ? 1 : 0,
                note || null
            ]);

            return res.json({ success: true, message: 'Bill split successfully', newBillId: result.lastID });
        }

        const sql = `
            UPDATE bills SET
                category = COALESCE(?, category),
                description = COALESCE(?, description),
                bill_number = COALESCE(?, bill_number),
                amount = COALESCE(?, amount),
                account_id = COALESCE(?, account_id),
                due_date = COALESCE(?, due_date),
                recurrence_frequency = COALESCE(?, recurrence_frequency),
                reminder = COALESCE(?, reminder),
                is_auto_paid = COALESCE(?, is_auto_paid),
                add_expense_entry = COALESCE(?, add_expense_entry),
                note = COALESCE(?, note),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `;

        await db.run(sql, [
            category,
            description,
            billNumber,
            amount,
            accountId,
            dueDate,
            recurrenceFrequency,
            reminder,
            isAutoPaid !== undefined ? (isAutoPaid ? 1 : 0) : undefined,
            addExpenseEntry !== undefined ? (addExpenseEntry ? 1 : 0) : undefined,
            note,
            id,
            1 // TODO: Replace with actual user_id from auth
        ]);

        const updatedBill = await db.get('SELECT * FROM bills WHERE id = ?', [id]);

        res.json({
            success: true,
            bill: updatedBill
        });
    } catch (error) {
        console.error('Error updating bill:', error);
        res.status(500).json({ error: 'Failed to update bill' });
    }
});

// DELETE /api/bills/:id - Delete a bill (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await db.run(
            'UPDATE bills SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            [id, 1] // TODO: Replace with actual user_id from auth
        );

        res.json({
            success: true,
            message: 'Bill deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting bill:', error);
        res.status(500).json({ error: 'Failed to delete bill' });
    }
});

// POST /api/bills/exception - Create or update a bill exception
router.post('/exception', async (req, res) => {
    try {
        const { billId, originalDate, newAmount, note, isSkipped } = req.body;

        if (!billId || !originalDate) {
            return res.status(400).json({ error: 'Missing required fields: billId, originalDate' });
        }

        // Check if exception already exists
        const existing = await db.get(
            'SELECT * FROM bill_exceptions WHERE bill_id = ? AND original_date = ?',
            [billId, originalDate]
        );

        if (existing) {
            await db.run(
                'UPDATE bill_exceptions SET new_amount = ?, note = ?, is_skipped = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [
                    newAmount !== undefined ? newAmount : existing.new_amount,
                    note !== undefined ? note : existing.note,
                    isSkipped !== undefined ? (isSkipped ? 1 : 0) : existing.is_skipped,
                    existing.id
                ]
            );
        } else {
            await db.run(
                'INSERT INTO bill_exceptions (bill_id, original_date, new_amount, note, is_skipped) VALUES (?, ?, ?, ?, ?)',
                [billId, originalDate, newAmount ?? null, note ?? null, isSkipped ? 1 : 0]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving bill exception:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to save exception: ' + error.message });
    }
});

module.exports = router;
