import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Dimensions,
    Button
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ChevronDown,
    ChevronUp,
    Plus,
    Bell,
    MoreVertical,
    Menu,
    AlertCircle
} from 'lucide-react-native';
import { create, open } from 'react-native-plaid-link-sdk';
import PlaidLink from '../components/PlaidLink';
import api from '../config/api';
import { saveToken, loadToken } from '../store/TokenStore';

const { width } = Dimensions.get('window');

const Accounts = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [accessToken, setAccessToken] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [selectedFilter, setSelectedFilter] = useState('NET WORTH');
    const [timeFilter, setTimeFilter] = useState('1M');

    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const init = async () => {
            // We now rely on backend storage primarily, but can still load local for legacy or specific cases
            const token = await loadToken();
            if (token) setAccessToken(token);
            // Fetch using whatever backend has, or local token if available
            fetchAccounts(token || undefined);
        };
        init();
    }, []);

    const startSpin = () => {
        spinValue.setValue(0);
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    };

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const fetchAccounts = async (tokenOverride = null) => {
        const params = {};
        if (tokenOverride || accessToken) {
            params.access_token = tokenOverride || accessToken;
        }

        if (accounts.length === 0) setLoading(true);
        startSpin();
        try {
            const response = await api.get('/accounts', { params });
            setAccounts(response.data.accounts || []);
            if (tokenOverride) {
                setAccessToken(tokenOverride);
                await saveToken(tokenOverride); // Save persistently
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
            const msg = error.response ? JSON.stringify(error.response.data) : error.message;
            Alert.alert('Sync Error', `Failed to load accounts.\n\nError: ${msg}`);
        } finally {
            setLoading(false);
            spinValue.stopAnimation();
        }
    };

    const handleSuccess = (token) => {
        console.log('Plaid Link Success, token received');
        fetchAccounts(token);
    };

    const repairConnection = async (itemId) => {
        if (!itemId) return;
        setLoading(true);
        try {
            console.log('Initializing Update Mode for Item ID:', itemId);
            // 1. Get Link Token using Item ID (Backend resolves to correct token)
            const response = await api.post('/create_link_token', { item_id: itemId });
            const linkToken = response.data.link_token;

            // 2. Open Plaid Link
            create({ token: linkToken });
            open({
                token: linkToken,
                onSuccess: (success) => {
                    console.log('Update Mode Success:', success);
                    Alert.alert('Success', 'Connection repaired! refreshing...');
                    // Reload data
                    fetchAccounts();
                },
                onExit: (exit) => {
                    console.log('Update Mode Exited:', exit);
                }
            });
        } catch (error) {
            console.error('Repair failed:', error);
            Alert.alert('Error', 'Could not initialize repair mode.');
        } finally {
            setLoading(false);
        }
    };

    const toggleGroup = useCallback((institutionId) => {
        console.log('Toggling group:', institutionId);
        setExpandedGroups(prev => ({
            ...prev,
            [institutionId]: !prev[institutionId]
        }));
    }, []);

    const handleAccountPress = useCallback((acc) => {
        navigation.navigate('AccountDetails', { account: acc, accessToken });
    }, [navigation, accessToken]);

    const getFilteredAccounts = () => {
        if (selectedFilter === 'NET WORTH') return accounts;

        return accounts.filter(acc => {
            const type = acc.type.toLowerCase();
            const subtype = (acc.subtype || '').toLowerCase();

            if (selectedFilter === 'CASH') {
                return type === 'depository';
            }
            if (selectedFilter === 'CREDIT CARDS') {
                return type === 'credit';
            }
            if (selectedFilter === 'MORTGAGE') {
                return type === 'loan' && (subtype.includes('mortgage') || subtype === 'loan');
            }
            return true;
        });
    };

    const filteredAccounts = getFilteredAccounts();

    // Group filtered accounts by institution
    const groupedAccounts = filteredAccounts.reduce((groups, account) => {
        const institutionName = account.institution_name || 'Bank Account';
        if (!groups[institutionName]) {
            groups[institutionName] = [];
        }
        groups[institutionName].push(account);
        return groups;
    }, {});

    const displayBalance = filteredAccounts.reduce((sum, acc) => {
        const balance = acc.balances.current || 0;
        if (acc.type === 'credit' || acc.type === 'loan') {
            return sum - balance;
        }
        return sum + balance;
    }, 0);

    const displayTitle = selectedFilter === 'NET WORTH' ? 'Net Worth' : selectedFilter.charAt(0) + selectedFilter.slice(1).toLowerCase();


    const FilterTab = ({ label }) => (
        <TouchableOpacity
            style={[styles.filterTab, selectedFilter === label && styles.activeFilterTab]}
            onPress={() => setSelectedFilter(label)}
        >
            <Text style={[styles.filterTabText, selectedFilter === label && styles.activeFilterTabText]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

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

    return (
        <SafeAreaView style={styles.container}>
            {/* Top Toolbar */}
            <View style={styles.toolbar}>
                <TouchableOpacity><Menu size={24} color="#1A1A1A" /></TouchableOpacity>
                <Text style={styles.toolbarTitle}>Accounts</Text>
                <View style={styles.toolbarRight}>
                    <TouchableOpacity style={styles.toolbarIcon}><Bell size={24} color="#F59E0B" /></TouchableOpacity>
                    <TouchableOpacity style={styles.toolbarIcon}><MoreVertical size={24} color="#666" /></TouchableOpacity>
                    <TouchableOpacity style={styles.toolbarIcon}><Plus size={24} color="#1A1A1A" /></TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>


                {/* Net Worth Nav */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navScroll}>
                    <FilterTab label="NET WORTH" />
                    <FilterTab label="CASH" />
                    <FilterTab label="CREDIT CARDS" />
                    <FilterTab label="MORTGAGE" />
                </ScrollView>

                {/* Net Worth Card */}
                <View style={styles.netWorthCard}>
                    <Text style={styles.netWorthAmount}>
                        ${displayBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={styles.netWorthChange}>
                        {displayTitle} balance
                    </Text>
                </View>

                {/* Time Filters */}
                <View style={styles.timeFilterRow}>
                    <TimeBtn label="1M" />
                    <TimeBtn label="3M" />
                    <TimeBtn label="6M" />
                    <TimeBtn label="YTD" />
                    <TimeBtn label="1Y" />
                    <TimeBtn label="ALL" />
                </View>

                {/* Account Groups */}
                {loading && accounts.length === 0 ? (
                    <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 40 }} />
                ) : (
                    Object.entries(groupedAccounts).map(([name, groupAccounts]) => {
                        const isExpanded = !!expandedGroups[name];
                        const groupTotal = groupAccounts.reduce((sum, acc) => sum + (acc.balances.current || 0), 0);

                        return (
                            <View key={name} style={styles.groupContainer}>
                                <TouchableOpacity
                                    style={styles.groupHeader}
                                    onPress={() => toggleGroup(name)}
                                    activeOpacity={0.6}
                                >
                                    <Text style={styles.groupName}>{name}</Text>
                                    <View style={styles.groupHeaderRight}>
                                        <Text style={styles.groupTotal}>
                                            ${groupTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </Text>
                                        {isExpanded ? <ChevronUp size={20} color="#666" /> : <ChevronDown size={20} color="#666" />}
                                    </View>
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View style={styles.accountList}>
                                        {groupAccounts.map((acc) => (
                                            <TouchableOpacity
                                                key={acc.account_id}
                                                style={styles.accountItem}
                                                onPress={() => handleAccountPress(acc)}
                                                activeOpacity={0.5}
                                            >
                                                <View style={styles.accountInfo}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Text style={styles.accountItemName}>{acc.name}</Text>
                                                        {(() => {
                                                            const lastUpdated = acc.balances.last_updated_datetime;
                                                            const hasError = !!acc.error_code;

                                                            if (hasError) {
                                                                return (
                                                                    <TouchableOpacity onPress={() => repairConnection(acc.item_id)}>
                                                                        <AlertCircle size={14} color="#EF4444" style={{ marginLeft: 6 }} />
                                                                    </TouchableOpacity>
                                                                );
                                                            }

                                                            if (lastUpdated) {
                                                                const diff = new Date() - new Date(lastUpdated);
                                                                const hours = diff / (1000 * 60 * 60);
                                                                if (hours > 24) {
                                                                    return <AlertCircle size={14} color="#EF4444" style={{ marginLeft: 6 }} />;
                                                                }
                                                            }
                                                            return null;
                                                        })()}
                                                    </View>
                                                    <Text style={styles.accountItemType}>{acc.subtype || acc.type} •••• {acc.mask}</Text>
                                                </View>
                                                <Text style={styles.accountItemBalance}>
                                                    ${acc.balances.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}

                {/* Add Account Button */}
                <View style={styles.addSection}>
                    <PlaidLink onSuccess={handleSuccess} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFF',
    },
    toolbarTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        marginLeft: 40,
    },
    toolbarRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toolbarIcon: {
        marginLeft: 16,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    navScroll: {
        paddingHorizontal: 16,
        marginVertical: 12,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 20,
    },
    activeFilterTab: {
        backgroundColor: '#F3F4F6',
    },
    filterTabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    activeFilterTabText: {
        color: '#1A1A1A',
    },
    netWorthCard: {
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    netWorthAmount: {
        fontSize: 36,
        fontWeight: '800',
        color: '#1A1A1A',
    },
    netWorthChange: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 4,
    },
    timeFilterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    timeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 10,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
    },
    activeTimeBtn: {
        backgroundColor: '#F3F4F6',
    },
    timeBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    activeTimeBtnText: {
        color: '#1A1A1A',
    },
    groupContainer: {
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    groupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    groupName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    groupHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    groupTotal: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6366F1',
        marginRight: 12,
    },
    accountList: {
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#FAFAFA',
    },
    accountItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    accountInfo: {
        flex: 1,
    },
    accountItemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    accountItemType: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    accountItemBalance: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    addSection: {
        marginTop: 20,
        paddingHorizontal: 16,
    },
});

export default Accounts;
