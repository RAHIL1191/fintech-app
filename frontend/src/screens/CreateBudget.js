import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Switch, Dimensions, Modal, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft, Users, User, ArrowUp, ArrowDown,
    ShoppingBag, DollarSign, RefreshCw, LayoutGrid, Building2,
    ArrowRight, Bell, ChevronRight, Calculator, Check, X
} from 'lucide-react-native';
import api from '../config/api';

const { width } = Dimensions.get('window');

const CreateBudget = ({ navigation, route }) => {
    // Edit mode params
    const { budget: existingBudget, editMode } = route.params || {};
    const isEditMode = !!existingBudget;
    const [step, setStep] = useState(isEditMode ? 3 : 1); // Skip to form if editing
    const [budgetType, setBudgetType] = useState(existingBudget?.type || null);
    const [categoryType, setCategoryType] = useState(existingBudget?.category_type || null);

    // Form State - pre-fill with existing budget data if editing
    const [budgetName, setBudgetName] = useState(existingBudget?.name || '');
    const [budgetAmount, setBudgetAmount] = useState(existingBudget?.amount?.toString() || '');
    const [recurrence, setRecurrence] = useState(existingBudget?.recurrence_frequency || 'Monthly');
    const [startDate, setStartDate] = useState(existingBudget?.start_date || new Date().toISOString().split('T')[0]);
    const [selectedCategories, setSelectedCategories] = useState(existingBudget?.categories || []);
    const [selectedAccounts, setSelectedAccounts] = useState(existingBudget?.accounts || []);
    const [isRollover, setIsRollover] = useState(existingBudget?.is_rollover || false);
    const [alertPercent, setAlertPercent] = useState(existingBudget?.alert_percent || 70);

    // Modals
    const [showRepeatModal, setShowRepeatModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);

    // Data
    const [availableCategories, setAvailableCategories] = useState([]);
    const [availableAccounts, setAvailableAccounts] = useState([]);

    useEffect(() => {
        if (step === 3) {
            fetchData();
        }
    }, [step]);

    const fetchData = async () => {
        try {
            const [catRes, accRes] = await Promise.all([
                api.get('/categories'),
                api.get('/accounts')
            ]);
            setAvailableCategories(catRes.data);
            setAvailableAccounts(accRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateBudget = async () => {
        try {
            if (!budgetName || !budgetAmount) {
                Alert.alert('Error', 'Please enter budget name and amount');
                return;
            }

            const payload = {
                name: budgetName,
                amount: parseFloat(budgetAmount),
                type: budgetType || 'Personal',
                category_type: categoryType || 'Expense',
                recurrence_frequency: recurrence,
                start_date: startDate,
                categories: selectedCategories,
                accounts: selectedAccounts,
                is_rollover: isRollover,
                alert_percent: alertPercent
            };

            if (isEditMode && existingBudget?.id) {
                // Update existing budget
                await api.put(`/budgets/${existingBudget.id}`, payload);
                Alert.alert('Success', 'Budget updated!', [
                    { text: 'OK', onPress: () => navigation.navigate('Budget') }
                ]);
            } else {
                // Create new budget
                await api.post('/budgets', payload);
                Alert.alert('Success', 'Budget created!', [
                    { text: 'OK', onPress: () => navigation.navigate('Budget') }
                ]);
            }
        } catch (error) {
            console.error('Budget save error:', error);
            Alert.alert('Error', isEditMode ? 'Failed to update budget' : 'Failed to create budget');
        }
    };

    const handleBack = () => {
        if (step === 1) {
            navigation.goBack();
        } else {
            setStep(step - 1);
        }
    };

    const handleSelectType = (type) => {
        setBudgetType(type);
        setStep(2);
    };

    const handleSelectCategoryType = (type) => {
        setCategoryType(type);
        setStep(3);
    };

    const renderStep1 = () => (
        <ScrollView contentContainerStyle={styles.stepContainer}>
            <TouchableOpacity style={styles.card} onPress={() => handleSelectType('Group')}>
                <Text style={styles.cardTitle}>Group Budget</Text>
                <View style={styles.iconContainer}>
                    <Users size={48} color="#3B82F6" />
                    <View style={styles.plusBadge}><Text style={styles.plusText}>+</Text></View>
                </View>
                <Text style={styles.cardDesc}>
                    Budgeting together creates a sense of belonging and responsibility
                </Text>
            </TouchableOpacity>

            <View style={styles.orDivider}>
                <Text style={styles.orText}>OR</Text>
            </View>

            <TouchableOpacity style={styles.card} onPress={() => handleSelectType('Personal')}>
                <Text style={styles.cardTitle}>Personal Budget</Text>
                <View style={styles.iconContainer}>
                    <User size={48} color="#3B82F6" />
                    <View style={styles.plusBadge}><Text style={styles.plusText}>+</Text></View>
                </View>
                <Text style={styles.cardDesc}>
                    Empowers financial control, fosters savings and support goal achievement
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderStep2 = () => (
        <ScrollView contentContainerStyle={styles.stepContainer}>
            <Text style={styles.stepTitle}>Which type of budget?</Text>

            <TouchableOpacity style={styles.card} onPress={() => handleSelectCategoryType('Expense')}>
                <Text style={styles.cardTitle}>Expense Budget</Text>
                <View style={styles.iconRoundContainer}>
                    <ArrowUp size={32} color="#F59E0B" />
                </View>
                <Text style={styles.cardDesc}>
                    Track and control where your money goes.
                </Text>
            </TouchableOpacity>

            <View style={styles.orDivider}>
                <Text style={styles.orText}>OR</Text>
            </View>

            <TouchableOpacity style={styles.card} onPress={() => handleSelectCategoryType('Income')}>
                <Text style={styles.cardTitle}>Income Budget</Text>
                <View style={styles.iconRoundContainer}>
                    <ArrowDown size={32} color="#10B981" />
                </View>
                <Text style={styles.cardDesc}>
                    Plan and manage your income streams.
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const getEditSubtitle = () => {
        const monthName = new Date(startDate).toLocaleString('en-US', { month: 'long' });
        if (editMode === 'all_future') {
            return `Editing ${monthName} and all occurrences after this.`;
        } else if (editMode === 'this_only') {
            return `Editing ${monthName} only`;
        }
        return null;
    };

    const renderStep3 = () => (
        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Read-only Type Field */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Type <Text style={{ fontWeight: '700' }}>{categoryType || 'Expense'}</Text></Text>
                {isEditMode && (
                    <Text style={styles.editSubtitle}>{getEditSubtitle()}</Text>
                )}
            </View>

            {/* Budget Name */}
            <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                    <ShoppingBag size={20} color="#64748B" />
                </View>
                <TextInput
                    style={styles.input}
                    placeholder="Budget Name"
                    value={budgetName}
                    onChangeText={setBudgetName}
                />
                <TouchableOpacity><Check size={20} color="#3B82F6" /></TouchableOpacity>
            </View>

            {/* Budget Amount */}
            <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                    <DollarSign size={20} color="#64748B" />
                </View>
                <TextInput
                    style={styles.input}
                    placeholder="Budget Amount"
                    keyboardType="numeric"
                    value={budgetAmount}
                    onChangeText={setBudgetAmount}
                />
                <TouchableOpacity><Calculator size={20} color="#64748B" /></TouchableOpacity>
            </View>

            {/* Recurrence */}
            <TouchableOpacity style={styles.selectorRow} onPress={() => setShowRepeatModal(true)}>
                <View style={styles.selectorLeft}>
                    <View style={styles.inputIcon}><RefreshCw size={20} color="#64748B" /></View>
                    <View>
                        <Text style={styles.selectorTitle}>Repeats {recurrence}</Text>
                        <Text style={styles.selectorSubtitle}>Starting {new Date(startDate).toLocaleDateString()}</Text>
                    </View>
                </View>
                <ChevronRight size={20} color="#3B82F6" />
            </TouchableOpacity>

            {/* Categories */}
            <TouchableOpacity style={styles.selectorRow} onPress={() => setShowCategoryModal(true)}>
                <View style={styles.selectorLeft}>
                    <View style={styles.inputIcon}><LayoutGrid size={20} color="#64748B" /></View>
                    <View>
                        <Text style={selectedCategories.length > 0 ? styles.selectorTitle : styles.selectorTitle_Placeholder}>
                            {selectedCategories.length > 0 ? `${selectedCategories.length} Selected` : 'Select Categories'}
                        </Text>
                    </View>
                </View>
                <ChevronRight size={20} color="#3B82F6" />
            </TouchableOpacity>
            <Text style={styles.helperText}>All categories are included if not selected any.</Text>

            {/* Accounts */}
            <TouchableOpacity style={styles.selectorRow} onPress={() => setShowAccountModal(true)}>
                <View style={styles.selectorLeft}>
                    <View style={styles.inputIcon}><Building2 size={20} color="#64748B" /></View>
                    <View>
                        <Text style={selectedAccounts.length > 0 ? styles.selectorTitle : styles.selectorTitle_Placeholder}>
                            {selectedAccounts.length > 0 ? `${selectedAccounts.length} Selected` : 'Select Accounts'}
                        </Text>
                    </View>
                </View>
                <ChevronRight size={20} color="#3B82F6" />
            </TouchableOpacity>
            <Text style={styles.helperText}>All accounts are included if not selected any.</Text>

            {/* Toggle Rollover */}
            <View style={styles.toggleRow}>
                <View style={styles.selectorLeft}>
                    <View style={styles.inputIcon}><ArrowRight size={20} color="#64748B" /></View>
                    <Text style={styles.selectorTitle}>Rollover budget amount</Text>
                </View>
                <Switch
                    trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                    thumbColor={isRollover ? "#3B82F6" : "#f4f3f4"}
                    onValueChange={setIsRollover}
                    value={isRollover}
                />
            </View>

            {/* Slider Alert */}
            <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                    <Bell size={20} color="#64748B" />
                    <Text style={styles.sliderLabel}>Alert me when expense reaches <Text style={{ fontWeight: '700' }}>{alertPercent}%</Text> of budget</Text>
                </View>
                <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${alertPercent}%` }]} />
                    <View style={[styles.sliderThumb, { left: `${alertPercent}%` }]} />
                </View>
            </View>
        </ScrollView>
    );

    // --- MODALS ---

    const renderRepeatModal = () => {
        const options = ['Monthly', 'Bi-Monthly', 'Weekly', 'Bi-Weekly', 'One Time', 'Custom'];

        return (
            <Modal transparent={true} visible={showRepeatModal} animationType="fade" onRequestClose={() => setShowRepeatModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRepeatModal(false)}>
                    <View style={styles.bottomSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select repeat option</Text>
                            <TouchableOpacity onPress={() => setShowRepeatModal(false)}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.gridContainer}>
                            {options.map(option => (
                                <TouchableOpacity
                                    key={option}
                                    style={[styles.gridOption, recurrence === option && styles.gridOptionSelected]}
                                    onPress={() => setRecurrence(option)}
                                >
                                    <Text style={[styles.gridOptionText, recurrence === option && styles.gridOptionTextSelected]}>{option}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.labelStart}>Start Date</Text>
                        <TextInput
                            style={styles.dateInput}
                            value={startDate} // In real app use DateTimePicker
                            onChangeText={setStartDate}
                        />

                        <TouchableOpacity style={styles.applyBtn} onPress={() => setShowRepeatModal(false)}>
                            <Text style={styles.applyBtnText}>APPLY</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    const renderCategoryModal = () => (
        <Modal transparent={true} visible={showCategoryModal} animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
            <View style={styles.modalFullScreen}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowCategoryModal(false)}><ArrowLeft size={24} color="#000" /></TouchableOpacity>
                    <Text style={styles.modalTitle}>Select Categories</Text>
                    <View style={{ width: 24 }} />
                </View>
                {availableCategories.length > 0 ? (
                    <FlatList
                        data={availableCategories}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{ paddingBottom: 80 }}
                        renderItem={({ item }) => {
                            const isSelected = selectedCategories.includes(item.name);
                            return (
                                <TouchableOpacity style={styles.listItem} onPress={() => {
                                    if (isSelected) setSelectedCategories(prev => prev.filter(c => c !== item.name));
                                    else setSelectedCategories(prev => [...prev, item.name]);
                                }}>
                                    <Text style={styles.listItemText}>{item.name}</Text>
                                    {isSelected && <Check size={20} color="#3B82F6" />}
                                </TouchableOpacity>
                            );
                        }}
                    />
                ) : (
                    <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading categories...</Text>
                )}
                <TouchableOpacity style={styles.fabData} onPress={() => setShowCategoryModal(false)}>
                    <Check size={24} color="#FFF" />
                </TouchableOpacity>
            </View>
        </Modal>
    );

    const renderAccountModal = () => (
        <Modal transparent={true} visible={showAccountModal} animationType="slide" onRequestClose={() => setShowAccountModal(false)}>
            <View style={styles.modalFullScreen}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowAccountModal(false)}><ArrowLeft size={24} color="#000" /></TouchableOpacity>
                    <Text style={styles.modalTitle}>Select Accounts</Text>
                    <View style={{ width: 24 }} />
                </View>
                {availableAccounts.length > 0 ? (
                    <FlatList
                        data={availableAccounts}
                        keyExtractor={item => item.account_id}
                        contentContainerStyle={{ paddingBottom: 80 }}
                        renderItem={({ item }) => {
                            const isSelected = selectedAccounts.includes(item.account_id);
                            return (
                                <TouchableOpacity style={styles.listItem} onPress={() => {
                                    if (isSelected) setSelectedAccounts(prev => prev.filter(a => a !== item.account_id));
                                    else setSelectedAccounts(prev => [...prev, item.account_id]);
                                }}>
                                    <Text style={styles.listItemText}>{item.name} (...{item.mask})</Text>
                                    {isSelected && <Check size={20} color="#3B82F6" />}
                                </TouchableOpacity>
                            );
                        }}
                    />
                ) : (
                    <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading accounts...</Text>
                )}
                <TouchableOpacity style={styles.fabData} onPress={() => setShowAccountModal(false)}>
                    <Check size={24} color="#FFF" />
                </TouchableOpacity>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#3B82F6" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isEditMode ? 'Edit Budget' : 'Create Budget'}</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Content Body */}
            <View style={{ flex: 1 }}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </View>

            {/* Navigation Button (Only Step 3) */}
            {step === 3 && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.nextBtn} onPress={handleCreateBudget}>
                        <Text style={styles.nextBtnText}>{isEditMode ? 'UPDATE' : 'CREATE BUDGET'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {renderRepeatModal()}
            {renderCategoryModal()}
            {renderAccountModal()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FE',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#0F172A' },

    stepContainer: {
        padding: 24,
        alignItems: 'center',
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 24,
        color: '#1E293B',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 24,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 8,
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
        color: '#0F172A',
    },
    iconContainer: {
        marginBottom: 16,
        position: 'relative',
    },
    iconRoundContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    plusBadge: {
        position: 'absolute',
        bottom: -4,
        right: -8,
        backgroundColor: '#3B82F6',
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
    cardDesc: {
        textAlign: 'center',
        color: '#64748B',
        fontSize: 14,
        lineHeight: 20,
    },
    orDivider: {
        marginVertical: 16,
        alignItems: 'center',
    },
    orText: { color: '#94A3B8', fontSize: 14 },

    // Form Styles
    formScroll: { flex: 1, padding: 16 },
    inputGroup: {
        backgroundColor: '#FFF',
        borderRadius: 12, // Grouped inputs? Picture shows separated items but top one is label
        marginBottom: 16,
        padding: 16,
    },
    label: { fontSize: 14, color: '#64748B', textAlign: 'center' },
    editSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 4 },
    // Fix alignment for type label

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        height: 56,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: '#0F172A' },

    selectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 4,
    },
    selectorLeft: { flexDirection: 'row', alignItems: 'center' },
    selectorTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    selectorSubtitle: { fontSize: 12, color: '#64748B' },
    selectorTitle_Placeholder: { fontSize: 16, color: '#94A3B8' },
    helperText: { fontSize: 12, color: '#94A3B8', marginLeft: 16, marginBottom: 16 },

    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },

    sliderContainer: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    sliderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
    sliderLabel: { fontSize: 14, color: '#475569', flex: 1 },
    sliderTrack: {
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        position: 'relative',
        marginHorizontal: 8,
    },
    sliderFill: {
        height: 4,
        backgroundColor: '#3B82F6',
        borderRadius: 2,
        width: '70%',
    },
    sliderThumb: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#3B82F6',
        position: 'absolute',
        top: -6,
        marginLeft: -8,
    },

    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    nextBtn: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    gridOption: {
        width: (width - 60) / 2, // 2 columns with gaps
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        alignItems: 'center',
    },
    gridOptionSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    gridOptionText: { color: '#64748B', fontWeight: '500' },
    gridOptionTextSelected: { color: '#3B82F6', fontWeight: 'bold' },

    labelStart: { fontSize: 14, color: '#64748B', marginBottom: 8 },
    dateInput: {
        backgroundColor: '#F1F5F9', // Gray background like in picture
        borderRadius: 8,
        padding: 12,
        textAlign: 'center',
        color: '#0F172A',
        fontWeight: '600',
        marginBottom: 24,
    },
    applyBtn: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

    modalFullScreen: {
        flex: 1,
        backgroundColor: '#F8F9FE',
        padding: 16,
        paddingTop: 50,
    },
    listItem: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    listItemText: { fontSize: 16, color: '#0F172A' },
    fabData: {
        position: 'absolute',
        bottom: 32,
        right: 32,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
    }
});

export default CreateBudget;
