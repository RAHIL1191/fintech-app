import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, Modal, FlatList, Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ArrowLeft, Check, Calendar as CalendarIcon, Tag, CreditCard,
    AlignLeft, DollarSign, Repeat, ChevronRight,
    User, Smartphone, Wallet, List, X, Plus, Clock, Camera, Image as ImageIcon, Trash2, Building2, Calculator, CalendarCheck, Landmark, AlertTriangle
} from 'lucide-react-native';
import api from '../config/api';
import { loadToken } from '../store/TokenStore';
import CustomDatePicker from '../components/CustomDatePicker';
import { formatCurrency, formatDateTime, formatAuditDate, cleanDeviceName } from '../utils/dateUtils';
import CategorySelectorModal from '../components/CategorySelectorModal';
import CalculatorModal from '../components/CalculatorModal';
import { getCategoryIcon, getCategoryColor } from '../constants/CategoryTaxonomy';
import * as LucideIcons from 'lucide-react-native';

// Helper for dynamic icons
const DynamicIcon = ({ name, color, size = 24 }) => {
    const LucideIcon = LucideIcons[name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase())] || LucideIcons.Tag;
    return <LucideIcon size={size} color={color} />;
};

const getRepeatDescription = (frequency, date) => {
    // Safe date parsing ensuring no timezone shift
    if (!date) return '';
    const d = new Date(date + 'T12:00:00');

    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const dayOfMonth = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });

    const getOrdinal = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    switch (frequency) {
        case 'Daily': return `Repeats every day`;
        case 'Weekly': return `Repeats every week on ${dayName}`;
        case 'Bi-weekly': return `Repeats every 2 weeks on ${dayName}`;
        case 'Monthly': return `Repeats every month on the ${getOrdinal(dayOfMonth)}`;
        case 'Bimonthly': return `Repeats every 2 months on the ${getOrdinal(dayOfMonth)}`;
        case 'Yearly': return `Repeats every year on ${month} ${dayOfMonth}`;
        default: return 'Select repeat option';
    }
};

const EditTransaction = ({ navigation, route }) => {
    const { transaction, bill, mode = 'edit', type: paramType } = route.params || {};
    const insets = useSafeAreaInsets();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isTransfer, setIsTransfer] = useState(false);
    const [recurringFrequency, setRecurringFrequency] = useState('Select Option');
    const [activeTab, setActiveTab] = useState('EXPENSE'); // EXPENSE | INCOME | TRANSFER | BILLS
    const [currentMode, setCurrentMode] = useState(mode);
    const [isSplit, setIsSplit] = useState(false);
    const [splits, setSplits] = useState([]); // [{id, category, amount}]

    const [showFrequencyModal, setShowFrequencyModal] = useState(false);
    const [showDateModal, setShowDateModal] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [categories, setCategories] = useState([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [merchants, setMerchants] = useState([]);
    const [showMerchantModal, setShowMerchantModal] = useState(false);
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [isAccountLoading, setIsAccountLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [merchantSearchQuery, setMerchantSearchQuery] = useState('');
    const [tempNote, setTempNote] = useState('');
    const [editingSplitIndex, setEditingSplitIndex] = useState(null);
    const [showCalculatorModal, setShowCalculatorModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);

    const FREQUENCIES = ['Once', 'Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Bimonthly', 'Yearly'];
    const REMINDER_OPTIONS = [
        'No reminder',
        'Remind same day',
        'Remind 1 day before',
        'Remind 2 days before',
        'Remind 3 days before',
        'Remind 4 days before',
        'Remind 5 days before',
        'Remind 10 days before',
        'Remind 15 days before',
        'Remind 20 days before',
        'Remind 30 days before'
    ];

    const TABS = ['EXPENSE', 'INCOME', 'TRANSFER', 'BILLS'];

    // Bills Specific State
    const [reminder, setReminder] = useState('Remind 5 days before');
    const [isAutoPaid, setIsAutoPaid] = useState(false);
    const [addExpenseEntry, setAddExpenseEntry] = useState(true);
    const [billNumber, setBillNumber] = useState('');

    // Initialize state from transaction or bill if provided
    useEffect(() => {
        if (transaction) {
            setAmount(Math.abs(transaction.amount).toString());
            setDescription(transaction.name);
            setCategory(transaction.personal_finance_category?.primary || '');
            setNote(transaction.note || '');
            setDate(transaction.date || new Date().toISOString().split('T')[0]);
            setTime(transaction.time || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
            setRecurringFrequency(transaction.recurring_frequency || 'Select Option');
            setIsTransfer(!!transaction.is_transfer);

            // Set active tab based on transaction type
            if (transaction.is_transfer) setActiveTab('TRANSFER');
            else if (transaction.amount < 0) setActiveTab('INCOME');
            else setActiveTab('EXPENSE');

            // Handle splits if available
            if (transaction.splits) {
                try {
                    const parsedSplits = typeof transaction.splits === 'string' ? JSON.parse(transaction.splits) : transaction.splits;
                    if (parsedSplits && Array.isArray(parsedSplits) && parsedSplits.length > 0) {
                        setSplits(parsedSplits);
                        setIsSplit(true);
                    }
                } catch (e) {
                    console.error('Failed to parse splits:', e);
                }
            }
        } else if (bill) {
            // Initialize from Bill object
            setAmount(bill.amount.toString());
            setDescription(bill.description || ''); // Service provider name
            setCategory(bill.category || '');
            setNote(bill.note || '');
            setDate(bill.dueDate || new Date().toISOString().split('T')[0]);
            setRecurringFrequency(bill.recurrenceFrequency || 'Select Option');
            setReminder(bill.reminder || 'Remind 5 days before');
            setIsAutoPaid(!!bill.isAutoPaid);
            setAddExpenseEntry(!!bill.addExpenseEntry);
            setBillNumber(bill.billNumber || '');

            setActiveTab('BILLS');

            // If editing single instance, use its specific properties if available (though bill usually has base props)
            if (route.params?.editScope === 'single') {
                // Single instance might have different note/amount already in bill object passed from details
            }
        } else {
            // Default for new transaction
            setDate(new Date().toISOString().split('T')[0]);
            setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
            if (paramType) {
                setActiveTab(paramType.toUpperCase());
            }
        }

        fetchCategories();
        fetchMerchants();
        fetchAccounts();
    }, [transaction, bill]);

    // Date formatting functions moved to dateUtils.js

    const handleTabSwitch = (tab) => {
        setActiveTab(tab);
        // If we were editing a transaction and switched to a different type,
        // fulfill the user request to "allow me to add new":
        const originalType = transaction
            ? (transaction.is_transfer ? 'TRANSFER' : (transaction.amount < 0 ? 'INCOME' : 'EXPENSE'))
            : (paramType ? paramType.toUpperCase() : 'EXPENSE');

        if (tab !== originalType) {
            setCurrentMode('add');
            // Clear or reset fields for new entry
            setAmount('');
            setDescription('');
            setCategory('');
            setNote('');
            setDate(new Date().toISOString().split('T')[0]);
            setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
            setIsTransfer(tab === 'TRANSFER');
            setSelectedAccount(null);
            setRecurringFrequency('Select Option');
        } else {
            setCurrentMode(mode);
            // Restore from transaction if available
            if (transaction) {
                setAmount(Math.abs(transaction.amount).toString());
                setDescription(transaction.name);
                setCategory(transaction.personal_finance_category?.primary || '');
                setNote(transaction.note || '');
                setDate(transaction.date || '');
                setTime(transaction.time || '');
                setIsTransfer(!!transaction.is_transfer);

                // Restore account selection
                if (transaction.account_id && accounts.length > 0) {
                    const found = accounts.find(a => a.account_id === transaction.account_id);
                    if (found) setSelectedAccount(found);
                }
            }
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await api.get('/categories');
            setCategories(response.data);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    const handleCreateCategory = async () => {
        if (!searchQuery.trim()) return;
        try {
            const newCat = { name: searchQuery.trim(), icon: 'tag', color: '#6366F1' };
            const response = await api.post('/categories', newCat);
            setCategories(prev => [...prev, response.data]);

            if (editingSplitIndex !== null) {
                const newSplits = [...(splits || [])];
                if (newSplits[editingSplitIndex]) {
                    newSplits[editingSplitIndex].category = response.data.name;
                    setSplits(newSplits);
                }
            } else {
                setCategory(response.data.name);
            }

            setSearchQuery('');
            setShowCategoryModal(false);
        } catch (error) {
            console.error('Failed to create category:', error);
        }
    };

    const fetchMerchants = async () => {
        try {
            // Fetch merchants without token (backend handles it)
            const response = await api.get('/merchants');
            setMerchants(response.data.merchants || []);
        } catch (error) {
            console.error('Failed to fetch merchants:', error);
        }
    };

    const fetchAccounts = async () => {
        setIsAccountLoading(true);
        try {
            // Fetch accounts without token
            const response = await api.get('/accounts');
            setAccounts(response.data.accounts || []);

            // Set initial selected account object
            if (transaction?.account_id) {
                const found = (response.data.accounts || []).find(a => a.account_id === transaction.account_id);
                if (found) setSelectedAccount(found);
            }
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
        } finally {
            setIsAccountLoading(false);
        }
    };

    const getSplitsTotal = () => {
        return splits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    };

    const handleAddSplit = () => {
        const remaining = parseFloat(amount || 0) - getSplitsTotal();
        setSplits([...splits, { id: Date.now(), category: '', amount: remaining > 0 ? remaining.toString() : '' }]);
    };

    const handleRemoveSplit = (index) => {
        const newSplits = [...(splits || [])];
        newSplits.splice(index, 1);
        setSplits(newSplits);
        if (newSplits.length === 0) setIsSplit(false);
    };

    const handleUpdateSplitAmount = (index, value) => {
        const newSplits = [...(splits || [])];
        if (newSplits[index]) {
            newSplits[index].amount = value;
            setSplits(newSplits);
        }
    };

    const handleSave = async () => {
        // If active tab is BILLS, create/update bill instead of transaction
        if (activeTab === 'BILLS') {
            try {
                // Handle Single Occurrence Edit
                if (route.params?.editScope === 'single') {
                    // Validation: Ensure core details aren't changed (or just ignore them)
                    // We only support Amount and Note for single instances

                    // Use bill object if transaction is undefined
                    const sourceObj = transaction || bill;
                    const originalDate = sourceObj.dueDate; // Passed from BillDetails or transaction

                    if (!originalDate) {
                        Alert.alert('Error', 'Original date missing. Cannot update specific instance.');
                        return;
                    }

                    await api.post('/bills/exception', {
                        billId: sourceObj.id || sourceObj.billId,
                        originalDate: originalDate,
                        newAmount: parseFloat(amount || '0'),
                        note: note,
                        isSkipped: false
                    });

                    Alert.alert('Success', 'Instance updated successfully!');
                } else {
                    // Determine if we need to preserve the master anchor date
                    // If we have masterDueDate (from backend), we calculate the shift the user applied
                    // to the *current instance* date, and apply that same shift to the *master* date.
                    // This prevents the whole series from resetting to "today".

                    const sourceObj = transaction || bill;
                    let finalDueDate = date || new Date().toISOString().split('T')[0];

                    // logic removed: do not reset to masterDueDate when splitting.
                    // The new split bill must start from the selected instance date.

                    // Standard Bill Edit (All Future)
                    // We send splitFromDate to tell backend to close the old recurring series and start a new one
                    // This creates a history trail (old bill row -> new bill row) ensuring past instances aren't changed
                    const billData = {
                        category,
                        description, // Service provider name
                        billNumber,
                        amount: parseFloat(amount || '0'),
                        accountId: selectedAccount?.account_id,
                        dueDate: finalDueDate,
                        recurrenceFrequency: recurringFrequency === 'Select Option' ? 'Once' : recurringFrequency,
                        reminder,
                        isAutoPaid,
                        addExpenseEntry,
                        note,
                        splitFromDate: finalDueDate, // Triggers split logic in backend (New Bill Start)
                        splitCutoffDate: sourceObj?.dueDate // Optional: Old Bill End (defaults to splitFromDate - 1 if missing)
                    };

                    // Determine if we are updating an existing bill or creating a new one
                    const billIdToUpdate = (transaction && transaction.bill_id) || (bill && bill.billId);

                    if (currentMode === 'edit' && billIdToUpdate) {
                        await api.put(`/bills/${billIdToUpdate}`, billData);
                    } else {
                        await api.post('/bills', billData);
                    }

                    Alert.alert('Success', 'Bill saved successfully!');
                }

                // Reset navigation to the Bills stack to force a refresh on the list
                navigation.navigate('Bills');
            } catch (error) {
                console.error('Failed to save bill:', error);
                Alert.alert('Error', 'Failed to save bill. Please try again.');
            }
            return;
        }

        // Standard transaction logic
        // Correct the amount sign based on tab
        let finalAmount = parseFloat(amount || '0');
        if (activeTab === 'INCOME') {
            finalAmount = -Math.abs(finalAmount);
        } else {
            finalAmount = Math.abs(finalAmount);
        }

        const metadata = {
            category,
            merchant_name: description,
            account_id: selectedAccount?.account_id,
            date: date || new Date().toISOString().split('T')[0],
            time: time || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            note,
            recurring_frequency: recurringFrequency,
            is_transfer: isTransfer ? 1 : 0,
            amount: finalAmount,
            splits: isSplit ? splits : null,
            device_info: cleanDeviceName(Device?.modelName || Device?.designName) || (Platform.OS === 'android' ? 'Android Device' : 'iOS Device')
        };

        // Validation for splits
        if (isSplit) {
            const splitsTotal = getSplitsTotal();
            const totalAmount = parseFloat(amount || '0');
            if (Math.abs(splitsTotal - totalAmount) > 0.01) {
                Alert.alert("Validation Error", `The sum of split amounts ($${splitsTotal.toFixed(2)}) must match the total amount ($${totalAmount.toFixed(2)}).`);
                return;
            }
            if (splits.some(s => !s.category)) {
                Alert.alert("Validation Error", "Please select a category for all splits.");
                return;
            }
        }

        try {
            if (currentMode === 'edit' && transaction?.transaction_id) {
                if (transaction.is_manual) {
                    // Update existing manual transaction
                    await api.post('/transactions', { ...metadata, transaction_id: transaction.transaction_id });
                } else {
                    // Update metadata for Plaid transaction
                    await api.post(`/metadata/transaction/${transaction.transaction_id}`, metadata);
                }
            } else {
                // Create new manual transaction
                await api.post('/transactions', metadata);
            }
        } catch (error) {
            console.error('Failed to save transaction:', error);
        }

        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('Insights');
        }
    };

    const filteredCategories = (categories || []).filter(cat =>
        cat && cat.name && cat.name.toLowerCase().includes((searchQuery || '').toLowerCase())
    );

    const filteredMerchants = merchants.filter(m =>
        m.toLowerCase().includes(merchantSearchQuery.toLowerCase())
    );

    // Plaid: positive amount = expense, negative = income
    // If we have a transaction, use its amount. Otherwise use paramType or default to expense.
    const headerTitle = `${currentMode === 'edit' ? 'Edit' : 'Add'} ${activeTab.charAt(0) + activeTab.slice(1).toLowerCase()}`;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                    <ArrowLeft size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{headerTitle}</Text>
                <TouchableOpacity onPress={handleSave} style={styles.iconButton}>
                    <Check size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Edit Scope Banner */}
            {(route.params?.editScope === 'single') && (
                <View style={{ backgroundColor: '#FFF7ED', padding: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#FFEDD5' }}>
                    <AlertTriangle size={20} color="#EA580C" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: '#C2410C', flex: 1 }}>
                        Editing this occurrence only. Basic details cannot be changed.
                    </Text>
                </View>
            )}

            {/* Tab Bar */}
            <View style={styles.tabsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainerInner}>
                    {TABS.map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                            onPress={() => handleTabSwitch(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={styles.content}>
                {/* Amount Input */}
                <View style={styles.amountContainer}>
                    <View style={styles.amountCircle}>
                        <DollarSign size={24} color="#64748B" />
                    </View>
                    <TextInput
                        style={styles.amountInput}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor="#CBD5E1"
                        autoFocus={currentMode === 'add'}
                    />
                    <View style={styles.amountActions}>
                        {activeTab === 'BILLS' ? (
                            <TouchableOpacity
                                style={styles.amountActionBtn}
                                onPress={() => setShowCalculatorModal(true)}
                            >
                                <Calculator size={24} color="#64748B" />
                            </TouchableOpacity>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.amountActionBtn, isSplit && { backgroundColor: '#E0F2FE', borderRadius: 8 }]}
                                    onPress={() => {
                                        if (!isSplit) {
                                            const currentAmount = amount || '0';
                                            setSplits([{ id: Date.now(), category: category, amount: currentAmount }]);
                                        }
                                        setIsSplit(!isSplit);
                                    }}
                                >
                                    <List size={24} color={isSplit ? "#2563EB" : "#94A3B8"} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.amountActionBtn}>
                                    <Repeat size={20} color="#94A3B8" />
                                </TouchableOpacity>
                            </>
                        )}
                        <View style={styles.amountVerticalBar} />
                    </View>
                </View>

                {/* Form Fields - List Style */}
                <View style={styles.formList}>
                    {activeTab === 'BILLS' ? (
                        /* BILLS FORM LAYOUT */
                        <>
                            {/* Category */}
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => setShowCategoryModal(true)}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#F97316' }]}>
                                    <Tag size={20} color="#FFF" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={category ? styles.itemValue : styles.placeholderText}>
                                        {category || 'Select category'}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </TouchableOpacity>

                            {/* Title (Service Provider Name) */}
                            <View style={styles.listItem}>
                                <View style={[styles.itemIconCircle, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                                    <Landmark size={20} color="#64748B" />
                                </View>
                                <TextInput
                                    style={[styles.itemContent, styles.itemValue, { paddingVertical: 0 }]}
                                    placeholder="Service Provider Name"
                                    placeholderTextColor="#94A3B8"
                                    value={description}
                                    onChangeText={setDescription}
                                />
                            </View>

                            {/* Bill Number (Hydro Québec Electricity) */}
                            <View style={styles.listItem}>
                                <View style={[styles.itemIconCircle, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                                    <CreditCard size={20} color="#64748B" />
                                </View>
                                <TextInput
                                    style={[styles.itemContent, styles.itemValue, { paddingVertical: 0 }]}
                                    placeholder="Bill Description (e.g. Hydro Québec)"
                                    placeholderTextColor="#94A3B8"
                                    value={billNumber}
                                    onChangeText={setBillNumber}
                                />
                            </View>

                            {/* Due Date */}
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => setShowDateModal(true)}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE' }]}>
                                    <CalendarIcon size={20} color="#0EA5E9" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemValue}>
                                        {formatDateTime(date).dayPart}
                                    </Text>
                                    <Text style={styles.itemSubtext}>Due Date</Text>
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </TouchableOpacity>

                            {/* Repeat Option */}
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => setShowFrequencyModal(true)}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE' }]}>
                                    <Repeat size={20} color="#0EA5E9" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={recurringFrequency === 'Select Option' ? styles.placeholderText : styles.itemValue}>
                                        {recurringFrequency === 'Select Option' ? 'Select repeat option' : getRepeatDescription(recurringFrequency, date)}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </TouchableOpacity>

                            {/* Reminder */}
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => setShowReminderModal(true)}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE' }]}>
                                    <LucideIcons.Bell size={20} color="#0EA5E9" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemValue}>{reminder}</Text>
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </TouchableOpacity>

                            <View style={{ height: 12 }} />

                            {/* Auto Paid */}
                            <View style={[styles.listItem, { paddingVertical: 12 }]}>
                                <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE' }]}>
                                    <CalendarCheck size={20} color="#0EA5E9" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemValue}>Auto Paid</Text>
                                </View>
                                <Switch
                                    value={isAutoPaid}
                                    onValueChange={setIsAutoPaid}
                                    trackColor={{ false: '#E2E8F0', true: '#0EA5E9' }}
                                    thumbColor="#FFF"
                                />
                            </View>
                            <View style={{ backgroundColor: '#FFF7ED', padding: 12, marginHorizontal: 16, borderRadius: 8, marginTop: -8, marginBottom: 12 }}>
                                <Text style={{ color: '#9A3412', fontSize: 12, lineHeight: 18 }}>
                                    <Text style={{ fontWeight: '700' }}>Note:</Text> Auto-paid bills are marked as paid on the due date in the app.
                                </Text>
                            </View>

                            {/* From Account */}
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => setShowAccountModal(true)}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE' }]}>
                                    <Landmark size={20} color="#0EA5E9" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={selectedAccount ? styles.itemValue : styles.placeholderText}>
                                        {selectedAccount ? selectedAccount.name : 'From account'}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </TouchableOpacity>

                            {/* Add Expense Entry Toggle */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
                                <Text style={{ fontSize: 14, color: '#0F172A', fontWeight: '500' }}>Add expense entry for this payment.</Text>
                                <Switch
                                    value={addExpenseEntry}
                                    onValueChange={setAddExpenseEntry}
                                    trackColor={{ false: '#E2E8F0', true: '#0EA5E9' }}
                                    thumbColor="#FFF"
                                />
                            </View>

                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16, marginVertical: 8 }} />

                            {/* Notes */}
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => { setTempNote(note); setShowNoteModal(true); }}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE' }]}>
                                    <List size={20} color="#0EA5E9" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={note ? styles.itemValue : styles.placeholderText}>
                                        {note || 'Notes...'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Attach Photo */}
                            <TouchableOpacity style={[styles.listItem, { borderBottomWidth: 0 }]}>
                                <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE' }]}>
                                    <Camera size={20} color="#0EA5E9" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.placeholderText}>Attach photo</Text>
                                </View>
                            </TouchableOpacity>
                        </>
                    ) : (
                        /* STANDARD FORM LAYOUT (Existing Code) */
                        <>
                            {/* Category Selection or Split List */}
                            {!isSplit ? (
                                <TouchableOpacity
                                    style={styles.listItem}
                                    onPress={() => {
                                        setEditingSplitIndex(null);
                                        setShowCategoryModal(true);
                                    }}
                                >
                                    <View style={[styles.itemIconCircle, { backgroundColor: '#F97316' }]}>
                                        <Tag size={20} color="#FFF" />
                                    </View>
                                    <View style={styles.itemContent}>
                                        <Text style={category ? styles.itemValue : styles.placeholderText}>
                                            {category || 'Select Category'}
                                        </Text>
                                    </View>
                                    <ChevronRight size={20} color="#CBD5E1" />
                                </TouchableOpacity>
                            ) : (
                                <View style={{ paddingBottom: 10 }}>
                                    <View style={[styles.listItem, { borderBottomWidth: 0 }]}>
                                        <View style={[styles.itemIconCircle, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                                            <List size={20} color="#94A3B8" />
                                        </View>
                                        <View style={styles.itemContent}>
                                            <Text style={styles.itemValue}>Multiple Categories</Text>
                                        </View>
                                    </View>

                                    {splits.map((split, index) => (
                                        <View key={split.id || index} style={styles.splitRow}>
                                            <TouchableOpacity
                                                style={styles.removeSplitBtn}
                                                onPress={() => handleRemoveSplit(index)}
                                            >
                                                <Trash2 size={20} color="#EF4444" />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.splitCategoryBtn}
                                                onPress={() => {
                                                    setEditingSplitIndex(index);
                                                    setShowCategoryModal(true);
                                                }}
                                            >
                                                <View style={[styles.splitIconCircle, { backgroundColor: '#F1F5F9' }]}>
                                                    <Tag size={16} color="#475569" />
                                                </View>
                                                <Text style={split.category ? styles.splitCategoryText : styles.placeholderText} numberOfLines={1}>
                                                    {split.category || 'Select Category'}
                                                </Text>
                                            </TouchableOpacity>

                                            <View style={styles.splitAmountContainer}>
                                                <Text style={styles.currencySymbol}>$</Text>
                                                <TextInput
                                                    style={styles.splitAmountInput}
                                                    value={split.amount}
                                                    onChangeText={(val) => handleUpdateSplitAmount(index, val)}
                                                    keyboardType="numeric"
                                                    placeholder="0"
                                                />
                                            </View>
                                        </View>
                                    ))}

                                    <TouchableOpacity
                                        style={styles.addSplitBtn}
                                        onPress={handleAddSplit}
                                    >
                                        <View style={styles.addSplitIcon}>
                                            <Plus size={20} color="#94A3B8" />
                                        </View>
                                        <Text style={styles.addSplitText}>Add a Category to split</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Merchant / Description */}
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => setShowMerchantModal(true)}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                                    <User size={20} color="#94A3B8" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={description ? styles.itemValue : styles.placeholderText} numberOfLines={1}>
                                        {description || 'Select Merchant'}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </TouchableOpacity>

                            {/* Account Selection ... (already updated partially, refining) */}
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => setShowAccountModal(true)}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                                    {selectedAccount ? (
                                        <View style={styles.bankIconInner}>
                                            <Text style={styles.bankInitials}>{(selectedAccount.institution_name || 'B').charAt(0)}</Text>
                                        </View>
                                    ) : (
                                        <Wallet size={20} color="#94A3B8" />
                                    )}
                                </View>
                                <View style={styles.itemContent}>
                                    {selectedAccount ? (
                                        <>
                                            <Text style={styles.bankNameHeader}>{selectedAccount.institution_name}</Text>
                                            <Text style={styles.bankDetailText}>From: {selectedAccount.name} | {selectedAccount.official_name || 'Owner'}</Text>
                                            <Text style={styles.bankBalanceText}>Balance: {formatCurrency(selectedAccount.balances.current)}</Text>
                                        </>
                                    ) : (
                                        <Text style={styles.placeholderText}>Select Account</Text>
                                    )}
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </TouchableOpacity>

                            {/* Combined Date & Time with split touch targets */}
                            <View style={styles.listItem}>
                                <View style={[styles.itemIconCircle, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                                    <CalendarIcon size={20} color="#94A3B8" />
                                </View>
                                <View style={[styles.itemContent, { flexDirection: 'row', alignItems: 'center' }]}>
                                    <TouchableOpacity
                                        onPress={() => setShowDateModal(true)}
                                        style={{ flex: 2 }}
                                    >
                                        <Text style={styles.itemValue}>
                                            {formatDateTime(date || (transaction?.date), time || (transaction?.time)).dayPart}
                                        </Text>
                                    </TouchableOpacity>
                                    <Text style={[styles.itemValue, { marginHorizontal: 2 }]}> </Text>
                                    <TouchableOpacity
                                        onPress={() => setShowTimeModal(true)}
                                        style={{ flex: 1 }}
                                    >
                                        <Text style={styles.itemValue}>
                                            {formatDateTime(date || (transaction?.date), time || (transaction?.time)).timePart}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </View>

                            {/* Notes */}
                            <TouchableOpacity
                                style={[styles.listItem, { borderBottomWidth: 0 }]}
                                onPress={() => {
                                    setTempNote(note);
                                    setShowNoteModal(true);
                                }}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                                    <List size={20} color="#94A3B8" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={note ? styles.itemValue : styles.placeholderText} numberOfLines={1}>
                                        {note || 'Notes...'}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </TouchableOpacity>

                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16, marginVertical: 8 }} />

                            {/* Attach Photo */}
                            <TouchableOpacity style={styles.listItem}>
                                <View style={[styles.itemIconCircle, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                                    <Camera size={20} color="#94A3B8" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.placeholderText}>Attach photo</Text>
                                </View>
                                <ChevronRight size={20} color="#CBD5E1" />
                            </TouchableOpacity>


                            {/* Transfer Toggle */}
                            <View style={styles.toggleItem}>
                                <View style={[styles.itemIconCircle, { backgroundColor: '#6366F1' }]}>
                                    <Repeat size={20} color="#FFF" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemLabel}>Mark as Transfer</Text>
                                    <Text style={styles.itemSubtext}>
                                        This transaction will be included in {activeTab === 'EXPENSE' ? 'expense' : 'income'} calculations
                                    </Text>
                                </View>
                                <Switch
                                    value={isTransfer}
                                    onValueChange={setIsTransfer}
                                    trackColor={{ false: '#334155', true: '#0EA5E9' }}
                                    thumbColor="#FFF"
                                />
                            </View>

                            {/* Repeat Option */}
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => setShowFrequencyModal(true)}
                            >
                                <View style={[styles.itemIconCircle, { backgroundColor: '#0EA5E9' }]}>
                                    <Repeat size={20} color="#FFF" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemLabel}>Repeat Option</Text>
                                    <Text style={recurringFrequency === 'Select Option' ? styles.placeholderText : styles.itemValue}>
                                        {recurringFrequency}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color="#475569" />
                            </TouchableOpacity>

                        </>
                    )}
                </View>
                <View style={{ height: 120 }} />
            </ScrollView>

            <Modal
                visible={showFrequencyModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowFrequencyModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowFrequencyModal(false)}
                >
                    <View style={[styles.modalContent, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
                        <Text style={styles.modalTitle}>Select Frequency</Text>
                        {FREQUENCIES.map((freq) => (
                            <TouchableOpacity
                                key={freq}
                                style={[
                                    styles.modalOption,
                                    recurringFrequency === freq && styles.modalOptionActive
                                ]}
                                onPress={() => {
                                    setRecurringFrequency(freq);
                                    setShowFrequencyModal(false);
                                }}
                            >
                                <Text style={[
                                    styles.modalOptionText,
                                    recurringFrequency === freq && styles.modalOptionTextActive
                                ]}>
                                    {freq}
                                </Text>
                                {recurringFrequency === freq ? <Check size={20} color="#0EA5E9" /> : null}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Reminder Selection Modal */}
            <Modal
                visible={showReminderModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowReminderModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowReminderModal(false)}
                >
                    <View style={[styles.modalContent, { paddingBottom: Math.max(24, insets.bottom + 16), maxHeight: '80%' }]}>
                        <Text style={styles.modalTitle}>Reminder</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {REMINDER_OPTIONS.map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[
                                        styles.modalOption,
                                        reminder === opt && styles.modalOptionActive
                                    ]}
                                    onPress={() => {
                                        setReminder(opt);
                                        setShowReminderModal(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.modalOptionText,
                                        reminder === opt && styles.modalOptionTextActive
                                    ]}>
                                        {opt}
                                    </Text>
                                    {reminder === opt ? <Check size={20} color="#0EA5E9" /> : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            <CalculatorModal
                visible={showCalculatorModal}
                onClose={() => setShowCalculatorModal(false)}
                initialAmount={amount}
                onConfirm={(val) => {
                    setAmount(val);
                }}
            />

            <CategorySelectorModal
                visible={showCategoryModal}
                onClose={() => setShowCategoryModal(false)}
                onSelect={(cat) => {
                    if (editingSplitIndex !== null) {
                        const newSplits = [...(splits || [])];
                        if (newSplits[editingSplitIndex]) {
                            newSplits[editingSplitIndex].category = cat || '';
                            setSplits(newSplits);
                        }
                    } else {
                        setCategory(cat || '');
                    }
                    setShowCategoryModal(false);
                }}
                currentCategory={category}
            />

            {/* Account Selection Modal */}
            <Modal
                visible={showAccountModal}
                presentationStyle="fullScreen"
                animationType="slide"
                onRequestClose={() => setShowAccountModal(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
                    <View style={[styles.modalContent, { flex: 1, borderRadius: 0, paddingBottom: 0, padding: 0 }]}>
                        <View style={[styles.modalHeader, { paddingHorizontal: 24, paddingTop: 24 }]}>
                            <TouchableOpacity onPress={() => setShowAccountModal(false)} style={styles.iconButton}>
                                <ArrowLeft size={24} color="#1E293B" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Account</Text>
                            <View style={{ width: 40 }} />
                        </View>

                        <FlatList
                            data={accounts}
                            keyExtractor={(item) => item.account_id}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                            renderItem={({ item: acc }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.modalOption,
                                        selectedAccount?.account_id === acc.account_id && styles.modalOptionActive
                                    ]}
                                    onPress={() => {
                                        setSelectedAccount(acc);
                                        setShowAccountModal(false);
                                    }}
                                >
                                    <View style={styles.row}>
                                        <View style={[styles.itemIconCircle, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', width: 32, height: 32, marginRight: 12 }]}>
                                            <Wallet size={16} color="#94A3B8" />
                                        </View>
                                        <View>
                                            <Text style={[
                                                styles.modalOptionText,
                                                selectedAccount?.account_id === acc.account_id && styles.modalOptionTextActive
                                            ]}>
                                                {acc.name}
                                            </Text>
                                            <Text style={{ color: '#64748B', fontSize: 13 }}>
                                                ...{acc.mask} • ${acc.balances.current}
                                            </Text>
                                        </View>
                                    </View>
                                    {selectedAccount?.account_id === acc.account_id ? <Check size={20} color="#0EA5E9" /> : null}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Merchant Selection Modal */}
            <Modal
                visible={showMerchantModal}
                presentationStyle="fullScreen"
                animationType="slide"
                onRequestClose={() => setShowMerchantModal(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
                    <View style={[styles.modalContent, { flex: 1, borderRadius: 0, paddingBottom: 0, padding: 0 }]}>
                        <View style={[styles.modalHeader, { paddingHorizontal: 24, paddingTop: 24 }]}>
                            <TouchableOpacity onPress={() => setShowMerchantModal(false)} style={styles.iconButton}>
                                <ArrowLeft size={24} color="#1E293B" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Merchant</Text>
                            <View style={{ width: 40 }} />
                        </View>

                        {description ? (
                            <View style={[styles.currentSelectionContainer, { paddingHorizontal: 24 }]}>
                                <Text style={styles.sectionLabel}>CURRENT MERCHANT</Text>
                                <View style={styles.currentSelectionCard}>
                                    <View style={[styles.itemIconCircle, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', width: 32, height: 32, marginRight: 12 }]}>
                                        <User size={16} color="#94A3B8" />
                                    </View>
                                    <Text style={styles.currentSelectionText}>{description}</Text>
                                    <Check size={20} color="#10B981" />
                                </View>
                            </View>
                        ) : null}

                        <TextInput
                            style={[styles.searchInput, { marginHorizontal: 24 }]}
                            placeholder="Search or enter merchant name..."
                            placeholderTextColor="#64748B"
                            value={merchantSearchQuery}
                            onChangeText={setMerchantSearchQuery}
                            onSubmitEditing={() => {
                                if (merchantSearchQuery) {
                                    setDescription(merchantSearchQuery);
                                    setShowMerchantModal(false);
                                }
                            }}
                        />

                        <FlatList
                            data={filteredMerchants}
                            keyExtractor={(item, index) => `${item}-${index}`}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                            keyboardShouldPersistTaps="handled"
                            ListHeaderComponent={
                                merchantSearchQuery && !merchants.includes(merchantSearchQuery) ? (
                                    <TouchableOpacity
                                        style={styles.modalOption}
                                        onPress={() => {
                                            setDescription(merchantSearchQuery);
                                            setShowMerchantModal(false);
                                        }}
                                    >
                                        <View style={styles.row}>
                                            <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE', width: 32, height: 32, marginRight: 12 }]}>
                                                <Plus size={16} color="#2563EB" />
                                            </View>
                                            <Text style={[styles.modalOptionText, { color: '#2563EB' }]}>
                                                Add "{merchantSearchQuery}"
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ) : null
                            }
                            renderItem={({ item: m }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.modalOption,
                                        description === m && styles.modalOptionActive
                                    ]}
                                    onPress={() => {
                                        setDescription(m);
                                        setShowMerchantModal(false);
                                    }}
                                >
                                    <View style={styles.row}>
                                        <View style={[styles.itemIconCircle, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', width: 32, height: 32, marginRight: 12 }]}>
                                            <User size={16} color="#94A3B8" />
                                        </View>
                                        <Text style={[
                                            styles.modalOptionText,
                                            description === m && styles.modalOptionTextActive
                                        ]}>
                                            {m}
                                        </Text>
                                    </View>
                                    {description === m ? <Check size={20} color="#0EA5E9" /> : null}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Date Selection Modal */}
            <Modal
                visible={showDateModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowDateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: 'auto', maxHeight: '85%', paddingBottom: Math.max(24, insets.bottom + 16) }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowDateModal(false)} style={styles.modalCloseButton}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Date</Text>
                            <View style={{ width: 24 }} />
                        </View>

                        <CustomDatePicker
                            onDateSelect={(newDate) => {
                                setDate(newDate);
                                setShowDateModal(false);
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* Note Editor Modal */}
            <Modal
                visible={showNoteModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowNoteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '70%', paddingBottom: Math.max(24, insets.bottom + 16) }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowNoteModal(false)} style={styles.modalCloseButton}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Edit Note</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setNote(tempNote);
                                    setShowNoteModal(false);
                                }}
                                style={styles.modalCloseButton}
                            >
                                <Check size={24} color="#0EA5E9" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={[styles.searchInput, { height: 200, textAlignVertical: 'top' }]}
                            placeholder="Add your notes here..."
                            placeholderTextColor="#64748B"
                            value={tempNote}
                            onChangeText={setTempNote}
                            multiline
                            autoFocus
                        />
                    </View>
                </View>
            </Modal>

            {/* Time Selection Modal */}
            <Modal
                visible={showTimeModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTimeModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowTimeModal(false)}
                >
                    <View style={[styles.modalContent, { height: '50%', paddingBottom: Math.max(24, insets.bottom + 16) }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowTimeModal(false)} style={styles.iconButton}>
                                <ArrowLeft size={24} color="#1E293B" />
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Select Time</Text>
                            <TouchableOpacity onPress={() => setShowTimeModal(false)} style={styles.iconButton}>
                                <Check size={24} color="#0EA5E9" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', flex: 1, marginTop: 20 }}>
                            {/* Hours Column */}
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.sectionLabel, { textAlign: 'center' }]}>HOUR</Text>
                                <FlatList
                                    data={Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))}
                                    keyExtractor={(item) => item}
                                    renderItem={({ item }) => {
                                        const currentHour = (time || '12:00').split(':')[0];
                                        return (
                                            <TouchableOpacity
                                                style={[
                                                    styles.modalOption,
                                                    currentHour === item && styles.modalOptionActive,
                                                    { justifyContent: 'center', borderBottomWidth: 0 }
                                                ]}
                                                onPress={() => {
                                                    const parts = (time || '12:00').split(':');
                                                    setTime(`${item}:${parts[1] || '00'}`);
                                                }}
                                            >
                                                <Text style={[
                                                    styles.modalOptionText,
                                                    currentHour === item && styles.modalOptionTextActive,
                                                    { textAlign: 'center' }
                                                ]}>
                                                    {item}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    }}
                                    showsVerticalScrollIndicator={false}
                                />
                            </View>

                            <Text style={{ fontSize: 32, fontWeight: '700', alignSelf: 'center', marginTop: 20 }}>:</Text>

                            {/* Minutes Column */}
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.sectionLabel, { textAlign: 'center' }]}>MINUTE</Text>
                                <FlatList
                                    data={Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))}
                                    keyExtractor={(item) => item}
                                    renderItem={({ item }) => {
                                        const currentMinute = (time || '12:00').split(':')[1];
                                        return (
                                            <TouchableOpacity
                                                style={[
                                                    styles.modalOption,
                                                    currentMinute === item && styles.modalOptionActive,
                                                    { justifyContent: 'center', borderBottomWidth: 0 }
                                                ]}
                                                onPress={() => {
                                                    const parts = (time || '12:00').split(':');
                                                    setTime(`${parts[0] || '12'}:${item}`);
                                                }}
                                            >
                                                <Text style={[
                                                    styles.modalOptionText,
                                                    currentMinute === item && styles.modalOptionTextActive,
                                                    { textAlign: 'center' }
                                                ]}>
                                                    {item}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    }}
                                    showsVerticalScrollIndicator={false}
                                />
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF',
        padding: 16,
        marginHorizontal: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#E0F2FE', // Light blue background like screenshot
    },
    headerTitle: {
        color: '#1E293B',
        fontSize: 18,
        fontWeight: '700',
    },
    iconButton: {
        padding: 4,
    },
    tabsWrapper: {
        backgroundColor: '#E0F2FE',
        paddingBottom: 2,
    },
    tabsContainerInner: {
        flexGrow: 0,
        paddingHorizontal: 8,
    },
    tabItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {
        borderBottomColor: '#2563EB',
    },
    tabText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#2563EB',
    },
    content: {
        flex: 1,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 30,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    amountCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    amountInput: {
        color: '#0F172A',
        fontSize: 42,
        fontWeight: '700',
        flex: 1,
    },
    amountActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    amountActionBtn: {
        padding: 8,
        marginLeft: 4,
    },
    amountVerticalBar: {
        width: 4,
        height: 36,
        backgroundColor: '#F97316', // Orange bar like screenshot
        marginLeft: 8,
        borderRadius: 2,
    },
    formList: {
        paddingTop: 4,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    itemIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    itemContent: {
        flex: 1,
    },
    itemValue: {
        color: '#0F172A',
        fontSize: 17,
        fontWeight: '500',
    },
    itemLabel: {
        color: '#1E293B',
        fontSize: 17,
        fontWeight: '500',
    },
    itemSubtext: {
        color: '#64748B',
        fontSize: 13,
        marginTop: 2,
    },
    toggleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    placeholderText: {
        color: '#94A3B8',
        fontSize: 17,
        fontWeight: '500',
    },
    bankNameHeader: {
        color: '#0F172A',
        fontSize: 17,
        fontWeight: '700',
    },
    bankDetailText: {
        color: '#64748B',
        fontSize: 14,
        marginTop: 1,
    },
    bankBalanceText: {
        color: '#94A3B8',
        fontSize: 14,
        marginTop: 1,
    },
    bankIconInner: {
        width: '100%',
        height: '100%',
        borderRadius: 22,
        backgroundColor: '#991B1B', // Red for CIBC in screenshot
        justifyContent: 'center',
        alignItems: 'center',
    },
    bankInitials: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
    },
    modalTitle: {
        color: '#1E293B',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalOptionActive: {
        backgroundColor: '#F8FAFC',
    },
    modalOptionText: {
        color: '#0F172A',
        fontSize: 18,
        fontWeight: '500',
    },
    modalOptionTextActive: {
        color: '#2563EB',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    searchInput: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#0F172A',
        fontSize: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modalCloseButton: {
        padding: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currentSelectionContainer: {
        marginBottom: 20,
    },
    sectionLabel: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 1,
    },
    currentSelectionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    currentSelectionText: {
        flex: 1,
        color: '#166534',
        fontSize: 16,
        fontWeight: '600',
    },
    auditContainer: {
        marginTop: 30,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    auditText: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        marginVertical: 1,
        fontWeight: '500',
    },
    splitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
    },
    removeSplitBtn: {
        marginRight: 12,
    },
    splitCategoryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    splitIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    splitCategoryText: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '500',
        flex: 1,
    },
    splitAmountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        width: 100,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingBottom: 4,
    },
    currencySymbol: {
        fontSize: 14,
        color: '#64748B',
        marginRight: 4,
    },
    splitAmountInput: {
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
    },
    addSplitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginTop: 4,
    },
    addSplitIcon: {
        marginRight: 10,
    },
    addSplitText: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: '500',
    }
});

export default EditTransaction;
