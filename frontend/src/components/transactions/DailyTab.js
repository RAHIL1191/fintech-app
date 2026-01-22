import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, SectionList } from 'react-native';
import { ShoppingBag, Coffee, Home, CreditCard, DollarSign, RefreshCw, ArrowRightLeft, Plus } from 'lucide-react-native';

const DailyTab = ({ transactions = [], navigation, onRefresh, refreshing }) => {
    const [filter, setFilter] = useState('All'); // All | Expenses | Income | Transfers
    const [isFabExpanded, setIsFabExpanded] = useState(false);

    const FILTERS = ['All', 'Expenses', 'Income', 'Transfers'];

    const handleAdd = (type) => {
        setIsFabExpanded(false);
        navigation.navigate('EditTransaction', { mode: 'add', type });
    };

    // --- DATA PROCESSING ---
    const groupedData = useMemo(() => {
        // 1. Filter by Type
        const filtered = transactions.filter(t => {
            if (filter === 'All') return true;
            if (filter === 'Expenses') return t.amount > 0 && !t.is_transfer; // Plaid: positive amount = expense (exclude transfers)
            if (filter === 'Income') return t.amount < 0 && !t.is_transfer;   // Plaid: negative amount = refund/income (exclude transfers)
            if (filter === 'Transfers') {
                return !!t.is_transfer;
            }
            return true;
        });

        // 2. Group by Date (YYYY-MM-DD)
        const groups = filtered.reduce((acc, t) => {
            const dateStr = t.date; // YYYY-MM-DD
            if (!acc[dateStr]) {
                acc[dateStr] = { date: dateStr, transactions: [], total: 0 };
            }
            acc[dateStr].transactions.push(t);
            acc[dateStr].total += t.amount;
            return acc;
        }, {});

        // 3. Sort by Date Descending
        return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));

    }, [transactions, filter]);


    // Helper to format date header (e.g., "Dec 10")
    const formatDateHeader = (dateStr) => {
        const date = new Date(dateStr + 'T12:00:00'); // parsing fix to avoid timezone shift
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getIconForCategory = (category) => {
        // Simple mapping
        const cat = (category || '').toLowerCase();
        if (cat.includes('shop')) return <ShoppingBag size={20} color="#FFF" />;
        if (cat.includes('food') || cat.includes('restaurant')) return <Coffee size={20} color="#FFF" />;
        if (cat.includes('home') || cat.includes('rent')) return <Home size={20} color="#FFF" />;
        if (cat.includes('transfer') || cat.includes('payment')) return <ArrowRightLeft size={20} color="#FFF" />;
        if (cat.includes('income') || cat.includes('payroll')) return <DollarSign size={20} color="#FFF" />;
        return <CreditCard size={20} color="#FFF" />;
    };

    const formatTime = (timeStr) => {
        const actualTime = timeStr || '12:00'; // Default to 12:00 if missing
        try {
            let [hours, minutes] = actualTime.split(':').map(Number);
            const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const minutesStr = minutes < 10 ? '0' + minutes : minutes;
            return `${hours}:${minutesStr} ${ampm}`;
        } catch (e) {
            return timeStr;
        }
    };

    const getIconColor = (category) => {
        const cat = (category || '').toLowerCase();
        if (cat.includes('shop')) return '#F59E0B'; // Amber
        if (cat.includes('food')) return '#EF4444'; // Red
        if (cat.includes('home')) return '#10B981'; // Emerald
        if (cat.includes('transfer')) return '#6366F1'; // Indigo
        if (cat.includes('income')) return '#3B82F6'; // Blue
        return '#64748B'; // Slate
    };

    return (
        <View style={styles.container}>
            {/* Filter Pills */}
            <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                </ScrollView>
            </View>

            {/* Transactions List */}
            {groupedData.length > 0 ? (
                <SectionList
                    sections={groupedData.map(g => ({
                        title: g.date,
                        total: g.total,
                        data: g.transactions
                    }))}
                    keyExtractor={(item, index) => item.transaction_id || index.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />
                    }
                    renderSectionHeader={({ section: { title, total } }) => (
                        <View style={styles.dateHeader}>
                            <Text style={styles.dateTitle}>{formatDateHeader(title)}</Text>
                            <Text style={[
                                styles.dateTotal,
                                { color: total > 0 ? '#FFF' : '#10B981' }
                            ]}>
                                {total > 0 ? '-' : '+'}${Math.abs(total).toFixed(2)}
                            </Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('TransactionDetails', { transaction: item })}
                        >
                            <View style={styles.cardLeft}>
                                <View style={[styles.cardIcon, { backgroundColor: getIconColor(item.personal_finance_category?.primary) }]}>
                                    {getIconForCategory(item.personal_finance_category?.primary)}
                                </View>
                                <View style={styles.cardInfo}>
                                    <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                                        {item.personal_finance_category?.primary || 'General'}
                                        {item.time ? ` • ${formatTime(item.time)}` : ''}
                                    </Text>
                                </View>
                            </View>
                            <Text style={[
                                styles.cardAmount,
                                { color: item.amount > 0 ? '#FFF' : '#10B981' }
                            ]}>
                                {item.amount > 0 ? '-' : '+'}${Math.abs(item.amount).toFixed(2)}
                            </Text>
                            <View style={[
                                styles.cardAccentBar,
                                { backgroundColor: item.amount > 0 ? '#F59E0B' : '#10B981' }
                            ]} />
                        </TouchableOpacity>
                    )}
                    ListFooterComponent={<View style={{ height: 100 }} />}
                    stickySectionHeadersEnabled={false}
                />
            ) : (
                <ScrollView
                    contentContainerStyle={{ flex: 1, alignItems: 'center', paddingTop: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
                >
                    <Text style={styles.emptyText}>No transactions found.</Text>
                </ScrollView>
            )}

            {/* Expandable FAB Overlay */}
            {isFabExpanded && (
                <TouchableOpacity
                    style={styles.fabOverlay}
                    activeOpacity={1}
                    onPress={() => setIsFabExpanded(false)}
                />
            )}

            <View style={styles.fabContainer}>
                {isFabExpanded && (
                    <View style={styles.fabMenu}>
                        <TouchableOpacity
                            style={styles.fabSubButton}
                            onPress={() => handleAdd('income')}
                        >
                            <Text style={styles.fabSubText}>Add Income</Text>
                            <View style={[styles.fabSubIcon, { backgroundColor: '#10B981' }]}>
                                <Plus size={24} color="#FFF" />
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.fabSubButton}
                            onPress={() => handleAdd('expense')}
                        >
                            <Text style={styles.fabSubText}>Add Expense</Text>
                            <View style={[styles.fabSubIcon, { backgroundColor: '#EF4444' }]}>
                                <Plus size={24} color="#FFF" />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.fab, isFabExpanded && styles.fabActive]}
                    onPress={() => setIsFabExpanded(!isFabExpanded)}
                >
                    <Plus
                        size={32}
                        color="#FFF"
                        style={{ transform: [{ rotate: isFabExpanded ? '45deg' : '0deg' }] }}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    filterRow: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    filterPill: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1E293B',
        marginRight: 10,
    },
    activePill: {
        backgroundColor: '#075985', // Darker Blue
    },
    filterText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    activeFilterText: {
        color: '#38BDF8', // Cyan text
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    dateGroup: {
        marginBottom: 24,
    },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    dateTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    dateTotal: {
        color: '#10B981',
        fontSize: 16,
        fontWeight: '700',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1E293B',
        borderRadius: 16,
        marginBottom: 10,
        padding: 16,
        overflow: 'hidden',
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    cardIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardSubtitle: {
        color: '#94A3B8',
        fontSize: 13,
    },
    cardAmount: {
        fontSize: 15,
        fontWeight: '700',
        marginRight: 12,
    },
    cardAccentBar: {
        position: 'absolute',
        right: 0,
        top: 16,
        bottom: 16,
        width: 4,
        backgroundColor: '#10B981',
        borderRadius: 2,
    },
    emptyText: {
        color: '#64748B',
        textAlign: 'center',
        marginTop: 40,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        alignItems: 'flex-end',
    },
    fabOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(7, 10, 20, 0.6)',
        zIndex: 90,
    },
    fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#0EA5E9',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        zIndex: 100,
    },
    fabActive: {
        backgroundColor: '#334155',
    },
    fabMenu: {
        marginBottom: 16,
        alignItems: 'flex-end',
        zIndex: 100,
    },
    fabSubButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    fabSubIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    fabSubText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        backgroundColor: '#1E293B',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        overflow: 'hidden',
    }
});

export default DailyTab;
