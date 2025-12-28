import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { ChevronLeft, ChevronRight, MoreHorizontal, Store, ChevronDown } from 'lucide-react-native';
import DonutChart from '../DonutChart';

const MerchantsTab = ({ transactions = [], navigation, onRefresh, refreshing }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [typeFilter, setTypeFilter] = useState('Expenses'); // Expenses | Income
    const [expandedMerchant, setExpandedMerchant] = useState(null); // Track absolute merchant name

    // Auto-set date to the most recent transaction when data loads
    React.useEffect(() => {
        if (transactions.length > 0) {
            const latestTx = transactions[0];
            // Fix timezone issue: Split YYYY-MM-DD
            const [y, m, d] = latestTx.date.split('-').map(Number);
            const latestDate = new Date(y, m - 1, d);
            setSelectedDate(latestDate);
        }
    }, [transactions]);

    // Helpers for Date Navigation
    const changeMonth = (delta) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setSelectedDate(newDate);
        setExpandedMerchant(null);
    };

    const formattedDate = selectedDate.toLocaleString('default', { month: 'short', year: 'numeric' });

    // --- DATA AGGREGATION LOGIC ---
    const chartData = useMemo(() => {
        // 1. Filter by Month/Year
        const filteredByDate = transactions.filter(t => {
            if (t.is_transfer) return false;
            const tDate = new Date(t.date + 'T12:00:00');
            return (
                tDate.getMonth() === selectedDate.getMonth() &&
                tDate.getFullYear() === selectedDate.getFullYear()
            );
        });

        // 2. Filter by Type (Expense vs Income)
        const finalTransactions = filteredByDate.filter(t => {
            if (typeFilter === 'Expenses') return t.amount > 0;
            return t.amount < 0;
        });

        // 3. Group by MERCHANT
        const grouped = finalTransactions.reduce((acc, t) => {
            const merchantName = t.merchant_name || t.name || 'Unknown Merchant';

            if (!acc[merchantName]) {
                acc[merchantName] = { name: merchantName, amount: 0, count: 0, transactions: [] };
            }
            acc[merchantName].amount += Math.abs(t.amount);
            acc[merchantName].count += 1;
            acc[merchantName].transactions.push(t);
            return acc;
        }, {});

        // 4. Convert to Array and Sort
        const dataArray = Object.values(grouped).sort((a, b) => b.amount - a.amount);
        const totalAmount = dataArray.reduce((sum, item) => sum + item.amount, 0);

        // 5. Assign Colors
        const colors = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#059669', '#047857', '#065F46'];
        // Using Green/Emerald shades for Merchants to differentiate from Categories (Blue/Purple)

        const dataWithColors = dataArray.map((item, idx) => ({
            ...item,
            value: item.amount,
            color: colors[idx % colors.length]
        }));

        return { data: dataWithColors, total: totalAmount };
    }, [transactions, selectedDate, typeFilter]);

    const toggleMerchant = (name) => {
        setExpandedMerchant(prev => prev === name ? null : name);
    };

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" /> : null
            }
        >
            {/* Type Toggle & Date Nav */}
            <View style={styles.controlsRow}>
                <View style={styles.toggleContainer}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, typeFilter === 'Expenses' && styles.activeToggle]}
                        onPress={() => setTypeFilter('Expenses')}
                    >
                        <Text style={[styles.toggleText, typeFilter === 'Expenses' && styles.activeToggleText]}>
                            Expenses
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, typeFilter === 'Income' && styles.activeToggle]}
                        onPress={() => setTypeFilter('Income')}
                    >
                        <Text style={[styles.toggleText, typeFilter === 'Income' && styles.activeToggleText]}>
                            Income
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.dateNav}>
                    <TouchableOpacity onPress={() => changeMonth(-1)}>
                        <ChevronLeft size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                    <Text style={styles.dateText}>{formattedDate}</Text>
                    <TouchableOpacity onPress={() => changeMonth(1)}>
                        <ChevronRight size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chart Section */}
            <View style={styles.chartSection}>
                <DonutChart
                    data={chartData.data}
                    size={220}
                    strokeWidth={30}
                    centerLabel={typeFilter}
                    centerValue={`$${chartData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
            </View>


            {/* Merchant List */}
            <View style={styles.merchantList}>
                {chartData.data.map((item, idx) => {
                    const isExpanded = expandedMerchant === item.name;
                    return (
                        <View key={idx}>
                            <TouchableOpacity
                                style={styles.merchantItem}
                                onPress={() => toggleMerchant(item.name)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                                    <Store size={20} color={item.color} />
                                </View>
                                <View style={styles.merchantInfo}>
                                    <Text style={styles.merchantName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.merchantSub}>
                                        {((item.amount / (chartData.total || 1)) * 100).toFixed(1)}% • {item.count} transactions
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.merchantAmount, { color: typeFilter === 'Income' ? '#10B981' : '#F59E0B' }]}>
                                        {typeFilter === 'Expenses' ? '-' : '+'}${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </Text>
                                    {isExpanded ?
                                        <ChevronLeft size={16} color="#64748B" style={{ transform: [{ rotate: '-90deg' }], marginTop: 4 }} />
                                        : null
                                    }
                                </View>
                            </TouchableOpacity>

                            {/* Expanded Transactions List */}
                            {isExpanded && (
                                <View style={styles.transactionsList}>
                                    {item.transactions.map((t, tIdx) => (
                                        <TouchableOpacity
                                            key={t.transaction_id || tIdx}
                                            style={styles.transactionRow}
                                            onPress={() => navigation.navigate('TransactionDetails', { transaction: t })}
                                        >
                                            <View style={styles.tInfo}>
                                                <Text style={styles.tName} numberOfLines={1}>{t.name}</Text>
                                                <Text style={styles.tDate}>{t.date}</Text>
                                            </View>
                                            <Text style={styles.tAmount}>
                                                ${Math.abs(t.amount).toFixed(2)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}

                {chartData.data.length === 0 && (
                    <Text style={styles.emptyText}>No transactions for this month.</Text>
                )}
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 4,
    },
    toggleBtn: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 16,
    },
    activeToggle: {
        backgroundColor: '#0EA5E9',
    },
    toggleText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    activeToggleText: {
        color: '#FFF',
    },
    dateNav: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    dateText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
        marginHorizontal: 12,
    },
    chartSection: {
        alignItems: 'center',
        marginVertical: 20,
    },
    merchantList: {
        paddingHorizontal: 16,
    },
    merchantItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    merchantInfo: {
        flex: 1,
    },
    merchantName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    merchantSub: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    merchantAmount: {
        color: '#F59E0B',
        fontSize: 15,
        fontWeight: '700',
    },
    emptyText: {
        color: '#64748B',
        textAlign: 'center',
        marginTop: 30,
    },
    transactionsList: {
        backgroundColor: '#162032',
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    transactionRow: {
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
        color: '#E2E8F0',
        fontSize: 14,
        fontWeight: '500',
    },
    tDate: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    tAmount: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    }
});

export default MerchantsTab;
