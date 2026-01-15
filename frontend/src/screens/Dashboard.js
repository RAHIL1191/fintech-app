import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus, CreditCard, PieChart } from 'lucide-react-native';
import PlaidLink from '../components/PlaidLink';
import api from '../config/api';

const Dashboard = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [accessToken, setAccessToken] = useState(null);
    const [balance, setBalance] = useState({ total: '0.00', income: '0.00', expenses: '0.00' });
    const [transactions, setTransactions] = useState([]);

    const fetchDashboardData = async (forceSync = false) => {
        setLoading(true);
        try {
            console.log('Fetching transactions from backend...');
            const params = {};
            if (forceSync || (typeof forceSync === 'object' && forceSync.nativeEvent)) {
                // If called from RefreshControl, forceSync might be the event object
                params.sync = 'true';
            }

            const response = await api.get('/transactions', { params });

            console.log('Frontend: Received API response');
            const accounts = response.data.accounts || [];
            const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balances.current || 0), 0);

            const plaidTransactions = response.data.transactions || [];

            // Calculate Income and Expenses (Excluding Transfers)
            const income = plaidTransactions
                .filter(t => t.amount < 0 && !t.is_transfer)
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);

            const expenses = plaidTransactions
                .filter(t => t.amount > 0 && !t.is_transfer)
                .reduce((sum, t) => sum + t.amount, 0);

            const formattedTxs = plaidTransactions.map(tx => ({
                ...tx, // Preserve raw data for TransactionDetails
                id: tx.transaction_id,
                title: tx.name,
                amount: `${tx.amount < 0 ? '+' : '-'}$${Math.abs(tx.amount).toFixed(2)}`,
                category: tx.category ? tx.category[0] : 'General',
                date: tx.date,
                isIncome: tx.amount < 0
            })).slice(0, 10);

            setBalance({
                total: totalBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                income: income.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                expenses: expenses.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            });
            setTransactions(formattedTxs);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            const msg = error.response ? JSON.stringify(error.response.data) : error.message;
            Alert.alert('Data Error', `Failed to load transactions.\n\nError: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSuccess = (token) => {
        console.log('Successfully linked account! Access Token received.');
        fetchDashboardData(token);
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={fetchDashboardData} />
                }
            >
                {/* Header Section */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.welcomeText}>Good morning,</Text>
                        <Text style={styles.userName}>Rahil</Text>
                    </View>
                    <TouchableOpacity style={styles.profileButton}>
                        <View style={styles.profilePlaceholder} />
                    </TouchableOpacity>
                </View>

                {/* Balance Card */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Total Balance</Text>
                    {loading ? (
                        <ActivityIndicator color="#FFF" style={{ alignSelf: 'flex-start', marginVertical: 10 }} />
                    ) : (
                        <Text style={styles.balanceAmount}>{(balance.total !== '$0.00' || loading) ? balance.total : '$0.00'}</Text>
                    )}
                    <View style={styles.balanceActions}>
                        <View style={styles.statItem}>
                            <View style={[styles.iconBg, { backgroundColor: '#E1F5FE' }]}>
                                <ArrowDownLeft size={20} color="#0288D1" />
                            </View>
                            <Text style={styles.statLabel}>Income</Text>
                            <Text style={styles.statValue}>{balance.income !== 'Calculating...' ? `+${balance.income}` : '...'}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <View style={[styles.iconBg, { backgroundColor: '#FBE9E7' }]}>
                                <ArrowUpRight size={20} color="#D84315" />
                            </View>
                            <Text style={styles.statLabel}>Expenses</Text>
                            <Text style={styles.statValue}>{balance.expenses !== 'Calculating...' ? `-${balance.expenses}` : '...'}</Text>
                        </View>
                    </View>
                </View>

                {/* Plaid Link Button */}
                <PlaidLink onSuccess={handleSuccess} />

                {/* Quick Actions */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                </View>
                <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.actionItem}>
                        <View style={[styles.actionIcon, { backgroundColor: '#6200EE' }]}>
                            <Plus size={24} color="#FFF" />
                        </View>
                        <Text style={styles.actionText}>Add Bill</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem}>
                        <View style={[styles.actionIcon, { backgroundColor: '#03DAC6' }]}>
                            <CreditCard size={24} color="#000" />
                        </View>
                        <Text style={styles.actionText}>Cards</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem}>
                        <View style={[styles.actionIcon, { backgroundColor: '#FF0266' }]}>
                            <PieChart size={24} color="#FFF" />
                        </View>
                        <Text style={styles.actionText}>Budget</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Transactions */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Transactions</Text>
                    <TouchableOpacity>
                        <Text style={styles.seeAll}>See All</Text>
                    </TouchableOpacity>
                </View>

                {transactions.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                            {accessToken ? 'No recent transactions found.' : 'Connect your bank to see transactions.'}
                        </Text>
                    </View>
                ) : (
                    transactions.map((tx) => (
                        <TouchableOpacity
                            key={tx.id}
                            style={styles.transactionItem}
                            onPress={() => navigation.navigate('TransactionDetails', { transaction: tx })}
                        >
                            <View style={styles.txIcon}>
                                <Wallet size={20} color="#666" />
                            </View>
                            <View style={styles.txInfo}>
                                <Text style={styles.txTitle} numberOfLines={1}>{tx.title}</Text>
                                <Text style={styles.txCategory}>{tx.category}</Text>
                            </View>
                            <View style={styles.txDetails}>
                                <Text style={[styles.txAmount, tx.isIncome ? styles.income : styles.expense]}>
                                    {tx.amount}
                                </Text>
                                <Text style={styles.txDate}>{tx.date}</Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FE',
    },
    scrollContent: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    welcomeText: {
        fontSize: 16,
        color: '#666',
    },
    userName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    profilePlaceholder: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: '#E0E0E0',
    },
    balanceCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    balanceLabel: {
        color: '#AAA',
        fontSize: 14,
        marginBottom: 8,
    },
    balanceAmount: {
        color: '#FFF',
        fontSize: 36,
        fontWeight: '800',
        marginBottom: 24,
    },
    balanceActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#333',
        paddingTop: 20,
    },
    statItem: {
        flexDirection: 'column',
    },
    iconBg: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statLabel: {
        color: '#AAA',
        fontSize: 12,
    },
    statValue: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    seeAll: {
        color: '#6200EE',
        fontWeight: '600',
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    actionItem: {
        alignItems: 'center',
        width: '30%',
    },
    actionIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#444',
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    txIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    txInfo: {
        flex: 1,
    },
    txTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    txCategory: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    txDetails: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    income: {
        color: '#2E7D32',
    },
    expense: {
        color: '#D32F2F',
    },
    txDate: {
        fontSize: 12,
        color: '#AAA',
        marginTop: 2,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyStateText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
    },
});

export default Dashboard;
