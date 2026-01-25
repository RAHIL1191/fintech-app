import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Plus, AlignJustify, ChevronLeft, ChevronRight, X, AlertCircle, Check } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import api from '../config/api';
import { NotificationService } from '../services/NotificationService';

const { width } = Dimensions.get('window');

const Budget = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState('BUDGETS'); // BUDGETS | GOALS
    const [typeFilter, setTypeFilter] = useState('Expenses'); // Expenses | Income
    const [currentDate, setCurrentDate] = useState(new Date());
    const [budgets, setBudgets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [selectedBudgetIds, setSelectedBudgetIds] = useState(new Set());
    const isFocused = useIsFocused();

    useEffect(() => {
        // Initialize notifications permission on mount
        NotificationService.registerForPushNotificationsAsync();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            fetchBudgets();
        }, [currentDate])
    );

    const handlePrevMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() - 1);
            return newDate;
        });
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + 1);
            return newDate;
        });
    };

    const fetchBudgets = async () => {
        try {
            setLoading(true);
            const month = currentDate.getMonth() + 1; // 1-12
            const year = currentDate.getFullYear();

            const response = await api.get(`/budgets/summary?month=${month}&year=${year}&t=${new Date().getTime()}`);

            let fetchedBudgets = response.data || [];

            // Robust Frontend Deduplication: Prefer 'One Time' (Exception) over 'Monthly' (Recurring)
            const budgetMap = new Map();
            fetchedBudgets.forEach(b => {
                if (!budgetMap.has(b.name)) {
                    budgetMap.set(b.name, b);
                } else {
                    const existing = budgetMap.get(b.name);
                    const currentIsException = b.recurrence_frequency === 'One Time';
                    const existingIsException = existing.recurrence_frequency === 'One Time';

                    if (currentIsException && !existingIsException) {
                        budgetMap.set(b.name, b);
                    } else if (currentIsException && existingIsException) {
                        // Prefer newer ID if both are exceptions (heuristic)
                        if (b.id > existing.id) budgetMap.set(b.name, b);
                    }
                    // If existing is Exception and current is not, keep existing.
                }
            });
            fetchedBudgets = Array.from(budgetMap.values());

            setBudgets(fetchedBudgets);

            // Trigger alerts check only if we are viewing the CURRENT month
            const now = new Date();
            if (month === now.getMonth() + 1 && year === now.getFullYear()) {
                NotificationService.checkBudgetAlerts(fetchedBudgets);
            }

            // Auto-select all budgets by default on first load
            if (selectedBudgetIds.size === 0 && fetchedBudgets.length > 0) {
                setSelectedBudgetIds(new Set(fetchedBudgets.map(b => b.id)));
            }
        } catch (error) {
            console.error('Failed to fetch budgets:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleBudgetSelection = (budgetId) => {
        setSelectedBudgetIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(budgetId)) {
                newSet.delete(budgetId);
            } else {
                newSet.add(budgetId);
            }
            return newSet;
        });
    };

    // Calculate overall totals from SELECTED budgets only
    const selectedBudgets = budgets.filter(b => selectedBudgetIds.has(b.id));
    const overallSpent = selectedBudgets.reduce((sum, b) => sum + (b.spent || 0), 0);
    const overallLimit = selectedBudgets.reduce((sum, b) => sum + (b.limit || b.amount || 0), 0);

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.openDrawer()}>
                <Menu size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Budget</Text>
            <View style={styles.headerRight}>
                <TouchableOpacity style={styles.iconBtn}>
                    <AlignJustify size={24} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('CreateBudget')}>
                    <Plus size={24} color="#3B82F6" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderTabs = () => (
        <View style={styles.tabContainer}>
            <TouchableOpacity
                style={[styles.tabItem, activeTab === 'BUDGETS' && styles.activeTabItem]}
                onPress={() => setActiveTab('BUDGETS')}
            >
                <Text style={[styles.tabText, activeTab === 'BUDGETS' && styles.activeTabText]}>BUDGETS</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tabItem, activeTab === 'GOALS' && styles.activeTabItem]}
                onPress={() => setActiveTab('GOALS')}
            >
                <Text style={[styles.tabText, activeTab === 'GOALS' && styles.activeTabText]}>GOALS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderControls = () => (
        <View style={styles.controlsRow}>
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleBtn, typeFilter === 'Expenses' && styles.activeToggleBtn]}
                    onPress={() => setTypeFilter('Expenses')}
                >
                    <Text style={[styles.toggleText, typeFilter === 'Expenses' && styles.activeToggleText]}>Expenses</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, typeFilter === 'Income' && styles.activeToggleBtn]}
                    onPress={() => setTypeFilter('Income')}
                >
                    <Text style={[styles.toggleText, typeFilter === 'Income' && styles.activeToggleText]}>Income</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.monthSelector}>
                <TouchableOpacity onPress={handlePrevMonth}><ChevronLeft size={20} color="#64748B" /></TouchableOpacity>
                <Text style={styles.monthText}>
                    {currentDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={handleNextMonth}><ChevronRight size={20} color="#64748B" /></TouchableOpacity>
            </View>
        </View>
    );

    const renderOverallProgress = () => {
        return (
            <TouchableOpacity style={styles.card} onPress={() => setShowProgressModal(true)} activeOpacity={0.7}>
                <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.cardTitle}>Overall Progress</Text>
                        <AlertCircle size={16} color="#94A3B8" style={{ marginLeft: 6 }} />
                    </View>
                    <Text style={styles.cardAmount}>${(overallLimit - overallSpent).toFixed(0)}</Text>
                </View>

                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                        <View style={[styles.progressBarFill, {
                            width: overallLimit > 0 ? `${Math.min((overallSpent / overallLimit) * 100, 100)}%` : '0%',
                            backgroundColor: overallSpent > overallLimit ? '#DC2626' : '#E2E8F0'
                        }]} />
                    </View>
                    <View style={styles.progressTextOverlay}>
                        <Text style={styles.progressTextInner}>Spent ${overallSpent.toFixed(0)} of ${overallLimit.toFixed(0)}</Text>
                    </View>
                </View>
                <Text style={styles.helperText}>Tap to select budgets to include in overall progress.</Text>
            </TouchableOpacity>
        );
    };

    const renderProgressModal = () => {
        return (
            <Modal
                visible={showProgressModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowProgressModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.modalTitle}>Overall Progress</Text>
                                <AlertCircle size={16} color="#3B82F6" style={{ marginLeft: 6 }} />
                            </View>
                            <TouchableOpacity onPress={() => setShowProgressModal(false)}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>Select budgets to include in overall progress.</Text>

                        <ScrollView style={{ maxHeight: 400 }}>
                            {budgets.map((budget) => {
                                const isSelected = selectedBudgetIds.has(budget.id);
                                const percent = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;
                                const isOver = budget.spent > budget.limit;
                                const remaining = budget.limit - budget.spent;
                                const Icon = LucideIcons[budget.icon] || LucideIcons.DollarSign;

                                return (
                                    <View key={budget.id} style={styles.modalBudgetItem}>
                                        <View style={styles.modalBudgetHeader}>
                                            <View style={styles.budgetLeft}>
                                                <View style={styles.iconCircle}>
                                                    <Icon size={24} color="#3B82F6" />
                                                </View>
                                                <Text style={styles.budgetName}>{budget.name}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={styles.budgetRemaining}>
                                                    {remaining < 0 ? `- $${Math.abs(remaining).toFixed(0)}` : `$${remaining.toFixed(0)}`}
                                                </Text>
                                                <TouchableOpacity
                                                    style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                                                    onPress={() => toggleBudgetSelection(budget.id)}
                                                >
                                                    {isSelected && <Check size={16} color="#FFF" />}
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <View style={[styles.itemProgressContainer, { marginTop: 8 }]}>
                                            <View style={[styles.itemProgressBar, {
                                                backgroundColor: isOver ? '#EF4444' : '#3B82F6',
                                                width: '100%',
                                            }]}>
                                                <Text style={styles.itemProgressText}>Spent ${budget.spent?.toFixed(0) || 0} of ${budget.limit?.toFixed(0) || 0}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.budgetFooter}>
                                            <Text style={styles.percentText}>{percent.toFixed(1)}%</Text>
                                            <Text style={styles.periodText}>{budget.period || currentDate.toLocaleString('en-US', { month: 'short' })}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderBudgetItem = (item) => {
        const percent = (item.spent / item.limit) * 100;
        const isOver = item.spent > item.limit;
        const remaining = item.limit - item.spent;

        const Icon = LucideIcons[item.icon] || LucideIcons.DollarSign;

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.budgetItem}
                onPress={() => navigation.navigate('BudgetDetails', {
                    budget: item,
                    initialDate: currentDate.toISOString()
                })}
                activeOpacity={0.7}
            >
                <View style={styles.budgetHeader}>
                    <View style={styles.budgetLeft}>
                        <View style={styles.iconCircle}>
                            <Icon size={24} color="#3B82F6" />
                        </View>
                        <Text style={styles.budgetName}>{item.name}</Text>
                    </View>
                    <Text style={styles.budgetRemaining}>
                        {remaining < 0 ? `- $${Math.abs(remaining).toFixed(0)}` : `$${remaining.toFixed(0)}`}
                    </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.itemProgressContainer}>
                    <View style={[styles.itemProgressBar, {
                        backgroundColor: isOver ? '#EF4444' : '#3B82F6',
                        width: '100%', // Fix logic: width should be 100%, visual fill inside? 
                        // The component in picture looks like a solid bar with text INSIDE
                    }]}>
                        <Text style={styles.itemProgressText}>Spent ${item.spent.toFixed(0)} of ${item.limit.toFixed(0)}</Text>
                    </View>
                </View>

                <View style={styles.budgetFooter}>
                    <Text style={styles.percentText}>{percent.toFixed(1)}%</Text>
                    <Text style={styles.periodText}>{item.period}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={{ backgroundColor: '#fff' }}>
                {renderHeader()}
                {renderTabs()}
            </View>

            <ScrollView style={styles.scrollView}>
                {renderControls()}

                <View style={styles.contentPadding}>
                    {renderOverallProgress()}

                    {loading ? (
                        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
                    ) : budgets.length === 0 ? (
                        <View style={{ alignItems: 'center', marginTop: 40 }}>
                            <Text style={{ fontSize: 16, color: '#64748B', marginBottom: 8 }}>No budgets yet</Text>
                            <TouchableOpacity
                                style={{ backgroundColor: '#3B82F6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                                onPress={() => navigation.navigate('CreateBudget')}
                            >
                                <Text style={{ color: '#FFF', fontWeight: '600' }}>Create Your First Budget</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        budgets.map(renderBudgetItem)
                    )}
                </View>
            </ScrollView>

            {renderProgressModal()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FE' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    headerTitle: { fontSize: 20, fontWeight: '600', color: '#0F172A' },
    headerRight: { flexDirection: 'row', gap: 12 },
    iconBtn: { padding: 4 },

    // Tabs
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    tabItem: {
        paddingVertical: 12,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTabItem: {
        borderBottomColor: '#3B82F6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    activeTabText: {
        color: '#0F172A',
    },

    scrollView: { flex: 1 },
    contentPadding: { padding: 16 },

    // Controls
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0', // Slightly darker bg for toggle track? 
        // Based on pic, it looks like simple text or light pill?
        // Let's use light blue pill style
        backgroundColor: '#EFF6FF',
        borderRadius: 20,
        padding: 4,
    },
    toggleBtn: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 16,
    },
    activeToggleBtn: {
        backgroundColor: '#BFDBFE', // Light blue selection
        // Actually picture has "Expenses" selected with blue background
        backgroundColor: '#DBEAFE',
    },
    toggleText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    activeToggleText: { color: '#1E40AF', fontWeight: '600' },

    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    monthText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

    // Overall Card
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
    cardAmount: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    progressBarContainer: {
        height: 24,
        backgroundColor: '#F1F5F9', // Light gray background
        borderRadius: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        marginBottom: 8,
    },
    progressBarBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#E2E8F0',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 12, // Match container
    },
    progressTextOverlay: {
        position: 'absolute',
        width: '100%',
        paddingLeft: 12,
    },
    progressTextInner: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569', // Dark text on light bar?
        // If bar is red, text might need to be white?
        // In picture, "Spent $0 of $0" is inside a gray bar.
    },
    helperText: { fontSize: 12, color: '#94A3B8' },

    // Budget Item
    budgetItem: {
        marginBottom: 16,
    },
    budgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    budgetName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
    budgetRemaining: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

    itemProgressContainer: {
        height: 28,
        backgroundColor: '#E2E8F0', // Fallback
        borderRadius: 14,
        marginBottom: 4,
        overflow: 'hidden',
    },
    itemProgressBar: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 12,
        borderRadius: 14,
    },
    itemProgressText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    budgetFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    percentText: { fontSize: 12, color: '#64748B' },
    periodText: { fontSize: 12, color: '#64748B' },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: '#F8F9FE',
    },
    modalContent: {
        flex: 1,
        backgroundColor: '#FFF',
        paddingTop: 50,
        paddingHorizontal: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#3B82F6',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 16,
    },
    modalBudgetItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalBudgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        marginLeft: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },

});

export default Budget;
