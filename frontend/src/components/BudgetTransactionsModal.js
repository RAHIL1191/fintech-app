import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SectionList, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ShoppingBag, Coffee, Home, CreditCard, DollarSign, ArrowRightLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import TransactionCard from './TransactionCard';

const BudgetTransactionsModal = ({ visible, onClose, transactions = [], budgetName }) => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();

    // --- Helpers reused from DailyTab ---
    const getIconForCategory = (category) => {
        const cat = (category || '').toLowerCase();
        if (cat.includes('shop')) return <ShoppingBag size={20} color="#FFF" />;
        if (cat.includes('food') || cat.includes('restaurant')) return <Coffee size={20} color="#FFF" />;
        if (cat.includes('home') || cat.includes('rent')) return <Home size={20} color="#FFF" />;
        if (cat.includes('transfer') || cat.includes('payment')) return <ArrowRightLeft size={20} color="#FFF" />;
        if (cat.includes('income') || cat.includes('payroll')) return <DollarSign size={20} color="#FFF" />;
        return <CreditCard size={20} color="#FFF" />;
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

    // ... formatTime and formatDateHeader ... (keep them if needed for helper but formatDateHeader is used in SectionHeader)
    const formatDateHeader = (dateStr) => {
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Group by Date for SectionList
    const sections = React.useMemo(() => {
        const groups = transactions.reduce((acc, t) => {
            const dateStr = t.date;
            if (!acc[dateStr]) {
                acc[dateStr] = { date: dateStr, data: [], total: 0 };
            }
            acc[dateStr].data.push(t);
            acc[dateStr].total += t.amount;
            return acc;
        }, {});

        // Sort keys desc
        return Object.values(groups)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(g => ({
                title: g.date,
                total: g.total,
                data: g.data
            }));
    }, [transactions]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Expenses</Text>
                        <Text style={styles.headerSubtitle}>{budgetName}</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                        console.log('Close button pressed');
                        if (onClose) onClose();
                    }}
                        style={styles.closeBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X size={24} color="#0F172A" />
                    </TouchableOpacity>
                </View>

                {transactions.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No expenses for this period</Text>
                    </View>
                ) : (
                    <SectionList
                        sections={sections}
                        keyExtractor={(item, index) => item.transaction_id || index.toString()}
                        contentContainerStyle={styles.listContent}
                        renderSectionHeader={({ section: { title, total } }) => (
                            <View style={styles.dateHeader}>
                                <Text style={styles.dateTitle}>{formatDateHeader(title)}</Text>
                                <Text style={styles.dateTotal}>${Math.abs(total).toFixed(2)}</Text>
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <TransactionCard
                                t={item}
                                navigation={navigation}
                                getIconColor={getIconColor}
                                getIconForCategory={getIconForCategory}
                                theme="light"
                            />
                        )}
                    />
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
    },
    listContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#94A3B8',
        fontSize: 16,
    },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 8,
    },
    dateTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    dateTotal: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardInfo: {
        flex: 1,
        marginRight: 8,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#64748B',
    },
    cardAmount: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
    },
});

export default BudgetTransactionsModal;
