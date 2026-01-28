import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Pencil, Trash2, CreditCard, Wallet, Landmark, Info, Tag } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../config/api';
import { formatCurrency, formatAuditDate, cleanDeviceName } from '../utils/dateUtils';

const TransactionDetails = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const insets = useSafeAreaInsets();
    const { transaction } = route.params || {};
    const [relatedSplits, setRelatedSplits] = React.useState([]);

    React.useEffect(() => {
        if (!transaction) return;

        // Ensure we find the Original Parent ID
        const parentId = transaction.original_transaction_id || transaction.transaction_id;

        // If this IS a split (has original_transaction_id), fetch siblings
        if (transaction.original_transaction_id || transaction.transaction_id.includes('_split_')) {
            api.get('/transactions', { params: { transaction_id: parentId } })
                .then(res => {
                    const allSplits = res.data.transactions || [];
                    // Filter out SELF
                    const siblings = allSplits.filter(t => t.transaction_id !== transaction.transaction_id);
                    setRelatedSplits(siblings);
                })
                .catch(err => console.log('Failed to fetch related splits:', err));
        }
    }, [transaction]);

    if (!transaction) return null;

    const handleDelete = () => {
        Alert.alert(
            "Delete Transaction",
            "Are you sure you want to delete this transaction?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            if (transaction.is_manual || String(transaction.transaction_id).startsWith('manual_')) {
                                await api.delete(`/transactions/${transaction.transaction_id}`);

                                // Navigate back to the previous screen (Insights or Transactions)
                                if (navigation.canGoBack()) {
                                    navigation.goBack();
                                } else {
                                    navigation.navigate('Transactions');
                                }
                            } else {
                                Alert.alert("Note", "Only manually added transactions can be deleted in this version.");
                            }
                        } catch (error) {
                            console.error('Failed to delete transaction:', error);
                            const message = error.response?.data?.error || error.message || "Unknown Network Error";
                            Alert.alert("Delete Failed", `Could not delete transaction.\n\nDebug Info: ${message}`);
                        }
                    }
                }
            ]
        );
    };

    const handleEdit = () => {
        navigation.navigate('EditTransaction', { transaction, mode: 'edit' });
    };

    const getAccountIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'depository': return <Wallet size={24} color="#3B82F6" />;
            case 'credit': return <CreditCard size={24} color="#6366F1" />;
            default: return <Landmark size={24} color="#64748B" />;
        }
    };

    // Helper for formatting the date in the hero section
    const formatHeroDate = (dateStr, timeStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T12:00:00');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        let timePart = '';
        if (timeStr) {
            let [h, m] = timeStr.split(':').map(Number);
            const ampm = h >= 12 ? 'p.m.' : 'a.m.';
            h = h % 12 || 12;
            timePart = `, ${h}:${m < 10 ? '0' + m : m} ${ampm}`;
        }

        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}${timePart}`;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <ArrowLeft size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Transaction</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
                        <Pencil size={22} color="#3B82F6" />
                    </TouchableOpacity>
                    {(transaction.is_manual || String(transaction.transaction_id).startsWith('manual_')) && (
                        <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                            <Trash2 size={22} color="#EF4444" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={[styles.categoryCircle, { backgroundColor: transaction.isIncome ? '#DCFCE7' : '#FEE2E2' }]}>
                        <Info size={32} color={transaction.isIncome ? '#166534' : '#991B1B'} />
                    </View>
                    <Text style={styles.categoryName}>
                        {transaction.splits && Array.isArray(JSON.parse(typeof transaction.splits === 'string' ? transaction.splits : JSON.stringify(transaction.splits)))
                            ? 'Multiple Categories'
                            : (transaction.category?.[0] || 'General')}
                    </Text>
                    <Text style={[styles.amount, { color: transaction.isIncome ? '#166534' : '#0F172A' }]}>
                        {transaction.isIncome ? '+' : '-'}{formatCurrency(Math.abs(parseFloat(transaction.amount)))}
                    </Text>
                    <Text style={styles.heroMeta}>
                        {transaction.isIncome ? 'Income' : 'Expense'} | {formatHeroDate(transaction.authorized_date || transaction.date, transaction.time)}
                    </Text>
                </View>

                {/* Details Section */}
                <View style={styles.section}>
                    <View style={styles.detailCard}>
                        <View style={styles.accountIconContainer}>
                            {getAccountIcon(transaction.account_type)}
                        </View>
                        <View style={styles.detailText}>
                            <Text style={styles.detailLabel}>{transaction.account_name || 'Cash'}</Text>
                            <Text style={styles.detailSubtext}>From account</Text>
                        </View>
                    </View>

                    {/* Related Splits Section */}
                    {relatedSplits.length > 0 && (
                        <View style={[styles.detailCard, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                            <Text style={[styles.detailLabel, { marginBottom: 12 }]}>Related Splits</Text>
                            {relatedSplits.map((split, idx) => (
                                <TouchableOpacity
                                    key={split.transaction_id || idx}
                                    style={styles.splitDetailRow}
                                    onPress={() => navigation.push('TransactionDetails', { transaction: split })}
                                >
                                    <View style={styles.splitDetailCategory}>
                                        <Tag size={16} color="#6366F1" style={{ marginRight: 8 }} />
                                        <Text style={styles.splitDetailText}>
                                            {split.personal_finance_category?.primary || split.category?.[0] || 'Split'}
                                        </Text>
                                    </View>
                                    <Text style={styles.splitDetailAmount}>
                                        {formatCurrency(Math.abs(split.amount))}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {transaction.note && (
                        <View style={styles.detailCard}>
                            <View style={styles.detailText}>
                                <Text style={styles.detailLabel}>Note</Text>
                                <Text style={styles.detailSubtext}>{transaction.note}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Audit Information */}
                <View style={styles.auditContainer}>
                    <Text style={styles.auditText}>
                        {transaction.device_info === 'Plaid Sync' ? 'Synced' : 'Created'} {formatAuditDate(transaction.created_at || transaction.updated_at)}
                    </Text>
                    {transaction.updated_at && transaction.updated_at !== transaction.created_at && transaction.device_info !== 'Plaid Sync' && (
                        <Text style={styles.auditText}>
                            Updated {formatAuditDate(transaction.updated_at)}
                        </Text>
                    )}
                    <Text style={styles.auditText}>
                        By {cleanDeviceName(transaction.device_info) || 'Android Emulator'}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
    },
    headerButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    categoryCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    categoryName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 12,
    },
    amount: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 8,
    },
    heroMeta: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748B',
    },
    section: {
        padding: 16,
        marginTop: 8,
    },
    detailCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    accountIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    detailText: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 2,
    },
    detailSubtext: {
        fontSize: 14,
        color: '#64748B',
    },
    auditContainer: {
        marginTop: 24,
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    auditText: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 4,
        lineHeight: 18,
    },
    splitDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    splitDetailCategory: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    splitDetailText: {
        fontSize: 15,
        color: '#1E293B',
        fontWeight: '500',
    },
    splitDetailAmount: {
        fontSize: 15,
        color: '#1E293B',
        fontWeight: '600',
    }
});

export default TransactionDetails;
