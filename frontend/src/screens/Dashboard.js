import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronRight, Wallet, CreditCard, AlertCircle, Bell } from 'lucide-react-native';
import api from '../config/api';
import AlertsModal from '../components/AlertsModal';
import { getCategoryIcon, getCategoryColor } from '../constants/CategoryTaxonomy';
import * as LucideIcons from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Helper: Get Greeting based on time
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
};

const Dashboard = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Widget Data States
    const [accounts, setAccounts] = useState([]);
    const [billsSummary, setBillsSummary] = useState({ upcoming: 0, overdue: 0, paid: 0 });
    const [topExpenses, setTopExpenses] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [cashFlow, setCashFlow] = useState({ income: 0, expenses: 0, net: 0 });
    const [prevMonthExpenses, setPrevMonthExpenses] = useState(0);
    const [currentMonthExpensesTotal, setCurrentMonthExpensesTotal] = useState(0);

    // Notifications State
    const [notifications, setNotifications] = useState([]);
    const [isAlertsVisible, setIsAlertsVisible] = useState(false);
    const unreadCount = notifications.filter(n => !n.read).length;

    const fetchDashboardData = async () => {
        try {
            // Fetch Accounts
            const accRes = await api.get('/accounts');
            setAccounts(accRes.data.accounts || []);

            // Fetch Bills Summary (from /upcoming)
            const billsRes = await api.get('/bills/upcoming');
            const now = new Date();
            const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            // Filter to current month only
            const rawBills = (billsRes.data.grouped || []).flatMap(g => g.bills);
            const allBills = rawBills.filter(b => b.dueDate && b.dueDate.startsWith(thisMonthStr));

            const upcoming = allBills.filter(b => !b.isPastDue && !b.isToday).reduce((s, b) => s + b.amount, 0);
            const overdue = allBills.filter(b => b.isPastDue).reduce((s, b) => s + b.amount, 0);
            // Fetch Paid for current month
            const paidRes = await api.get('/bills/paid');
            const currentMonthKey = now.toLocaleString('default', { month: 'long' });
            const paidGroup = (paidRes.data.grouped || []).find(g => g.month && g.month.startsWith(currentMonthKey));
            const paid = paidGroup ? paidGroup.total : 0;
            setBillsSummary({ upcoming, overdue, paid });

            // Fetch Top Expenses (from Insights logic - category breakdown)
            const txRes = await api.get('/transactions');
            const transactions = txRes.data.transactions || [];
            // Filter to current month expenses
            const monthlyExpenses = transactions.filter(t => t.date && t.date.startsWith(thisMonthStr) && t.amount > 0 && !t.is_transfer);
            const currentTotal = monthlyExpenses.reduce((s, t) => s + t.amount, 0);
            setCurrentMonthExpensesTotal(currentTotal);

            // Calculate previous month expenses (full month)
            const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
            const prevMonthExpensesTxs = transactions.filter(t =>
                t.date && t.date.startsWith(prevMonthStr) && t.amount > 0 && !t.is_transfer
            );
            const prevTotal = prevMonthExpensesTxs.reduce((s, t) => s + t.amount, 0);
            setPrevMonthExpenses(prevTotal);

            // Group by Category
            const catMap = {};
            monthlyExpenses.forEach(t => {
                const cat = t.personal_finance_category?.primary || t.category?.[0] || 'Other';
                if (!catMap[cat]) catMap[cat] = 0;
                catMap[cat] += t.amount;
            });
            const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
            setTopExpenses(sorted.map(([name, amount]) => ({ name, amount })));

            // Fetch Budgets
            const budgetRes = await api.get('/budgets/summary', { params: { month: now.getMonth() + 1, year: now.getFullYear() } });
            setBudgets(budgetRes.data || []);

            // Cash Flow
            const income = transactions.filter(t => t.date && t.date.startsWith(thisMonthStr) && t.amount < 0 && !t.is_transfer).reduce((s, t) => s + Math.abs(t.amount), 0);
            const expenses = monthlyExpenses.reduce((s, t) => s + t.amount, 0);
            setCashFlow({ income, expenses, net: income - expenses });

            // Fetch Notifications
            try {
                const notifRes = await api.get('/notifications');
                setNotifications(notifRes.data || []);
            } catch (e) { console.log('Notifications error:', e); }

        } catch (error) {
            console.error('Dashboard fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    // --- WIDGETS ---

    const renderAccountsWidget = () => {
        const cashAccounts = accounts.filter(a => a.type === 'depository');
        const creditAccounts = accounts.filter(a => a.type === 'credit');
        const cashTotal = cashAccounts.reduce((s, a) => s + (a.balances?.current || 0), 0);
        const creditTotal = creditAccounts.reduce((s, a) => s + (a.balances?.current || 0), 0);

        return (
            <TouchableOpacity style={styles.widgetCard} onPress={() => navigation.navigate('Accounts')}>
                <View style={styles.widgetHeader}>
                    <Text style={styles.widgetTitle}>Accounts</Text>
                    <ChevronRight size={20} color="#34D399" />
                </View>
                <View style={styles.accountsRow}>
                    <View style={styles.accountCol}>
                        <Text style={styles.accountLabel}>Cash</Text>
                        <View style={[styles.accountIconCircle, { backgroundColor: '#7C3AED20' }]}>
                            <Wallet size={24} color="#A78BFA" />
                        </View>
                        <Text style={styles.accountAmount}>${cashTotal.toLocaleString()}</Text>
                    </View>
                    <View style={styles.accountDivider} />
                    <View style={styles.accountCol}>
                        <Text style={styles.accountLabel}>Credit</Text>
                        <View style={[styles.accountIconCircle, { backgroundColor: '#6366F120' }]}>
                            <CreditCard size={24} color="#34D399" />
                        </View>
                        <Text style={styles.accountAmount}>${creditTotal.toLocaleString()}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderBillsWidget = () => (
        <TouchableOpacity style={styles.widgetCard} onPress={() => navigation.navigate('Bills')}>
            <View style={styles.widgetHeader}>
                <Text style={styles.widgetTitle}>Bills</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.widgetSubtitle}>{new Date().toLocaleString('default', { month: 'short' })}</Text>
                    <ChevronRight size={20} color="#34D399" />
                </View>
            </View>
            <View style={styles.billsRow}>
                <View style={styles.billStat}>
                    <View style={[styles.billDot, { backgroundColor: '#FBBF24' }]} />
                    <Text style={styles.billStatLabel}>Upcoming</Text>
                    <Text style={styles.billStatValue}>${billsSummary.upcoming.toFixed(0)}</Text>
                </View>
                <View style={styles.billStat}>
                    <View style={[styles.billDot, { backgroundColor: '#F87171' }]} />
                    <Text style={styles.billStatLabel}>Overdue</Text>
                    <Text style={styles.billStatValue}>${billsSummary.overdue.toFixed(0)}</Text>
                </View>
                <View style={styles.billStat}>
                    <View style={[styles.billDot, { backgroundColor: '#34D399' }]} />
                    <Text style={styles.billStatLabel}>Paid</Text>
                    <Text style={styles.billStatValue}>${billsSummary.paid.toFixed(0)}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderTopExpensesWidget = () => {
        const top3Total = topExpenses.reduce((s, e) => s + e.amount, 0);
        // Compare Total Monthly Spending (not just top 3)
        const diff = currentMonthExpensesTotal - prevMonthExpenses;
        const diffAbs = Math.abs(diff);
        const prevMonthName = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
            .toLocaleString('default', { month: 'short', year: 'numeric' });

        let comparisonText = '';
        let comparisonColor = '#64748B';
        let comparisonBg = 'transparent';
        if (prevMonthExpenses > 0) {
            if (diff < 0) {
                comparisonText = `You're spending $${diffAbs.toFixed(0)} less than ${prevMonthName}`;
                comparisonColor = '#34D399';
                comparisonBg = '#34D39915';
            } else if (diff > 0) {
                comparisonText = `You're spending $${diffAbs.toFixed(0)} more than ${prevMonthName}`;
                comparisonColor = '#FBBF24';
                comparisonBg = '#FBBF2415';
            } else {
                comparisonText = `Same spending as ${prevMonthName}`;
            }
        }

        return (
            <TouchableOpacity style={styles.widgetCard} onPress={() => navigation.navigate('Insights')}>
                <View style={styles.widgetHeader}>
                    <Text style={styles.widgetTitle}>Top Expenses <Text style={styles.widgetSubtitle}>| {new Date().toLocaleString('default', { month: 'short' })}</Text></Text>
                    <ChevronRight size={20} color="#34D399" />
                </View>
                <View style={styles.expensesRow}>
                    {topExpenses.map((exp, idx) => {
                        const iconName = getCategoryIcon(exp.name);
                        const IconComponent = LucideIcons[iconName] || LucideIcons.Tag;
                        const iconColor = getCategoryColor(exp.name);
                        return (
                            <View key={idx} style={styles.expenseItem}>
                                <View style={[styles.expenseIcon, { backgroundColor: iconColor + '20' }]}>
                                    <IconComponent size={18} color={iconColor} />
                                </View>
                                <Text style={styles.expenseName} numberOfLines={1}>{exp.name}</Text>
                                <Text style={styles.expenseAmount}>${exp.amount.toFixed(0)}</Text>
                            </View>
                        );
                    })}
                </View>
                {comparisonText ? (
                    <Text style={[styles.comparisonText, { color: comparisonColor, backgroundColor: comparisonBg }]}>{comparisonText}</Text>
                ) : null}
            </TouchableOpacity>
        );
    };

    const renderBudgetWidget = () => {
        const currentMonth = new Date().toLocaleString('default', { month: 'short' });
        return (
            <TouchableOpacity style={styles.widgetCard} onPress={() => navigation.navigate('Budget')}>
                <View style={styles.widgetHeader}>
                    <Text style={styles.widgetTitle}>Budget</Text>
                    <ChevronRight size={20} color="#34D399" />
                </View>
                {budgets.length === 0 ? (
                    <Text style={styles.emptyText}>No budgets for this month.</Text>
                ) : (
                    budgets.slice(0, 2).map(b => {
                        const spent = b.spent || 0;
                        const limit = b.amount || 0;
                        const percent = limit > 0 ? (spent / limit) * 100 : 0;
                        const isOver = spent > limit;
                        return (
                            <View key={b.id} style={styles.budgetItem}>
                                {/* Header Row: Icon + Name + Limit Amount */}
                                <View style={styles.budgetHeaderRow}>
                                    <View style={styles.budgetIconCircle}>
                                        <Text style={styles.budgetIconText}>$</Text>
                                    </View>
                                    <Text style={styles.budgetName}>{b.name}</Text>
                                    <Text style={styles.budgetLimitAmount}>${limit.toFixed(0)}</Text>
                                </View>

                                {/* Progress Bar with Text Overlay */}
                                <View style={styles.budgetBarContainer}>
                                    <View style={styles.budgetBarBg}>
                                        <View style={[
                                            styles.budgetBar,
                                            {
                                                width: `${Math.min(percent, 100)}%`,
                                                backgroundColor: isOver ? '#EF4444' : '#34D399'
                                            }
                                        ]}>
                                            <Text style={styles.budgetBarText}>
                                                Spent ${spent.toFixed(0)} of ${limit.toFixed(0)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Footer Row: Percentage + Month */}
                                <View style={styles.budgetFooterRow}>
                                    <Text style={[styles.budgetPercent, isOver && { color: '#EF4444' }]}>
                                        {percent.toFixed(1)}%
                                    </Text>
                                    <Text style={styles.budgetMonth}>{currentMonth}</Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </TouchableOpacity>
        );
    };

    const renderCashFlowWidget = () => {
        const netIsPositive = cashFlow.net >= 0;
        return (
            <TouchableOpacity style={styles.widgetCard} onPress={() => navigation.navigate('Insights')}>
                <View style={styles.widgetHeader}>
                    <Text style={styles.widgetTitle}>Cash Flow</Text>
                    <ChevronRight size={20} color="#34D399" />
                </View>
                <View style={styles.cashFlowRow}>
                    <Text style={styles.cashFlowMonth}>{new Date().toLocaleString('default', { month: 'long' })}</Text>
                    <Text style={[styles.cashFlowNet, netIsPositive ? styles.positive : styles.negative]}>
                        {netIsPositive ? '+' : '-'}${Math.abs(cashFlow.net).toFixed(0)}
                    </Text>
                </View>
                <View style={styles.cashFlowBars}>
                    <View style={[styles.cashFlowBar, { backgroundColor: '#34D399', flex: cashFlow.income || 1 }]} />
                    <View style={[styles.cashFlowBar, { backgroundColor: '#FB923C', flex: cashFlow.expenses || 1 }]} />
                </View>
                <Text style={styles.projectedText}>Projected Balance of {netIsPositive ? '' : '-'}${Math.abs(cashFlow.net).toFixed(0)}</Text>
            </TouchableOpacity>
        );
    };



    const renderAlertsWidget = () => {
        if (unreadCount === 0) return null;

        return (
            <TouchableOpacity
                style={[styles.widgetCard, styles.alertWidget]}
                onPress={() => setIsAlertsVisible(true)}
            >
                <View style={styles.alertContent}>
                    <View style={styles.alertIconBadge}>
                        <Bell size={20} color="#fff" />
                        <View style={styles.redDot} />
                    </View>
                    <View style={styles.alertTextContainer}>
                        <Text style={styles.alertTitle}>New Alerts</Text>
                        <Text style={styles.alertSubtitle}>You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</Text>
                    </View>
                </View>
                <ChevronRight size={20} color="#D4D4D8" />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#34D399" style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{getGreeting()},</Text>
                        <Text style={styles.userName}>Rahil</Text>
                    </View>
                    <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('SearchScreen')}>
                        <Search size={22} color="#34D399" />
                    </TouchableOpacity>
                </View>

                {/* Widgets */}
                {renderAlertsWidget()}
                {renderAccountsWidget()}
                {renderBillsWidget()}
                {renderTopExpensesWidget()}
                {renderBudgetWidget()}
                {renderCashFlowWidget()}

                <View style={{ height: 80 }} />
            </ScrollView>

            <AlertsModal
                visible={isAlertsVisible}
                onClose={() => setIsAlertsVisible(false)}
                notifications={notifications}
                onRefresh={fetchDashboardData}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B1120',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 80,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingTop: 4,
    },
    greeting: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    userName: {
        fontSize: 28,
        fontWeight: '800',
        color: '#F1F5F9',
        letterSpacing: -0.5,
    },
    searchBtn: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    widgetCard: {
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    widgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    widgetTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#F1F5F9',
        letterSpacing: -0.2,
    },
    widgetSubtitle: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    // Accounts
    accountsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accountCol: {
        flex: 1,
        alignItems: 'center',
    },
    accountDivider: {
        width: 1,
        height: 64,
        backgroundColor: '#1E293B',
    },
    accountLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 8,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    accountIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    accountAmount: {
        fontSize: 20,
        fontWeight: '800',
        color: '#F1F5F9',
    },
    // Bills
    billsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    billStat: {
        alignItems: 'center',
    },
    billDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginBottom: 6,
    },
    billStatLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    billStatValue: {
        fontSize: 17,
        fontWeight: '800',
        color: '#F1F5F9',
        marginTop: 2,
    },
    // Top Expenses
    expensesRow: {
        marginBottom: 8,
    },
    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    expenseIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    expenseName: {
        flex: 1,
        fontSize: 14,
        color: '#E2E8F0',
        fontWeight: '500',
    },
    expenseAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#F1F5F9',
    },
    totalText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#F1F5F9',
        marginTop: 4,
    },
    comparisonText: {
        fontSize: 12,
        marginTop: 8,
        fontWeight: '600',
        textAlign: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        overflow: 'hidden',
    },
    // Budget
    budgetItem: {
        marginBottom: 16,
    },
    budgetHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    budgetIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#34D39920',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    budgetIconText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#34D399',
    },
    budgetName: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#E2E8F0',
    },
    budgetLimitAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#F1F5F9',
    },
    budgetBarContainer: {
        marginBottom: 4,
    },
    budgetBarBg: {
        height: 26,
        backgroundColor: '#1E293B',
        borderRadius: 8,
        overflow: 'hidden',
    },
    budgetBar: {
        height: '100%',
        borderRadius: 8,
        justifyContent: 'center',
        paddingHorizontal: 10,
        minWidth: 100,
    },
    budgetBarText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFF',
    },
    budgetFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 2,
    },
    budgetPercent: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    budgetMonth: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    emptyText: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        paddingVertical: 10,
    },
    // Cash Flow
    cashFlowRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    cashFlowMonth: {
        fontSize: 15,
        color: '#E2E8F0',
        fontWeight: '600',
    },
    cashFlowNet: {
        fontSize: 18,
        fontWeight: '800',
    },
    positive: {
        color: '#34D399',
    },
    negative: {
        color: '#F87171',
    },
    cashFlowBars: {
        flexDirection: 'row',
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 10,
        gap: 2,
    },
    cashFlowBar: {
        height: '100%',
        borderRadius: 5,
    },
    projectedText: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        fontWeight: '500',
    },
    // Alert Widget
    alertWidget: {
        backgroundColor: '#450a0a',
        borderColor: '#7f1d1d',
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    alertContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    alertIconBadge: {
        backgroundColor: '#ef4444',
        padding: 10,
        borderRadius: 22,
        position: 'relative',
    },
    redDot: {
        position: 'absolute',
        top: -1,
        right: -1,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#ef4444',
    },
    alertTextContainer: {
        justifyContent: 'center',
    },
    alertTitle: {
        color: '#fca5a5',
        fontWeight: 'bold',
        fontSize: 15,
    },
    alertSubtitle: {
        color: '#fecaca',
        fontSize: 12,
    },
});

export default Dashboard;
