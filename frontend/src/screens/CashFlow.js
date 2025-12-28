import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Calendar, Settings, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const CashFlow = ({ route, navigation }) => {
    const { transactions = [], initialMonthIdx = 2, year = 2025 } = route.params || {};
    const [selectedMonthIdx, setSelectedMonthIdx] = useState(initialMonthIdx);

    const [transactionFilter, setTransactionFilter] = useState('Expenses'); // Expenses | Income

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // --- DATA CALCULATIONS ---
    const monthlyStats = useMemo(() => {
        const stats = months.map((name, idx) => {
            const filtered = transactions.filter(t => {
                const d = new Date(t.date + 'T12:00:00');
                // Exclude transfers
                if (t.is_transfer) return false;
                return d.getMonth() === idx && d.getFullYear() === year;
            });

            const income = filtered.reduce((sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0), 0);
            const expenses = filtered.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);
            const balance = income - expenses;

            return {
                name,
                income,
                expenses,
                balance,
                transactionCount: filtered.length,
                transactions: filtered
            };
        });

        const maxAbsBalance = Math.max(...stats.map(s => Math.abs(s.balance)), 1);
        return { stats, maxAbsBalance };
    }, [transactions, year]);

    const currentMonthData = monthlyStats.stats[selectedMonthIdx];

    const filteredTransactions = useMemo(() => {
        return currentMonthData.transactions.filter(t => {
            if (transactionFilter === 'Expenses') return t.amount > 0;
            return t.amount < 0;
        });
    }, [currentMonthData, transactionFilter]);

    const changeMonth = (delta) => {
        const newIdx = (selectedMonthIdx + delta + 12) % 12;
        setSelectedMonthIdx(newIdx);
    };

    const savingsRate = currentMonthData.income > 0
        ? (currentMonthData.balance / currentMonthData.income) * 100
        : 0;
    const barWidth = Math.max(2, Math.min(Math.abs(savingsRate), 100));

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ChevronLeft size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cash Flow</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerIcon}>
                        <Calendar size={24} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerIcon}>
                        <Settings size={24} color="#3B82F6" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Month Selector */}
                <View style={styles.monthSelector}>
                    <TouchableOpacity onPress={() => changeMonth(-1)}>
                        <ChevronLeft size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={styles.monthTitle}>{months[selectedMonthIdx]}</Text>
                        <Text style={styles.monthSubtitle}>Monthly</Text>
                    </View>
                    <TouchableOpacity onPress={() => changeMonth(1)}>
                        <ChevronRight size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Chart Section */}
                <View style={styles.chartContainer}>
                    <View style={styles.chart}>
                        {monthlyStats.stats.map((s, idx) => {
                            const isSelected = idx === selectedMonthIdx;
                            const barHeight = (Math.abs(s.balance) / monthlyStats.maxAbsBalance) * 100;
                            return (
                                <View key={idx} style={styles.barWrapper}>
                                    {isSelected && (
                                        <View style={styles.tooltip}>
                                            <Text style={styles.tooltipText}>
                                                {s.balance >= 0 ? '+' : '-'}${Math.abs(s.balance).toFixed(0)}
                                            </Text>
                                        </View>
                                    )}
                                    <View
                                        style={[
                                            styles.bar,
                                            {
                                                height: Math.max(barHeight, 5),
                                                backgroundColor: isSelected ? (s.balance >= 0 ? '#10B981' : '#F59E0B') : '#1E293B'
                                            }
                                        ]}
                                    />
                                    <Text style={[styles.barLabel, isSelected && styles.barLabelActive]}>
                                        {monthAbbr[idx].substring(0, 2)}{'\n'}{monthAbbr[idx].charAt(2)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Projected Banner */}
                <TouchableOpacity style={styles.projectedBtn}>
                    <Text style={styles.projectedText}>Projected</Text>
                </TouchableOpacity>

                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <Text style={styles.summaryMonth}>{months[selectedMonthIdx]}</Text>
                        <Text style={styles.summaryPercent}>{Math.abs(savingsRate).toFixed(1)}%</Text>
                        <Text style={[styles.summaryAmount, { color: currentMonthData.balance >= 0 ? '#10B981' : '#F59E0B' }]}>
                            {currentMonthData.balance >= 0 ? '+' : '-'}${Math.abs(currentMonthData.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                        <View
                            style={[
                                styles.progressBar,
                                {
                                    width: `${barWidth}%`,
                                    backgroundColor: currentMonthData.balance >= 0 ? '#10B981' : '#F59E0B'
                                }
                            ]}
                        />
                    </View>
                    <Text style={[styles.balanceLabel, { color: currentMonthData.balance >= 0 ? '#10B981' : '#F59E0B' }]}>
                        Balance {currentMonthData.balance >= 0 ? '+' : '-'}${Math.abs(currentMonthData.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                </View>

                {/* Stats Card */}
                <View style={styles.statsCard}>
                    <View style={styles.statRow}>
                        <View style={[styles.statIcon, { backgroundColor: '#064E3B' }]}>
                            <TrendingUp size={20} color="#10B981" />
                        </View>
                        <Text style={styles.statLabel}>Total Income</Text>
                        <Text style={[styles.statValue, { color: '#10B981' }]}>
                            +${currentMonthData.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>

                    <View style={styles.statRow}>
                        <View style={[styles.statIcon, { backgroundColor: '#451A03' }]}>
                            <TrendingDown size={20} color="#EF4444" />
                        </View>
                        <Text style={styles.statLabel}>Total Expense</Text>
                        <Text style={[styles.statValue, { color: '#EF4444' }]}>
                            -${currentMonthData.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.statRow}>
                        <View style={{ width: 40 }} />
                        <Text style={styles.statLabel}>Balance</Text>
                        <Text style={[styles.statValue, { color: currentMonthData.balance >= 0 ? '#10B981' : '#F59E0B' }]}>
                            {currentMonthData.balance >= 0 ? '+' : '-'}${Math.abs(currentMonthData.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                </View>

                {/* Transactions Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabBtn, transactionFilter === 'Expenses' && styles.activeTabBtn]}
                        onPress={() => setTransactionFilter('Expenses')}
                    >
                        <Text style={[styles.tabText, transactionFilter === 'Expenses' && styles.activeTabText]}>
                            Expenses
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabBtn, transactionFilter === 'Income' && styles.activeTabBtn]}
                        onPress={() => setTransactionFilter('Income')}
                    >
                        <Text style={[styles.tabText, transactionFilter === 'Income' && styles.activeTabText]}>
                            Income
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Transactions List */}
                <View style={styles.transactionsList}>
                    {filteredTransactions.length === 0 ? (
                        <Text style={styles.emptyText}>No {transactionFilter.toLowerCase()} found.</Text>
                    ) : (
                        filteredTransactions.map((t, idx) => (
                            <TouchableOpacity
                                key={t.transaction_id || idx}
                                style={styles.transactionItem}
                                onPress={() => navigation.navigate('EditTransaction', { transaction: t, mode: 'edit' })}
                            >
                                <View style={styles.tInfo}>
                                    <Text style={styles.tName} numberOfLines={1}>{t.name}</Text>
                                    <Text style={styles.tDate}>{t.date}</Text>
                                </View>
                                <Text style={[styles.tAmount, { color: t.amount > 0 ? '#FFF' : '#10B981' }]}>
                                    {t.amount > 0 ? '-' : '+'}${Math.abs(t.amount).toFixed(2)}
                                </Text>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#0F172A',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
    },
    headerRight: {
        flexDirection: 'row',
    },
    headerIcon: {
        marginLeft: 16,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    monthSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    monthTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '700',
    },
    monthSubtitle: {
        color: '#64748B',
        fontSize: 14,
        marginTop: 4,
    },
    chartContainer: {
        paddingHorizontal: 16,
        height: 250,
        justifyContent: 'flex-end',
        marginBottom: 20,
    },
    chart: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 180,
    },
    barWrapper: {
        alignItems: 'center',
        width: (width - 32) / 12,
    },
    bar: {
        width: 12,
        borderRadius: 4,
    },
    barLabel: {
        color: '#64748B',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 12,
    },
    barLabelActive: {
        color: '#FFF',
        fontWeight: '700',
    },
    tooltip: {
        position: 'absolute',
        top: -30,
        backgroundColor: 'transparent',
    },
    tooltipText: {
        color: '#10B981',
        fontSize: 10,
        fontWeight: '700',
    },
    projectedBtn: {
        backgroundColor: '#0F2944',
        marginHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 20,
    },
    projectedText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    summaryCard: {
        backgroundColor: '#1E293B',
        marginHorizontal: 16,
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    summaryMonth: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '700',
        flex: 1,
    },
    summaryPercent: {
        color: '#64748B',
        fontSize: 14,
        marginRight: 12,
    },
    summaryAmount: {
        fontSize: 18,
        fontWeight: '700',
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#334155',
        borderRadius: 3,
        marginBottom: 16,
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },
    balanceLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    statsCard: {
        backgroundColor: '#1E293B',
        marginHorizontal: 16,
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    statIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    statLabel: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#334155',
        marginVertical: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: '#1E293B',
        borderRadius: 12,
        padding: 4,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTabBtn: {
        backgroundColor: '#3B82F6',
    },
    tabText: {
        color: '#94A3B8',
        fontWeight: '600',
        fontSize: 14,
    },
    activeTabText: {
        color: '#FFF',
    },
    transactionsList: {
        paddingHorizontal: 16,
    },
    transactionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    tInfo: {
        flex: 1,
        marginRight: 10,
    },
    tName: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    tDate: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    tAmount: {
        fontSize: 14,
        fontWeight: '700',
    },
    emptyText: {
        color: '#64748B',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
    }
});

export default CashFlow;
