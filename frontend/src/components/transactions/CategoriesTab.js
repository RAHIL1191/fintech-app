import React, { useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react-native';
import DonutChart from '../DonutChart';
import { getParentCategory, getCategoryColor, getCategoryIcon } from '../../constants/CategoryTaxonomy';
import CategoryDrillDownModal from '../../components/CategoryDrillDownModal';

const CategoriesTab = ({ transactions = [], navigation, onRefresh, refreshing }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [typeFilter, setTypeFilter] = useState('Expenses'); // Expenses | Income
    const [selectedParent, setSelectedParent] = useState(null); // Track selected parent for modal
    const initializedRef = useRef(false);

    // Auto-set date to the most recent transaction when data loads (ONLY ONCE)
    React.useEffect(() => {
        if (!initializedRef.current && transactions.length > 0) {
            const latestTx = transactions[0];
            const [y, m, d] = latestTx.date.split('-').map(Number);
            const latestDate = new Date(y, m - 1, d);
            setSelectedDate(latestDate);
            initializedRef.current = true;
        }
    }, [transactions]);

    // Helpers for Date Navigation
    const changeMonth = (delta) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setSelectedDate(newDate);
    };

    const formattedDate = selectedDate.toLocaleString('default', { month: 'short', year: 'numeric' });

    // --- DATA AGGREGATION LOGIC ---
    const chartData = useMemo(() => {
        // 1. Filter by Month/Year AND exclude transfers
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

        // 3. Group by PARENT Category
        const grouped = finalTransactions.reduce((acc, t) => {
            const rawCat = t.personal_finance_category?.primary || t.category?.[0] || 'Uncategorized';
            const parentCat = getParentCategory(rawCat);

            if (!acc[parentCat]) {
                acc[parentCat] = { name: parentCat, amount: 0, count: 0, transactions: [] };
            }
            acc[parentCat].amount += Math.abs(t.amount);
            acc[parentCat].count += 1;
            acc[parentCat].transactions.push(t);
            return acc;
        }, {});

        // 4. Convert to Array and Sort
        const dataArray = Object.values(grouped).sort((a, b) => b.amount - a.amount);
        const totalAmount = dataArray.reduce((sum, item) => sum + item.amount, 0);

        // 5. Assign Colors
        const dataWithColors = dataArray.map((item) => ({
            ...item,
            value: item.amount,
            color: getCategoryColor(item.name)
        }));

        return { data: dataWithColors, total: totalAmount };
    }, [transactions, selectedDate, typeFilter]);

    // Get transactions for the modal
    const selectedParentTransactions = useMemo(() => {
        if (!selectedParent) return [];
        return chartData.data.find(d => d.name === selectedParent)?.transactions || [];
    }, [selectedParent, chartData]);

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" /> : null
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

            {/* Category List (Grouped by Parent) */}
            <View style={styles.categoryList}>
                {chartData.data.map((item, idx) => (
                    <TouchableOpacity
                        key={idx}
                        style={styles.categoryItem}
                        onPress={() => setSelectedParent(item.name)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                            {/* Assuming we might want dynamic icon later, for now Generic or mapped */}
                            <MoreHorizontal size={20} color={item.color} />
                        </View>
                        <View style={styles.categoryInfo}>
                            <Text style={styles.categoryName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.categorySub}>
                                {((item.amount / (chartData.total || 1)) * 100).toFixed(1)}% • {item.count} transactions
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.categoryAmount, { color: typeFilter === 'Income' ? '#10B981' : '#F59E0B' }]}>
                                {typeFilter === 'Expenses' ? '-' : '+'}${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}

                {chartData.data.length === 0 && (
                    <Text style={styles.emptyText}>No transactions for this month.</Text>
                )}
            </View>

            <View style={{ height: 100 }} />

            {/* Drill Down Modal */}
            {selectedParent && (
                <CategoryDrillDownModal
                    visible={!!selectedParent}
                    onClose={() => setSelectedParent(null)}
                    parentCategory={selectedParent}
                    transactions={selectedParentTransactions}
                    navigation={navigation}
                />
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A', // Dark Blue/Slate Background
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
        backgroundColor: '#0EA5E9', // Sky Blue
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
    categoryList: {
        paddingHorizontal: 16,
    },
    categoryItem: {
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
    categoryInfo: {
        flex: 1,
    },
    categoryName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    categorySub: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    categoryAmount: {
        color: '#F59E0B',
        fontSize: 15,
        fontWeight: '700',
    },
    emptyText: {
        color: '#64748B',
        textAlign: 'center',
        marginTop: 30,
    },
});

export default CategoriesTab;
