import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Repeat, ChevronRight, Calendar, ArrowUpRight, ArrowDownLeft, ChevronDown } from 'lucide-react-native';

const RecurringTab = ({ transactions = [], navigation }) => {
    const [expandedSections, setExpandedSections] = useState({});

    const toggleSection = (freq) => {
        setExpandedSections(prev => ({
            ...prev,
            [freq]: !prev[freq]
        }));
    };

    // Mocking the recurring status for demo purposes
    const recurringData = useMemo(() => {
        const frequencies = ['Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];

        const groups = {
            'Weekly': [],
            'Bi-weekly': [],
            'Monthly': [],
            'Yearly': []
        };

        transactions.slice(0, 10).forEach((t, idx) => {
            const freq = frequencies[idx % 4];
            groups[freq].push({
                ...t,
                frequency: freq,
                nextDate: '2025-01-' + (10 + idx), // Mock next date
                status: idx % 3 === 0 ? 'Upcoming' : 'Paid'
            });
        });

        return Object.entries(groups)
            .filter(([_, items]) => items.length > 0)
            .map(([freq, items]) => {
                const total = items.reduce((sum, item) => sum + item.amount, 0);
                return { freq, items, total };
            });
    }, [transactions]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            {recurringData.map(({ freq, items, total }) => {
                const isExpanded = !!expandedSections[freq];
                return (
                    <View key={freq} style={styles.section}>
                        <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => toggleSection(freq)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.sectionHeaderLeft}>
                                <Repeat size={18} color="#0EA5E9" />
                                <Text style={styles.sectionTitle}>{freq}</Text>
                                <View style={styles.badgeCount}>
                                    <Text style={styles.badgeCountText}>{items.length}</Text>
                                </View>
                            </View>
                            <View style={styles.sectionHeaderRight}>
                                <Text style={[
                                    styles.totalAmount,
                                    { color: total > 0 ? '#FFF' : '#10B981' }
                                ]}>
                                    {total > 0 ? '-' : '+'}${Math.abs(total).toFixed(2)}
                                </Text>
                                <ChevronDown
                                    size={20}
                                    color="#94A3B8"
                                    style={{
                                        marginLeft: 8,
                                        transform: [{ rotate: isExpanded ? '180deg' : '0deg' }]
                                    }}
                                />
                            </View>
                        </TouchableOpacity>

                        {isExpanded && items.map((item, idx) => (
                            <TouchableOpacity
                                key={item.transaction_id || idx}
                                style={styles.card}
                                onPress={() => navigation.navigate('EditTransaction', { transaction: item, mode: 'edit' })}
                            >
                                <View style={styles.cardMain}>
                                    <View style={[
                                        styles.iconContainer,
                                        { backgroundColor: item.amount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }
                                    ]}>
                                        {item.amount > 0 ? (
                                            <ArrowUpRight size={20} color="#EF4444" />
                                        ) : (
                                            <ArrowDownLeft size={20} color="#10B981" />
                                        )}
                                    </View>
                                    <View style={styles.info}>
                                        <View style={styles.row}>
                                            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                                            <Text style={[
                                                styles.amount,
                                                { color: item.amount > 0 ? '#FFF' : '#10B981' }
                                            ]}>
                                                {item.amount > 0 ? '-' : '+'}${Math.abs(item.amount).toFixed(2)}
                                            </Text>
                                        </View>
                                        <View style={styles.row}>
                                            <View style={styles.dateRow}>
                                                <Calendar size={14} color="#64748B" style={{ marginRight: 4 }} />
                                                <Text style={styles.dateText}>Next: {item.nextDate}</Text>
                                            </View>
                                            <View style={[
                                                styles.statusBadge,
                                                { backgroundColor: item.status === 'Upcoming' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)' }
                                            ]}>
                                                <Text style={[
                                                    styles.statusText,
                                                    { color: item.status === 'Upcoming' ? '#F59E0B' : '#10B981' }
                                                ]}>
                                                    {item.status}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <ChevronRight size={20} color="#475569" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                );
            })}

            {recurringData.length === 0 && (
                <View style={styles.emptyState}>
                    <Repeat size={48} color="#1E293B" />
                    <Text style={styles.emptyTitle}>No recurring transactions</Text>
                    <Text style={styles.emptySubtitle}>Mark transactions as recurring to see them here.</Text>
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
    scrollContent: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 4,
        paddingVertical: 8,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 8,
    },
    badgeCount: {
        backgroundColor: '#1E293B',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
        borderWidth: 1,
        borderBottomColor: '#334155',
    },
    badgeCountText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '700',
    },
    totalAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    card: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    cardMain: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    info: {
        flex: 1,
        marginRight: 8,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    name: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    amount: {
        fontSize: 16,
        fontWeight: '700',
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        color: '#64748B',
        fontSize: 13,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
    },
    emptySubtitle: {
        color: '#64748B',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
    }
});

export default RecurringTab;
