import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView, Alert } from 'react-native';
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

const Transactions = ({ navigation }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState(null);
    const [selectedTab, setSelectedTab] = useState('CATEGORIES');
    const TABS = ['CATEGORIES', 'MERCHANTS', 'DAILY', 'MONTHLY', 'RECURRING', 'TRANSFERS'];

    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            fetchTransactions();
        }
    }, [isFocused]);

    const fetchTransactions = async (forceSync = false) => {
        const params = {};
        if (forceSync || (typeof forceSync === 'object' && forceSync.nativeEvent)) {
            params.sync = 'true';
        }

        if (transactions.length === 0) setLoading(true);
        try {
            const response = await api.get('/transactions', { params });
            const txs = response.data.transactions || [];
            setTransactions(txs);
        } catch (error) {
            console.log('Fetching transactions error:', error.message);
            Alert.alert('Refresh Error', 'Failed to fetch the latest transactions.');
        } finally {
            setLoading(false);
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
                    <TouchableOpacity style={styles.iconBtn} onPress={fetchTransactions}>
                        <RefreshCw size={22} color="#0EA5E9" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}>
                        <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>
                        <Filter size={22} color="#0EA5E9" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}><Search size={22} color="#0EA5E9" /></TouchableOpacity>
                </View>
            </View>

            {/* Sub-Tabs */}
            <View style={styles.tabsContainer}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabItem, selectedTab === tab && styles.tabItemActive]}
                        onPress={() => setSelectedTab(tab)}
                    >
                        <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 50 }} />
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        refreshControl={
                            <RefreshControl refreshing={loading} onRefresh={() => fetchTransactions(true)} tintColor="#0EA5E9" />
                        }
                    >
                        {selectedTab === 'CATEGORIES' && <CategoriesTab key={`cat-${transactions.length}`} transactions={transactions} navigation={navigation} />}
                        {selectedTab === 'MERCHANTS' && <MerchantsTab key={`mer-${transactions.length}`} transactions={transactions} navigation={navigation} />}
                        {selectedTab === 'DAILY' && <DailyTab key={`dai-${transactions.length}`} transactions={transactions} navigation={navigation} />}
                        {selectedTab === 'MONTHLY' && <MonthlyTab key={`mon-${transactions.length}`} transactions={transactions} navigation={navigation} />}
                        {selectedTab === 'RECURRING' && <RecurringTab key={`rec-${transactions.length}`} transactions={transactions} navigation={navigation} />}
                        {selectedTab === 'TRANSFERS' && <TransfersTab key={`tra-${transactions.length}`} transactions={transactions} navigation={navigation} />}
                    </ScrollView>
                )}
            </View>
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
