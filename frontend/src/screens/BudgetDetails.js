import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Modal, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Pencil, MoreVertical, ChevronLeft, ChevronRight, X, AlertCircle, DollarSign } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import api from '../config/api';
import BudgetTransactionsModal from '../components/BudgetTransactionsModal';

const BudgetDetails = ({ navigation, route }) => {
    const { budget: initialBudget } = route.params || {};
    const [budget, setBudget] = useState(initialBudget);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(false);

    // State for modals
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [showExpensesModal, setShowExpensesModal] = useState(false);
    const [overspendingAlert, setOverspendingAlert] = useState(true);
    const [spendingAlert, setSpendingAlert] = useState(true);

    useEffect(() => {
        fetchBudgetDetails();
    }, [currentDate]);

    const fetchBudgetDetails = async () => {
        if (!initialBudget?.id) return;
        try {
            setLoading(true);
            const month = currentDate.getMonth() + 1;
            const year = currentDate.getFullYear();
            const response = await api.get(`/budgets/${initialBudget.id}?month=${month}&year=${year}`);
            setBudget(response.data);
        } catch (error) {
            console.error('Failed to fetch budget details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!budget) {
        return (
            <SafeAreaView style={styles.container}>
                <Text>No budget data</Text>
            </SafeAreaView>
        );
    }

    const spent = budget.spent || 0;
    const limit = budget.limit || budget.amount || 0;
    const remaining = limit - spent;
    const isOver = spent > limit;
    const overAmount = isOver ? spent - limit : 0;
    const percent = limit > 0 ? (spent / limit) * 100 : 0;

    // Safe Icon resolution
    const Icon = (budget.icon && LucideIcons[budget.icon]) ? LucideIcons[budget.icon] : DollarSign;

    const formatMonth = (date) => {
        return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace(',', '');
    };

    const handlePrevMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() - 1);
        setCurrentDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + 1);
        setCurrentDate(newDate);
    };

    const handleEditThisOnly = () => {
        setShowEditModal(false);
        // Navigate to edit screen for this occurrence only
        navigation.navigate('CreateBudget', { budget, editMode: 'this_only' });
    };

    const handleEditAllFuture = () => {
        setShowEditModal(false);
        // Navigate to edit screen for all future occurrences
        navigation.navigate('CreateBudget', { budget, editMode: 'all_future' });
    };

    const getNextMonth = () => {
        const now = new Date();
        now.setMonth(now.getMonth() + 1);
        return now.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleStopBudget = () => {
        setShowOptionsModal(false);
        Alert.alert(
            'Stop Budget',
            `Are you sure you want to stop tracking this budget? It will not be available from ${getNextMonth()}.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Stop',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.put(`/budgets/${budget.id}`, { ...budget, is_active: 0 });
                            Alert.alert('Success', 'Budget stopped!', [
                                { text: 'OK', onPress: () => navigation.navigate('Budget') }
                            ]);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to stop budget');
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteBudget = () => {
        setShowOptionsModal(false);
        Alert.alert(
            'Delete Budget',
            'Are you sure you want to permanently delete this budget? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/budgets/${budget.id}`);
                            Alert.alert('Success', 'Budget deleted!', [
                                { text: 'OK', onPress: () => navigation.navigate('Budget') }
                            ]);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete budget');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <ArrowLeft size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Budget</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setShowEditModal(true)}>
                        <Pencil size={20} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setShowOptionsModal(true)}>
                        <MoreVertical size={20} color="#0F172A" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {/* Month Selector */}
                <View style={styles.monthRow}>
                    <TouchableOpacity onPress={handlePrevMonth}>
                        <ChevronLeft size={24} color="#64748B" />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>{formatMonth(currentDate)}</Text>
                    <TouchableOpacity onPress={handleNextMonth}>
                        <ChevronRight size={24} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* Budget Icon and Name */}
                <View style={styles.budgetHero}>
                    <View style={styles.iconCircle}>
                        <Icon size={32} color="#3B82F6" />
                    </View>
                    <Text style={styles.budgetName}>{budget.name}</Text>
                </View>

                {/* Progress Section */}
                <View style={styles.progressSection}>
                    <Text style={styles.percentLabel}>{percent.toFixed(1)}%</Text>
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, {
                            width: `${Math.min(percent, 100)}%`,
                            backgroundColor: isOver ? '#EF4444' : '#3B82F6'
                        }]}>
                            <Text style={styles.progressText}>Spent ${spent.toFixed(0)} of ${limit.toFixed(0)}</Text>
                        </View>
                    </View>
                    <Text style={styles.todayLabel}>Today</Text>
                </View>

                {/* Over Budget Card */}
                {isOver && (
                    <View style={styles.overCard}>
                        <View>
                            <Text style={styles.overAmount}>${overAmount.toFixed(0)}</Text>
                            <Text style={styles.overLabel}>Over</Text>
                        </View>
                        <TouchableOpacity>
                            <Text style={styles.addAmountBtn}>ADD AMOUNT &gt;</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Under Budget Card */}
                {!isOver && remaining > 0 && (
                    <View style={[styles.overCard, { backgroundColor: '#DCFCE7' }]}>
                        <View>
                            <Text style={[styles.overAmount, { color: '#16A34A' }]}>${remaining.toFixed(0)}</Text>
                            <Text style={[styles.overLabel, { color: '#16A34A' }]}>Remaining</Text>
                        </View>
                    </View>
                )}

                {/* Details */}
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Budget</Text>
                    <TouchableOpacity style={styles.detailValue}>
                        <Text style={styles.detailAmount}>${limit.toFixed(0)}</Text>
                        <ChevronRight size={16} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Expenses</Text>
                    <TouchableOpacity style={styles.detailValue} onPress={() => setShowExpensesModal(true)}>
                        <Text style={styles.detailAmount}>${spent.toFixed(0)}</Text>
                        <ChevronRight size={16} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                {/* Timestamps */}
                <View style={styles.timestamps}>
                    <Text style={styles.timestampText}>Created On {formatDate(budget.created_at)}</Text>
                    <Text style={styles.timestampText}>Last updated {formatDate(budget.updated_at)}</Text>
                </View>
            </ScrollView>

            {/* Edit Options Modal */}
            <Modal
                visible={showEditModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.editModalOverlay}>
                    <View style={styles.editModalContent}>
                        <View style={styles.editModalHeader}>
                            <Text style={styles.editModalTitle}>
                                Edit all occurrences of this repeat entry, or this occurrence only?
                            </Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.editOption} onPress={handleEditThisOnly}>
                            <Text style={styles.editOptionTitle}>This only</Text>
                            <Text style={styles.editOptionSubtitle}>Edit {formatMonth(currentDate)} 1 occurrence only</Text>
                        </TouchableOpacity>

                        <View style={styles.editOptionDivider} />

                        <TouchableOpacity style={styles.editOption} onPress={handleEditAllFuture}>
                            <Text style={styles.editOptionTitle}>This & All future</Text>
                            <Text style={styles.editOptionSubtitle}>Edit {formatMonth(currentDate)} 1 and all occurrences after this</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Options Modal */}
            <Modal
                visible={showOptionsModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowOptionsModal(false)}
            >
                <View style={styles.editModalOverlay}>
                    <View style={styles.optionsModalContent}>
                        <View style={styles.optionsModalHeader}>
                            <Text style={styles.optionsModalTitle}>Options</Text>
                            <TouchableOpacity onPress={() => setShowOptionsModal(false)}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Stop Budget Button */}
                        <TouchableOpacity style={styles.stopBudgetBtn} onPress={handleStopBudget}>
                            <Text style={styles.stopBudgetText}>Stop Budget</Text>
                        </TouchableOpacity>
                        <View style={styles.optionHint}>
                            <AlertCircle size={14} color="#94A3B8" />
                            <Text style={styles.optionHintText}>This budget will not be available to track from {getNextMonth()}</Text>
                        </View>

                        {/* Delete Budget Button */}
                        <TouchableOpacity style={styles.deleteBudgetBtn} onPress={handleDeleteBudget}>
                            <Text style={styles.deleteBudgetText}>Delete Budget</Text>
                        </TouchableOpacity>
                        <View style={styles.optionHint}>
                            <AlertCircle size={14} color="#94A3B8" />
                            <Text style={styles.optionHintText}>This budget will be deleted permanently.</Text>
                        </View>

                        {/* Alert Toggles */}
                        <View style={styles.alertToggleRow}>
                            <Text style={styles.alertLabel}>Overspending alert</Text>
                            <Switch
                                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
                                thumbColor="#FFF"
                                onValueChange={setOverspendingAlert}
                                value={overspendingAlert}
                            />
                        </View>

                        <View style={styles.alertToggleRow}>
                            <Text style={styles.alertLabel}>Spending alert</Text>
                            <Switch
                                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
                                thumbColor="#FFF"
                                onValueChange={setSpendingAlert}
                                value={spendingAlert}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Transactions Modal */}
            <BudgetTransactionsModal
                visible={showExpensesModal}
                onClose={() => setShowExpensesModal(false)}
                transactions={budget.transactions || []}
                budgetName={budget.name}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F9FF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F0F9FF',
    },
    headerBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    monthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 40,
        paddingVertical: 16,
    },
    monthText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    budgetHero: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    budgetName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    progressSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    percentLabel: {
        textAlign: 'right',
        fontSize: 14,
        color: '#64748B',
        marginBottom: 4,
    },
    progressBarContainer: {
        height: 32,
        backgroundColor: '#E2E8F0',
        borderRadius: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 16,
        justifyContent: 'center',
        paddingHorizontal: 12,
        minWidth: 120,
    },
    progressText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    todayLabel: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 8,
    },
    overCard: {
        backgroundColor: '#FEE2E2',
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    overAmount: {
        fontSize: 24,
        fontWeight: '700',
        color: '#EF4444',
    },
    overLabel: {
        fontSize: 14,
        color: '#EF4444',
    },
    addAmountBtn: {
        color: '#EF4444',
        fontWeight: '600',
        fontSize: 14,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFF',
    },
    detailLabel: {
        fontSize: 16,
        color: '#0F172A',
    },
    detailValue: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        marginRight: 4,
    },
    timestamps: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    timestampText: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 4,
    },
    // Edit Modal Styles
    editModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    editModalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
    editModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    editModalTitle: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
        lineHeight: 24,
        marginRight: 16,
    },
    editOption: {
        paddingVertical: 16,
    },
    editOptionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 4,
    },
    editOptionSubtitle: {
        fontSize: 14,
        color: '#64748B',
    },
    editOptionDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    // Options Modal Styles
    optionsModalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
    optionsModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    optionsModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    stopBudgetBtn: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 8,
    },
    stopBudgetText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    deleteBudgetBtn: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 8,
    },
    deleteBudgetText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    optionHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    optionHintText: {
        fontSize: 12,
        color: '#94A3B8',
        flex: 1,
    },
    alertToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    alertLabel: {
        fontSize: 16,
        color: '#0F172A',
    },
});

export default BudgetDetails;
