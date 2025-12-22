import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';

const MonthlyTab = ({ transactions = [], navigation, onRefresh, refreshing }) => {
    const [filter, setFilter] = useState('All'); // All | Expenses | Income
    const FILTERS = ['All', 'Expenses', 'Income'];

    // --- DATA PROCESSING ---
    const monthlyData = useMemo(() => {
        const year = 2025; // As per screenshot
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Initialize with empty months
        const groups = months.map((name, index) => ({
            name,
            year,
            index,
            expenses: 0,
            income: 0,
            hasData: false
        }));

        transactions.forEach(t => {
            const tDate = new Date(t.date + 'T12:00:00');
            if (tDate.getFullYear() === year) {
                // Exclude transfers from cash flow calculation
                if (t.is_transfer) return;

                const monthIdx = tDate.getMonth();
                if (t.amount > 0) {
                    groups[monthIdx].expenses += t.amount;
                } else {
                    groups[monthIdx].income += Math.abs(t.amount);
                }
                groups[monthIdx].hasData = true;
            }
        });

        // Calculate Max for relative bar sizing
        const maxVal = Math.max(...groups.map(g => Math.max(g.expenses, g.income)), 1);

        return groups.map(g => {
            let displayAmount = 0;
            let displayType = 'neutral'; // income | expense | neutral

            if (filter === 'All') {
                const net = g.income - g.expenses;
                displayAmount = net;
                displayType = net >= 0 ? 'income' : 'expense';
            } else if (filter === 'Expenses') {
                displayAmount = -g.expenses;
                displayType = 'expense';
            } else {
                displayAmount = g.income;
                displayType = 'income';
            }

            return {
                ...g,
                displayAmount,
                displayType,
                progress: Math.min(Math.abs(displayAmount) / maxVal, 1)
            };
        });
    }, [transactions, filter]);

    return (
        <View style={styles.container}>
            {/* Filter Pills */}
            <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[
                            styles.filterPill,
                            filter === f && styles.activePill
                        ]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[
                            styles.filterText,
                            filter === f && styles.activeFilterText
                        ]}>
                            {f}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Monthly List */}
            <ScrollView
                contentContainerStyle={styles.listContent}
                refreshControl={
                    onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" /> : null
                }
            >
                {monthlyData.map((month) => (
                    <TouchableOpacity
                        key={month.name}
                        style={styles.card}
                        onPress={() => navigation.navigate('CashFlow', {
                            transactions,
                            initialMonthIdx: month.index,
                            year: month.year
                        })}
                    >
                        <View style={styles.cardHeader}>
                            <Text style={[styles.monthName, !month.hasData && styles.noDataText]}>
                                {month.name} {month.year}
                            </Text>
                            {!month.hasData ? (
                                <Text style={styles.noDataText}>No transactions</Text>
                            ) : (
                                <Text style={[
                                    styles.amountText,
                                    { color: month.displayType === 'income' ? '#10B981' : '#F59E0B' }
                                ]}>
                                    {month.displayAmount >= 0 ? '+' : '-'}${Math.abs(month.displayAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                            )}
                        </View>

                        {/* Progress Bar Container */}
                        <View style={styles.progressBarContainer}>
                            <View
                                style={[
                                    styles.progressBar,
                                    {
                                        width: `${month.hasData ? Math.max(month.progress * 100, 5) : 100}%`,
                                        backgroundColor: !month.hasData ? '#1E293B' : (month.displayType === 'income' ? '#10B981' : '#F59E0B')
                                    }
                                ]}
                            />
                        </View>
                    </TouchableOpacity>
                ))}
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#071021',
    },
    filterRow: {
        flexDirection: 'row',
        paddingVertical: 16,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    filterPill: {
        paddingHorizontal: 24,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1E293B',
        marginHorizontal: 4,
    },
    activePill: {
        backgroundColor: '#0EA5E9',
    },
    filterText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '600',
    },
    activeFilterText: {
        color: '#FFF',
    },
    listContent: {
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: '#162032',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    monthName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    amountText: {
        fontSize: 16,
        fontWeight: '700',
    },
    noDataText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '600',
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#1E293B',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    }
});

export default MonthlyTab;
