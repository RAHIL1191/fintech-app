import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Repeat } from 'lucide-react-native';

const TransfersTab = ({ transactions = [], navigation, onRefresh, refreshing }) => {
    const transfers = transactions.filter(t => t.is_transfer === true || t.is_transfer === 1);

    // Group transactions by Date
    const grouped = transfers
        .reduce((acc, t) => {
            const date = t.date;
            if (!acc[date]) acc[date] = [];
            acc[date].push(t);
            return acc;
        }, {});

    // Sort dates descending
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    const totalTransfers = transactions.filter(t => t.is_transfer).length;

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" /> : null
            }
        >
            <View style={styles.header}>
                <Text style={styles.headerText}>
                    {totalTransfers} Transfers Found
                </Text>
            </View>

            {sortedDates.map((date) => (
                <View key={date} style={styles.dateGroup}>
                    <Text style={styles.dateHeader}>
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </Text>
                    {grouped[date].map((t, idx) => (
                        <TouchableOpacity
                            key={t.transaction_id || idx}
                            style={styles.transactionRow}
                            onPress={() => navigation.navigate('TransactionDetails', { transaction: t })}
                        >
                            <View style={[styles.iconCircle, { backgroundColor: '#6366F1' }]}>
                                <Repeat size={20} color="#FFF" />
                            </View>
                            <View style={styles.tContent}>
                                <Text style={styles.tName} numberOfLines={1}>{t.name}</Text>
                                {t.note ? <Text style={styles.tNote}>{t.note}</Text> : null}
                            </View>
                            <Text style={styles.tAmount}>
                                ${Math.abs(t.amount).toFixed(2)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ))}

            {sortedDates.length === 0 && (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No transfers found.</Text>
                </View>
            )}

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#071021',
    },
    header: {
        padding: 16,
    },
    headerText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '600',
    },
    dateGroup: {
        marginBottom: 20,
    },
    dateHeader: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginLeft: 16,
        marginBottom: 8,
    },
    transactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#162032',
        marginBottom: 1,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    tContent: {
        flex: 1,
    },
    tName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    tNote: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 2,
    },
    tAmount: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#64748B',
        fontSize: 16,
    }
});

export default TransfersTab;
