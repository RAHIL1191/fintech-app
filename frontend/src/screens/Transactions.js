import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView, Alert, Dimensions, useWindowDimensions } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Search, RefreshCw, Filter } from 'lucide-react-native';
import { getToken, loadToken } from '../store/TokenStore';
import api from '../config/api';
import CategoriesTab from '../components/transactions/CategoriesTab';
import MerchantsTab from '../components/transactions/MerchantsTab';
import DailyTab from '../components/transactions/DailyTab';
import MonthlyTab from '../components/transactions/MonthlyTab';
import RecurringTab from '../components/transactions/RecurringTab';
import TransfersTab from '../components/transactions/TransfersTab';

import TransactionFilterModal from '../components/TransactionFilterModal';

const Transactions = ({ navigation }) => {
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [activeFilters, setActiveFilters] = useState({});

    // Derived state for categories
    const availableCategories = React.useMemo(() => {
        const cats = new Set();
        transactions.forEach(t => {
            if (Array.isArray(t.category)) t.category.forEach(c => cats.add(c));
            else if (t.category) cats.add(t.category);
        });
        return Array.from(cats).sort();
    }, [transactions]);

    const [selectedTab, setSelectedTab] = useState('CATEGORIES');
    const TABS = ['CATEGORIES', 'MERCHANTS', 'DAILY', 'MONTHLY', 'RECURRING', 'TRANSFERS'];
    const { width } = useWindowDimensions();
    const scrollRef = useRef(null);
    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            fetchData();
        }
    }, [isFocused]);

    // Re-apply filters when transactions or activeFilters change
    useEffect(() => {
        applyFilters();
    }, [transactions, activeFilters]);

    const fetchData = async (forceSync = false) => {
        const params = {};
        if (forceSync || (typeof forceSync === 'object' && forceSync.nativeEvent)) {
            params.sync = 'true';
        }

        if (transactions.length === 0) setLoading(true);
        try {
            const [txRes, accRes] = await Promise.all([
                api.get('/transactions', { params }),
                api.get('/accounts')
            ]);

            setTransactions(txRes.data.transactions || []);
            setAccounts(accRes.data.accounts || []);
        } catch (error) {
            console.log('Fetching data error:', error.message);
            Alert.alert('Refresh Error', 'Failed to fetch the latest data.');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let result = [...transactions];
        const f = activeFilters;

        if (!f || Object.keys(f).length === 0) {
            setFilteredTransactions(result);
            return;
        }

        // 1. Type
        if (f.type && f.type !== 'All') {
            if (f.type === 'Expenses') {
                result = result.filter(t => t.amount > 0 && !t.is_transfer);
            } else if (f.type === 'Income') {
                result = result.filter(t => t.amount < 0 && !t.is_transfer);
            } else if (f.type === 'Transfer') {
                result = result.filter(t => t.is_transfer);
            }
        }

        // 2. Categories
        if (f.categories && f.categories.length > 0) {
            result = result.filter(t => {
                const tCats = Array.isArray(t.category) ? t.category : [t.category];
                return tCats.some(c => f.categories.includes(c));
            });
        }

        // 3. Accounts
        if (f.accounts && f.accounts.length > 0) {
            result = result.filter(t => f.accounts.includes(t.account_id));
        }

        // 4. Date Range
        if (f.dateRange) {
            const { start, end } = f.dateRange;
            if (start) {
                const s = new Date(start).toISOString().split('T')[0];
                result = result.filter(t => t.date >= s);
            }
            if (end) {
                const e = new Date(end).toISOString().split('T')[0];
                result = result.filter(t => t.date <= e);
            }
        }

        // 5. Amount
        if (f.amountRange) {
            const min = parseFloat(f.amountRange.min);
            const max = parseFloat(f.amountRange.max);
            result = result.filter(t => {
                const absAmount = Math.abs(t.amount);
                if (!isNaN(min) && absAmount < min) return false;
                if (!isNaN(max) && absAmount > max) return false;
                return true;
            });
        }

        // 6. Notes (Note, Name, or Merchant Name)
        if (f.note) {
            const q = f.note.toLowerCase();
            result = result.filter(t =>
                (t.note && t.note.toLowerCase().includes(q)) ||
                (t.name && t.name.toLowerCase().includes(q)) ||
                (t.merchant_name && t.merchant_name.toLowerCase().includes(q))
            );
        }

        setFilteredTransactions(result);
    };

    const getActiveFilterCount = () => {
        let count = 0;
        if (activeFilters.type && activeFilters.type !== 'All') count++;
        if (activeFilters.categories?.length > 0) count++;
        if (activeFilters.accounts?.length > 0) count++;
        if (activeFilters.dateRange?.start || activeFilters.dateRange?.end) count++;
        if (activeFilters.amountRange?.min || activeFilters.amountRange?.max) count++;
        if (activeFilters.note) count++;
        return count;
    };

    const handleTabPress = (index) => {
        setSelectedTab(TABS[index]);
        scrollRef.current?.scrollTo({ x: index * width, animated: true });
    };

    const handleScroll = (event) => {
        const x = event.nativeEvent.contentOffset.x;
        const index = Math.round(x / width);
        if (TABS[index] && TABS[index] !== selectedTab) {
            setSelectedTab(TABS[index]);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Top Toolbar */}
            <View style={styles.toolbar}>
                <TouchableOpacity onPress={() => navigation.openDrawer && navigation.openDrawer()}>
                    <Menu size={24} color="#0EA5E9" />
                </TouchableOpacity>
                <Text style={styles.toolbarTitle}>Transactions</Text>
                <View style={styles.toolbarRight}>


                    <TouchableOpacity style={styles.iconBtn} onPress={() => setFilterModalVisible(true)}>
                        {getActiveFilterCount() > 0 && (
                            <View style={styles.badge}><Text style={styles.badgeText}>{getActiveFilterCount()}</Text></View>
                        )}
                        <Filter size={22} color="#0EA5E9" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}><Search size={22} color="#0EA5E9" /></TouchableOpacity>
                </View>
            </View>

            {/* Sub-Tabs */}
            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {TABS.map((tab, idx) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabItem, selectedTab === tab && styles.tabItemActive]}
                            onPress={() => handleTabPress(idx)}
                        >
                            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                {loading && transactions.length === 0 ? (
                    <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 50 }} />
                ) : (
                    <ScrollView
                        ref={scrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={handleScroll}
                        scrollEventThrottle={16}
                    >
                        <View style={{ width }}>
                            <CategoriesTab transactions={filteredTransactions} navigation={navigation} onRefresh={() => fetchData(true)} refreshing={loading} />
                        </View>
                        <View style={{ width }}>
                            <MerchantsTab transactions={filteredTransactions} navigation={navigation} onRefresh={() => fetchData(true)} refreshing={loading} />
                        </View>
                        <View style={{ width }}>
                            <DailyTab transactions={filteredTransactions} navigation={navigation} onRefresh={() => fetchData(true)} refreshing={loading} />
                        </View>
                        <View style={{ width }}>
                            <MonthlyTab transactions={filteredTransactions} navigation={navigation} onRefresh={() => fetchData(true)} refreshing={loading} />
                        </View>
                        <View style={{ width }}>
                            <RecurringTab transactions={filteredTransactions} navigation={navigation} onRefresh={() => fetchData(true)} refreshing={loading} />
                        </View>
                        <View style={{ width }}>
                            <TransfersTab transactions={filteredTransactions} navigation={navigation} onRefresh={() => fetchData(true)} refreshing={loading} />
                        </View>
                    </ScrollView>
                )}
            </View>

            <TransactionFilterModal
                visible={filterModalVisible}
                onClose={() => setFilterModalVisible(false)}
                onApply={setActiveFilters}
                initialFilters={activeFilters}
                availableCategories={availableCategories}
                availableAccounts={accounts}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#071021', // Deep Dark Blue Background
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#0F2441', // Slightly lighter header
    },
    toolbarTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
        marginLeft: 40, // Balance the left Menu icon
    },
    toolbarRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        marginLeft: 16,
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#EF4444',
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#0F2441', // Header BG
        paddingHorizontal: 4,
    },
    tabItem: {
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {
        borderBottomColor: '#0EA5E9',
    },
    tabText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    tabTextActive: {
        color: '#0EA5E9',
    },
    content: {
        flex: 1,
        backgroundColor: '#071021',
    },
    placeholderBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: '#64748B',
        fontSize: 16,
    }
});

export default Transactions;
