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
import { LineChart } from "react-native-gifted-charts";
import { LinearGradient } from 'expo-linear-gradient';
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
    const [chartData, setChartData] = useState([]);
    const [originalChartData, setOriginalChartData] = useState([]);
    const [chartScale, setChartScale] = useState({ min: 0, max: 100 });

    useEffect(() => {
        fetchAccountTransactions();
    }, []);

    const fetchAccountTransactions = async () => {
        setLoading(true);
        try {
            // Force sync to get freshest transactions from Plaid
            const response = await api.get('/transactions', { params: { sync: 'true' } });

            // Filter transactions for this specific account
            const accountTransactions = response.data.transactions?.filter(
                t => t.account_id === account.account_id
            ) || [];

            setTransactions(accountTransactions.slice(0, 5)); // Show recent 5
            calculateHistory(accountTransactions, account.balances.current);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateHistory = (allTxs, currentBalance) => {
        const sorted = [...allTxs].sort((a, b) => new Date(b.date) - new Date(a.date));
        let runningBalance = currentBalance;
        const history = [];

        // Today
        history.push({
            value: runningBalance,
            date: new Date(),
        });

        sorted.forEach(t => {
            runningBalance += t.amount;
            history.push({
                value: runningBalance,
                date: new Date(t.date),
            });
        });

        const finalData = history.reverse().map(item => ({
            value: item.value,
            date: item.date,
        }));

        setOriginalChartData(finalData);
        applyTimeFilter(finalData, '1M');
    };

    const applyTimeFilter = (data, filter) => {
        setTimeFilter(filter);
        if (!data || data.length === 0) return;

        const now = new Date();
        now.setHours(23, 59, 59, 999);
        let cutoff = new Date();

        if (filter === '1M') cutoff.setMonth(now.getMonth() - 1);
        else if (filter === '3M') cutoff.setMonth(now.getMonth() - 3);
        else if (filter === '6M') cutoff.setMonth(now.getMonth() - 6);
        else if (filter === 'YTD') cutoff = new Date(now.getFullYear(), 0, 1);
        else if (filter === '1Y') cutoff.setFullYear(now.getFullYear() - 1);
        else if (filter === 'ALL') cutoff = new Date(0);

        // Filter data points within range
        const pointsInRange = data.filter(d => d.date >= cutoff || d === data[data.length - 1]);

        // INTERPOLATION: Create a point for every single day to make the line look premium
        const dailyPoints = [];
        const iterDate = new Date(cutoff > data[0].date ? cutoff : data[0].date);
        iterDate.setHours(0, 0, 0, 0);

        while (iterDate <= now) {
            // Find the balance for this day (the most recent point before or on this day)
            const balanceAtDate = data.reduce((prev, curr) => {
                return (curr.date <= iterDate) ? curr : prev;
            }, data[0]);

            dailyPoints.push({
                value: balanceAtDate.value,
                date: new Date(iterDate)
            });
            iterDate.setDate(iterDate.getDate() + 1);
        }

        if (dailyPoints.length > 0) {
            const values = dailyPoints.map(d => d.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min;
            const padding = range * 0.2 || 20; // 20% vertical padding

            setChartScale({
                min: min - padding,
                max: max + padding
            });
            setChartData(dailyPoints.map(d => ({ value: d.value })));
        } else {
            setChartData([]);
        }
    };

    const TimeBtn = ({ label }) => (
        <TouchableOpacity
            style={[styles.timeBtn, timeFilter === label && styles.activeTimeBtn]}
            onPress={() => applyTimeFilter(originalChartData, label)}
        >
            <Text style={[styles.timeBtnText, timeFilter === label && styles.activeTimeBtnText]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const getTimeAgo = (timestamp) => {
        if (!timestamp) return 'Never';
        const now = new Date();
        const past = new Date(timestamp);
        const diffInMs = now - past;
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInMins < 1) return 'Just now';
        if (diffInMins < 60) return `${diffInMins} ${diffInMins === 1 ? 'minute' : 'minutes'} ago`;
        if (diffInHours < 24) return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
        return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    };

    const getHoursSince = (timestamp) => {
        if (!timestamp) return 'N/A';
        const diffInMs = new Date() - new Date(timestamp);
        return (diffInMs / (1000 * 60 * 60)).toFixed(1);
    };

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
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

                {/* Balance Section */}
                <View style={styles.balanceSection}>
                    <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
                    <Text style={styles.balanceAmount}>
                        ${account.balances.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={styles.balanceChange}>$0.00 (0%) 1 month</Text>
                </View>

                {/* Graph Container */}
                <View style={styles.graphContainer}>
                    <View style={styles.graphBox}>
                        {chartData.length > 0 ? (
                            <LineChart
                                data={chartData}
                                height={100}
                                width={width - 48} // Match padding
                                initialSpacing={0}
                                endSpacing={0}
                                spacing={(width - 48) / (chartData.length > 1 ? chartData.length - 1 : 1)}
                                color="#2563EB"
                                thickness={2.5}
                                hideDataPoints
                                hideRules
                                hideYAxisText
                                hideAxesAndRules
                                curved
                                curvature={0.15} // Reduced to prevent overshoot
                                yAxisOffset={chartScale.min}
                                maxValue={chartScale.max - chartScale.min}
                                areaChart
                                startFillColor="#3B82F6"
                                startOpacity={0.4}
                                endFillColor="#3B82F6"
                                endOpacity={0.01}
                                isAnimated
                                animationDuration={800}
                                // Interactive features
                                pointerConfig={{
                                    pointerStripColor: '#2563EB',
                                    pointerStripWidth: 1,
                                    pointerColor: '#2563EB',
                                    radius: 4,
                                    pointerLabelComponent: items => null, // Just the line for now
                                }}
                            />
                        ) : (
                            <ActivityIndicator size="small" color="#6366F1" />
                        )}
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
                    <TouchableOpacity
                        style={styles.viewAllBtn}
                        onPress={() => navigation.navigate('AccountTransactions', { account })}
                    >
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
                        <Text style={styles.statusValueText}>
                            {getTimeAgo(account.balances.last_updated_datetime)}
                        </Text>
                    </View>
                    <View style={styles.statusItem}>
                        <View style={styles.statusLabelRow}>
                            <Clock
                                size={14}
                                color={parseFloat(getHoursSince(account.balances.last_updated_datetime)) > 24 ? '#EF4444' : '#10B981'}
                            />
                            <Text style={styles.statusLabelText}>Time since sync</Text>
                        </View>
                        <Text style={styles.statusValueText}>
                            {getHoursSince(account.balances.last_updated_datetime)} hours
                        </Text>
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
        justifyContent: 'flex-end',
        alignItems: 'center',
        overflow: 'hidden',
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
