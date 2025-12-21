import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ChevronLeft,
    Trash2,
    MoreHorizontal,
    RefreshCw,
    CreditCard,
    Package,
    Layout,
    Hash,
    Clock,
    History
} from 'lucide-react-native';
import api from '../config/api';

const { width } = Dimensions.get('window');

const AccountDetails = ({ route, navigation }) => {
    const { account, accessToken } = route.params;
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [timeFilter, setTimeFilter] = useState('1M');

    useEffect(() => {
        fetchAccountTransactions();
    }, []);

    const fetchAccountTransactions = async () => {
        setLoading(true);
        try {
            // Note: In a real app, you'd filter by account_id on the backend
            // Backend uses stored tokens
            const response = await api.get('/transactions');

            // Filter transactions for this specific account
            const accountTransactions = response.data.transactions?.filter(
                t => t.account_id === account.account_id
            ) || [];

            setTransactions(accountTransactions.slice(0, 5)); // Show recent 5
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const TimeBtn = ({ label }) => (
        <TouchableOpacity
            style={[styles.timeBtn, timeFilter === label && styles.activeTimeBtn]}
            onPress={() => setTimeFilter(label)}
        >
            <Text style={[styles.timeBtnText, timeFilter === label && styles.activeTimeBtnText]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const TransactionItem = ({ item }) => (
        <View style={styles.transactionItem}>
            <View style={styles.transactionIconBox}>
                <CreditCard size={18} color="#6B7280" />
            </View>
            <View style={styles.transactionInfo}>
                <Text style={styles.transactionName} numberOfLines={1}>{item.name}</Text>
            </View>
            <Text style={[
                styles.transactionAmount,
                item.amount < 0 ? styles.positiveAmount : styles.negativeAmount
            ]}>
                {item.amount < 0 ? '+' : ''}${Math.abs(item.amount).toFixed(2)}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ChevronLeft size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account Details</Text>
                <TouchableOpacity>
                    <Trash2 size={24} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Account Card Identifier */}
                <View style={styles.accountIdentifierBar}>
                    <TouchableOpacity><ChevronLeft size={18} color="#666" /></TouchableOpacity>
                    <Text style={styles.accountCardNumber}>
                        {account.mask ? `XXXX XXXX XXXX ${account.mask}` : account.name}
                    </Text>
                    <TouchableOpacity><MoreHorizontal size={18} color="#666" /></TouchableOpacity>
                </View>

                {/* Sync Banner */}
                <View style={styles.warningBanner}>
                    <View style={styles.warningContent}>
                        <Text style={styles.warningTitle}>Bank connection needs updating.</Text>
                        <Text style={styles.warningSub}>Please sync to continue syncing transactions and balances.</Text>
                    </View>
                    <TouchableOpacity style={styles.syncBtn}>
                        <Text style={styles.syncBtnText}>Sync</Text>
                    </TouchableOpacity>
                </View>

                {/* Balance Section */}
                <View style={styles.balanceSection}>
                    <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
                    <Text style={styles.balanceAmount}>
                        ${account.balances.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={styles.balanceChange}>$0.00 (0%) 1 month</Text>
                </View>

                {/* Graph Placeholder */}
                <View style={styles.graphContainer}>
                    <View style={styles.graphBox}>
                        <Text style={styles.graphPlaceholderText}>[Graph Placeholder]</Text>
                    </View>
                    <View style={styles.timeFilterRow}>
                        <TimeBtn label="1M" />
                        <TimeBtn label="3M" />
                        <TimeBtn label="6M" />
                        <TimeBtn label="YTD" />
                        <TimeBtn label="1Y" />
                        <TimeBtn label="ALL" />
                    </View>
                </View>

                {/* Recent Transactions */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Transactions</Text>
                </View>
                <View style={styles.transactionsCard}>
                    {loading ? (
                        <ActivityIndicator size="small" color="#6366F1" style={{ padding: 20 }} />
                    ) : transactions.length > 0 ? (
                        transactions.map((t, idx) => (
                            <TransactionItem key={t.transaction_id || idx} item={t} />
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No recent transactions</Text>
                    )}
                    <TouchableOpacity style={styles.viewAllBtn}>
                        <Text style={styles.viewAllText}>View all transactions</Text>
                    </TouchableOpacity>
                </View>

                {/* Summary Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Summary</Text>
                </View>
                <View style={styles.summaryCard}>
                    <View style={styles.summaryItem}>
                        <View style={styles.summaryLabelRow}>
                            <Package size={16} color="#F59E0B" />
                            <Text style={styles.summaryLabelText}>Institution</Text>
                        </View>
                        <Text style={styles.summaryValueText}>{account.institution_name || 'Personal'}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <View style={styles.summaryLabelRow}>
                            <Layout size={16} color="#6366F1" />
                            <Text style={styles.summaryLabelText}>Account type</Text>
                        </View>
                        <Text style={styles.summaryValueText}>{account.subtype || account.type}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <View style={styles.summaryLabelRow}>
                            <Hash size={16} color="#10B981" />
                            <Text style={styles.summaryLabelText}>Total transactions</Text>
                        </View>
                        <Text style={styles.summaryValueText}>{transactions.length > 0 ? '156' : '0'}</Text>
                    </View>
                </View>

                {/* Connection Status */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Connection status</Text>
                </View>
                <View style={styles.statusCard}>
                    <View style={styles.statusItem}>
                        <View style={styles.statusLabelRow}>
                            <RefreshCw size={14} color="#6B7280" />
                            <Text style={styles.statusLabelText}>Last sync</Text>
                        </View>
                        <Text style={styles.statusValueText}>5 minutes ago</Text>
                    </View>
                    <View style={styles.statusItem}>
                        <View style={styles.statusLabelRow}>
                            <Clock size={14} color="#EF4444" />
                            <Text style={styles.statusLabelText}>Time since sync</Text>
                        </View>
                        <Text style={styles.statusValueText}>0.1 hours</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    accountIdentifierBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        marginTop: 10,
    },
    accountCardNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: 1,
    },
    warningBanner: {
        backgroundColor: '#FDE047',
        marginHorizontal: 16,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    warningContent: {
        flex: 1,
        marginRight: 10,
    },
    warningTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    warningSub: {
        fontSize: 11,
        color: '#1A1A1A',
        marginTop: 2,
    },
    syncBtn: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    syncBtnText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
    balanceSection: {
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    balanceLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        letterSpacing: 0.5,
    },
    balanceAmount: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1A1A1A',
        marginTop: 4,
    },
    balanceChange: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 4,
    },
    graphContainer: {
        marginHorizontal: 16,
        backgroundColor: '#EBF5FF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 20,
    },
    graphBox: {
        height: 120,
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#D1E9FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    graphPlaceholderText: {
        color: '#93C5FD',
        fontSize: 14,
        fontWeight: '500',
    },
    timeFilterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    timeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    activeTimeBtn: {
        backgroundColor: '#D1E9FF',
    },
    timeBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
    },
    activeTimeBtnText: {
        color: '#2563EB',
    },
    sectionHeader: {
        paddingHorizontal: 16,
        marginBottom: 8,
        marginTop: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    transactionsCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    transactionIconBox: {
        width: 36,
        height: 36,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    transactionInfo: {
        flex: 1,
    },
    transactionName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    transactionAmount: {
        fontSize: 14,
        fontWeight: '700',
    },
    positiveAmount: {
        color: '#10B981',
    },
    negativeAmount: {
        color: '#EF4444',
    },
    viewAllBtn: {
        alignItems: 'center',
        paddingVertical: 14,
        backgroundColor: '#F9FAFB',
    },
    viewAllText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    summaryCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 8,
    },
    summaryLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryLabelText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 10,
    },
    summaryValueText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    statusCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        marginBottom: 30,
    },
    statusItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 6,
    },
    statusLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusLabelText: {
        fontSize: 13,
        color: '#6B7280',
        marginLeft: 8,
    },
    statusValueText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    emptyText: {
        padding: 20,
        textAlign: 'center',
        color: '#9CA3AF',
    }
});

export default AccountDetails;
