import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft, Check, Calendar, Tag, CreditCard,
    AlignLeft, DollarSign, Repeat, ChevronRight,
    User, Smartphone, Wallet, List, X, Plus
} from 'lucide-react-native';
import api from '../config/api';
import { loadToken } from '../store/TokenStore';
import CustomDatePicker from '../components/CustomDatePicker';

const EditTransaction = ({ navigation, route }) => {
    const { transaction, mode = 'edit', type: paramType } = route.params || {};

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState('');
    const [isTransfer, setIsTransfer] = useState(false);
    const [recurringFrequency, setRecurringFrequency] = useState('Once'); // Once | Weekly | Bi-weekly | Monthly | Yearly
    const [showFrequencyModal, setShowFrequencyModal] = useState(false);
    const [showDateModal, setShowDateModal] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [categories, setCategories] = useState([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [merchants, setMerchants] = useState([]);
    const [showMerchantModal, setShowMerchantModal] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [isAccountLoading, setIsAccountLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [merchantSearchQuery, setMerchantSearchQuery] = useState('');
    const [tempNote, setTempNote] = useState('');

    const FREQUENCIES = ['Once', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];

    // Initialize state from transaction if provided
    useEffect(() => {
        if (transaction) {
            setAmount(Math.abs(transaction.amount).toString());
            setDescription(transaction.name);
            setCategory(transaction.personal_finance_category?.primary || '');
            setNote(transaction.note || '');
            setDate(transaction.date || '');
            // Account set in fetchAccounts
            setRecurringFrequency(transaction.recurring_frequency || 'Once');
            setIsTransfer(!!transaction.is_transfer);
        }
        fetchCategories();
        fetchMerchants();
        fetchAccounts();
    }, [transaction]);

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
            setCategory(response.data.name);
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

    const handleSave = async () => {
        const metadata = {
            category,
            merchant_name: description,
            account_id: selectedAccount?.account_id,
            date,
            note,
            recurring_frequency: recurringFrequency,
            is_transfer: isTransfer ? 1 : 0
        };

        if (transaction?.transaction_id) {
            try {
                await api.post(`/metadata/transaction/${transaction.transaction_id}`, metadata);
                console.log('Successfully saved transaction metadata');
            } catch (error) {
                console.error('Failed to save metadata:', error);
            }
        }

        navigation.goBack();
    };

    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredMerchants = merchants.filter(m =>
        m.toLowerCase().includes(merchantSearchQuery.toLowerCase())
    );

    // Plaid: positive amount = expense, negative = income
    // If we have a transaction, use its amount. Otherwise use paramType or default to expense.
    const isExpense = transaction ? transaction.amount > 0 : paramType !== 'income';
    const typeLabel = isExpense ? 'Expense' : 'Income';
    const headerTitle = `${mode === 'edit' ? 'Edit' : 'Add'} ${typeLabel}`;

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

            <ScrollView style={styles.content}>
                {/* Amount Input */}
                <View style={styles.amountContainer}>
                    <View style={styles.amountCircle}>
                        <DollarSign size={24} color="#FFF" />
                    </View>
                    <TextInput
                        style={styles.amountInput}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor="#475569"
                    />
                </View>

                {/* Form Fields - List Style */}
                <View style={styles.formList}>
                    {/* Category */}
                    <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => setShowCategoryModal(true)}
                    >
                        <View style={[styles.itemIconCircle, { backgroundColor: '#10B981' }]}>
                            <Smartphone size={20} color="#FFF" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemValue}>{category || 'Select Category'}</Text>
                        </View>
                        <ChevronRight size={20} color="#475569" />
                    </TouchableOpacity>

                    {/* Merchant / Description */}
                    <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => setShowMerchantModal(true)}
                    >
                        <View style={[styles.itemIconCircle, { backgroundColor: '#10B981' }]}>
                            <User size={20} color="#FFF" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemValue} numberOfLines={1}>{description || 'Enter Merchant'}</Text>
                        </View>
                        <ChevronRight size={20} color="#475569" />
                    </TouchableOpacity>

                    {/* Account */}
                    <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => setShowAccountModal(true)}
                    >
                        <View style={[styles.itemIconCircle, { backgroundColor: '#3B82F6' }]}>
                            <Wallet size={20} color="#FFF" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemLabel}>Account</Text>
                            <Text style={styles.itemSubtext}>
                                {selectedAccount ? `${selectedAccount.name} (...${selectedAccount.mask})` : 'Select Account'}
                            </Text>
                        </View>
                        <ChevronRight size={20} color="#475569" />
                    </TouchableOpacity>

                    {/* Date */}
                    <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => setShowDateModal(true)}
                    >
                        <View style={[styles.itemIconCircle, { backgroundColor: '#334155' }]}>
                            <Calendar size={20} color="#FFF" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemValue}>
                                {date || transaction?.date || 'Select Date'}
                            </Text>
                        </View>
                        <ChevronRight size={20} color="#475569" />
                    </TouchableOpacity>

                    {/* Notes */}
                    <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => {
                            setTempNote(note);
                            setShowNoteModal(true);
                        }}
                    >
                        <View style={[styles.itemIconCircle, { backgroundColor: '#334155' }]}>
                            <List size={20} color="#FFF" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemValue} numberOfLines={1}>{note || 'Add notes'}</Text>
                        </View>
                        <ChevronRight size={20} color="#475569" />
                    </TouchableOpacity>

                    {/* Transfer Toggle */}
                    <View style={styles.toggleItem}>
                        <View style={[styles.itemIconCircle, { backgroundColor: '#6366F1' }]}>
                            <Repeat size={20} color="#FFF" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemLabel}>Mark as Transfer</Text>
                            <Text style={styles.itemSubtext}>
                                This transaction will be included in {isExpense ? 'expense' : 'income'} calculations
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
                            <Text style={styles.itemValue}>{recurringFrequency}</Text>
                        </View>
                        <ChevronRight size={20} color="#475569" />
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Frequency Selection Modal */}
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
                    <View style={styles.modalContent}>
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
            <Modal
                visible={showCategoryModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.modalCloseButton}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Category</Text>
                            <View style={{ width: 24 }} />
                        </View>

                        {category ? (
                            <View style={styles.currentSelectionContainer}>
                                <Text style={styles.sectionLabel}>CURRENTLY SELECTED</Text>
                                <View style={styles.currentSelectionCard}>
                                    <View style={[styles.itemIconCircle, { backgroundColor: '#10B981', width: 32, height: 32, marginRight: 12 }]}>
                                        <Tag size={16} color="#FFF" />
                                    </View>
                                    <Text style={styles.currentSelectionText}>{category}</Text>
                                    <Check size={20} color="#10B981" />
                                </View>
                            </View>
                        ) : null}

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search categories..."
                            placeholderTextColor="#64748B"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <ScrollView>
                            {filteredCategories.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.modalOption,
                                        category === cat.name && styles.modalOptionActive
                                    ]}
                                    onPress={() => {
                                        setCategory(cat.name);
                                        setShowCategoryModal(false);
                                    }}
                                >
                                    <View style={styles.row}>
                                        <View style={[styles.itemIconCircle, { backgroundColor: cat.color, width: 32, height: 32, marginRight: 12 }]}>
                                            <Tag size={16} color="#FFF" />
                                        </View>
                                        <Text style={[
                                            styles.modalOptionText,
                                            category === cat.name && styles.modalOptionTextActive
                                        ]}>
                                            {cat.name}
                                        </Text>
                                    </View>
                                    {category === cat.name ? <Check size={20} color="#0EA5E9" /> : null}
                                </TouchableOpacity>
                            ))}
                            {searchQuery && !filteredCategories.some(c => c.name.toLowerCase() === searchQuery.toLowerCase()) && (
                                <TouchableOpacity
                                    style={styles.modalOption}
                                    onPress={handleCreateCategory}
                                >
                                    <View style={styles.row}>
                                        <View style={[styles.itemIconCircle, { backgroundColor: '#6366F1', width: 32, height: 32, marginRight: 12 }]}>
                                            <Plus size={16} color="#FFF" />
                                        </View>
                                        <Text style={[styles.modalOptionText, { color: '#0EA5E9' }]}>
                                            Create "{searchQuery}"
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Account Selection Modal */}
            <Modal
                visible={showAccountModal}
                transparent={false}
                animationType="slide"
                onRequestClose={() => setShowAccountModal(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
                    <View style={[styles.modalContent, { flex: 1, borderRadius: 0, paddingBottom: 0 }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowAccountModal(false)} style={styles.modalCloseButton}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Account</Text>
                            <View style={{ width: 24 }} />
                        </View>

                        <ScrollView>
                            {accounts.map((acc) => (
                                <TouchableOpacity
                                    key={acc.account_id}
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
                                        <View style={[styles.itemIconCircle, { backgroundColor: '#1E293B', width: 32, height: 32, marginRight: 12 }]}>
                                            <Wallet size={16} color="#FFF" />
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
                            ))}
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Merchant Selection Modal */}
            <Modal
                visible={showMerchantModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowMerchantModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowMerchantModal(false)} style={styles.modalCloseButton}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Merchant</Text>
                            <View style={{ width: 24 }} />
                        </View>

                        {description ? (
                            <View style={styles.currentSelectionContainer}>
                                <Text style={styles.sectionLabel}>CURRENT MERCHANT</Text>
                                <View style={styles.currentSelectionCard}>
                                    <View style={[styles.itemIconCircle, { backgroundColor: '#3B82F6', width: 32, height: 32, marginRight: 12 }]}>
                                        <User size={16} color="#FFF" />
                                    </View>
                                    <Text style={styles.currentSelectionText}>{description}</Text>
                                    <Check size={20} color="#10B981" />
                                </View>
                            </View>
                        ) : null}

                        <TextInput
                            style={styles.searchInput}
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

                        <ScrollView>
                            {filteredMerchants.map((m, idx) => (
                                <TouchableOpacity
                                    key={idx}
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
                                        <View style={[styles.itemIconCircle, { backgroundColor: '#334155', width: 32, height: 32, marginRight: 12 }]}>
                                            <User size={16} color="#FFF" />
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
                            ))}
                            {merchantSearchQuery && !merchants.includes(merchantSearchQuery) && (
                                <TouchableOpacity
                                    style={styles.modalOption}
                                    onPress={() => {
                                        setDescription(merchantSearchQuery);
                                        setShowMerchantModal(false);
                                    }}
                                >
                                    <View style={styles.row}>
                                        <View style={[styles.itemIconCircle, { backgroundColor: '#0EA5E9', width: 32, height: 32, marginRight: 12 }]}>
                                            <Plus size={16} color="#FFF" />
                                        </View>
                                        <Text style={styles.modalOptionText}>
                                            Add "{merchantSearchQuery}"
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Date Selection Modal */}
            <Modal
                visible={showDateModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowDateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: 'auto', maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowDateModal(false)} style={styles.modalCloseButton}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Date</Text>
                            <View style={{ width: 24 }} />
                        </View>

                        <CustomDatePicker
                            selectedDate={date}
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
                    <View style={[styles.modalContent, { height: '60%' }]}>
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
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#071021',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#2563EB', // Blue header like screenshot
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
    },
    iconButton: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    amountCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    amountInput: {
        color: '#FFF',
        fontSize: 36,
        fontWeight: '700',
        flex: 1,
    },
    formList: {
        paddingTop: 8,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    toggleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    itemIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    itemContent: {
        flex: 1,
    },
    itemValue: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '500',
    },
    itemLabel: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '500',
    },
    itemSubtext: {
        color: '#64748B',
        fontSize: 13,
        marginTop: 2,
    },
    itemSubtitle: {
        color: '#94A3B8',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        color: '#FFF',
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
        borderBottomColor: '#1E293B',
    },
    modalOptionActive: {
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginHorizontal: -12,
    },
    modalOptionText: {
        color: '#94A3B8',
        fontSize: 18,
        fontWeight: '500',
    },
    modalOptionTextActive: {
        color: '#0EA5E9',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    searchInput: {
        backgroundColor: '#1E293B',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#FFF',
        fontSize: 16,
        marginBottom: 16,
    },
    modalCloseButton: {
        padding: 4,
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
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    currentSelectionText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    }
});

export default EditTransaction;

