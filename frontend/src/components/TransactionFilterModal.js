import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, FlatList
} from 'react-native';
import { X, Plus, Calendar, Check, Search } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const TransactionFilterModal = ({
    visible,
    onClose,
    onApply,
    initialFilters,
    availableCategories = [],
    availableAccounts = []
}) => {
    const [filterType, setFilterType] = useState('All');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedAccounts, setSelectedAccounts] = useState([]);
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [amountRange, setAmountRange] = useState({ min: '', max: '' });
    const [note, setNote] = useState('');

    // Selectors
    const [showCategorySelector, setShowCategorySelector] = useState(false);
    const [showAccountSelector, setShowAccountSelector] = useState(false);

    // Date Picker
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dateMode, setDateMode] = useState('start');

    useEffect(() => {
        if (visible) {
            setFilterType(initialFilters.type || 'All');
            setSelectedCategories(initialFilters.categories || []);
            setSelectedAccounts(initialFilters.accounts || []);
            setDateRange(initialFilters.dateRange || { start: null, end: null });
            setAmountRange(initialFilters.amountRange || { min: '', max: '' });
            setNote(initialFilters.note || '');
        }
    }, [visible, initialFilters]);

    const handleClear = () => {
        setFilterType('All');
        setSelectedCategories([]);
        setSelectedAccounts([]);
        setDateRange({ start: null, end: null });
        setAmountRange({ min: '', max: '' });
        setNote('');
    };

    const handleApply = () => {
        onApply({
            type: filterType,
            categories: selectedCategories,
            accounts: selectedAccounts,
            dateRange,
            amountRange,
            note
        });
        onClose();
    };

    const removeCategory = (cat) => {
        setSelectedCategories(prev => prev.filter(c => c !== cat));
    };

    const removeAccount = (accId) => {
        setSelectedAccounts(prev => prev.filter(id => id !== accId));
    };

    const formatDate = (date) => {
        if (!date) return '';
        return date.toISOString().split('T')[0];
    };

    const onDateChange = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate) {
            if (dateMode === 'start') {
                setDateRange(prev => ({ ...prev, start: selectedDate }));
            } else {
                setDateRange(prev => ({ ...prev, end: selectedDate }));
            }
        }
    };

    // Sub-Modal for Selection
    const SelectionModal = ({ visible, title, items, selectedItems, onSelect, onClose, itemLabelFn, keyExtractor, valExtractor }) => {
        const getKey = keyExtractor || (item => item.id || item);
        const getVal = valExtractor || (item => item.id || item);

        return (
            <Modal visible={visible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.selectorContainer}>
                        <View style={styles.selectorHeader}>
                            <Text style={styles.selectorTitle}>{title}</Text>
                            <TouchableOpacity onPress={onClose}>
                                <X size={24} color="#1A1A1A" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={items}
                            keyExtractor={getKey}
                            renderItem={({ item }) => {
                                const val = getVal(item);
                                const isSelected = selectedItems.includes(val);
                                return (
                                    <TouchableOpacity
                                        style={[styles.selectorItem, isSelected && styles.selectorItemSelected]}
                                        onPress={() => onSelect(val)}
                                    >
                                        <Text style={[styles.selectorItemText, isSelected && styles.selectorItemTextSelected]}>
                                            {itemLabelFn ? itemLabelFn(item) : item}
                                        </Text>
                                        {isSelected && <Check size={20} color="#0EA5E9" />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} presentationStyle="pageSheet">
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Filters</Text>
                    <TouchableOpacity onPress={onClose}>
                        <X size={24} color="#1A1A1A" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>

                    {/* Filter Type */}
                    <Text style={styles.sectionTitle}>Filters</Text>
                    <View style={styles.typeRow}>
                        {['All', 'Expenses', 'Income', 'Transfer'].map(t => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.typePill, filterType === t && styles.typePillActive]}
                                onPress={() => setFilterType(t)}
                            >
                                <Text style={[styles.typeText, filterType === t && styles.typeTextActive]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Categories */}
                    <View style={styles.rowHeader}>
                        <Text style={styles.sectionTitle}>Categories</Text>
                        <TouchableOpacity onPress={() => setShowCategorySelector(true)}>
                            <Plus size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.pillContainer}>
                        {selectedCategories.map(cat => (
                            <TouchableOpacity key={cat} style={styles.selectionPill} onPress={() => removeCategory(cat)}>
                                <Text style={styles.selectionPillText}>{cat}</Text>
                                <X size={14} color="#EF4444" style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                        ))}
                        {selectedCategories.length === 0 && <Text style={styles.placeholderText}>Any Category</Text>}
                    </View>

                    {/* Accounts */}
                    <View style={styles.rowHeader}>
                        <Text style={styles.sectionTitle}>Accounts</Text>
                        <TouchableOpacity onPress={() => setShowAccountSelector(true)}>
                            <Plus size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.pillContainer}>
                        {selectedAccounts.map(accId => {
                            const acc = availableAccounts.find(a => a.account_id === accId);
                            return (
                                <TouchableOpacity key={accId} style={styles.selectionPill} onPress={() => removeAccount(accId)}>
                                    <Text style={styles.selectionPillText}>{acc ? acc.name : 'Unknown'}</Text>
                                    <X size={14} color="#EF4444" style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            );
                        })}
                        {selectedAccounts.length === 0 && <Text style={styles.placeholderText}>Any Account</Text>}
                    </View>

                    {/* Date Range */}
                    <Text style={styles.sectionTitle}>Date Range</Text>
                    <View style={styles.dateRow}>
                        <TouchableOpacity
                            style={styles.dateInput}
                            onPress={() => { setDateMode('start'); setShowDatePicker(true); }}
                        >
                            <Calendar size={18} color="#64748B" style={{ marginRight: 8 }} />
                            <Text style={styles.dateText}>{dateRange.start ? formatDate(dateRange.start) : 'Start Date'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.dateInput}
                            onPress={() => { setDateMode('end'); setShowDatePicker(true); }}
                        >
                            <Calendar size={18} color="#64748B" style={{ marginRight: 8 }} />
                            <Text style={styles.dateText}>{dateRange.end ? formatDate(dateRange.end) : 'End Date'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Amount */}
                    <Text style={styles.sectionTitle}>Amount</Text>
                    <View style={styles.amountRow}>
                        <TextInput
                            style={styles.amountInput}
                            placeholder="Min"
                            keyboardType="numeric"
                            value={amountRange.min}
                            onChangeText={t => setAmountRange(prev => ({ ...prev, min: t }))}
                            placeholderTextColor="#94A3B8"
                        />
                        <TextInput
                            style={styles.amountInput}
                            placeholder="Max"
                            keyboardType="numeric"
                            value={amountRange.max}
                            onChangeText={t => setAmountRange(prev => ({ ...prev, max: t }))}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Notes */}
                    <Text style={styles.sectionTitle}>Notes</Text>
                    <TextInput
                        style={styles.noteInput}
                        placeholder="Something like 'grocery'..."
                        value={note}
                        onChangeText={setNote}
                        placeholderTextColor="#94A3B8"
                    />

                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                        <Text style={styles.clearBtnText}>CLEAR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
                        <Text style={styles.applyBtnText}>APPLY</Text>
                    </TouchableOpacity>
                </View>

                {showDatePicker && (
                    <DateTimePicker
                        value={dateMode === 'start' ? (dateRange.start || new Date()) : (dateRange.end || new Date())}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                    />
                )}

                <SelectionModal
                    visible={showCategorySelector}
                    title="Select Categories"
                    items={availableCategories}
                    selectedItems={selectedCategories}
                    onSelect={(cat) => {
                        if (selectedCategories.includes(cat)) removeCategory(cat);
                        else setSelectedCategories([...selectedCategories, cat]);
                    }}
                    onClose={() => setShowCategorySelector(false)}
                />

                <SelectionModal
                    visible={showAccountSelector}
                    title="Select Accounts"
                    items={availableAccounts}
                    selectedItems={selectedAccounts}
                    itemLabelFn={(item) => `${item.institution_name} - ${item.name} (${item.mask})`}
                    keyExtractor={item => item.account_id}
                    valExtractor={item => item.account_id}
                    onSelect={(accId) => {
                        if (selectedAccounts.includes(accId)) removeAccount(accId);
                        else setSelectedAccounts([...selectedAccounts, accId]);
                    }}
                    onClose={() => setShowAccountSelector(false)}
                />

            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    content: {
        padding: 20,
        paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 12,
        marginTop: 8,
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 12,
    },
    typeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    typePill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        marginRight: 8,
        marginBottom: 8,
    },
    typePillActive: {
        backgroundColor: '#0EA5E9',
    },
    typeText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600',
    },
    typeTextActive: {
        color: '#FFF',
    },
    pillContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16,
    },
    selectionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: '#FFF',
    },
    selectionPillText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '500',
    },
    placeholderText: {
        color: '#94A3B8',
        fontSize: 14,
        fontStyle: 'italic',
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    dateInput: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginHorizontal: 4,
    },
    dateText: {
        color: '#334155',
        fontSize: 14,
        fontWeight: '500',
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    amountInput: {
        flex: 1,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 20,
        marginHorizontal: 4,
        fontSize: 14,
        textAlign: 'center',
        color: '#1A1A1A',
    },
    noteInput: {
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 20,
        fontSize: 14,
        marginBottom: 16,
        color: '#1A1A1A',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    clearBtn: {
        flex: 1,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
        backgroundColor: '#F1F5F9',
        marginRight: 10,
    },
    clearBtnText: {
        color: '#334155',
        fontSize: 16,
        fontWeight: '700',
    },
    applyBtn: {
        flex: 2,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
        backgroundColor: '#0EA5E9',
        marginLeft: 10,
    },
    applyBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    // Selector Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    selectorContainer: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '70%',
        padding: 20,
    },
    selectorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    selectorTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    selectorItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    selectorItemSelected: {
        backgroundColor: '#F0F9FF',
    },
    selectorItemText: {
        fontSize: 16,
        color: '#334155',
    },
    selectorItemTextSelected: {
        color: '#0EA5E9',
        fontWeight: '600',
    },
});

export default TransactionFilterModal;
