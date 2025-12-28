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
    Button,
    RefreshControl,
    Switch
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
    const [includeMortgage, setIncludeMortgage] = useState(false);

    const formatCurrency = (amount) => {
        const isNegative = amount < 0;
        const absAmount = Math.abs(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return `${isNegative ? '-' : ''}$${absAmount}`;
    };

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

    const fetchAccounts = async (tokenOverride = null, forceSync = false) => {
        const params = {};
        if (tokenOverride || accessToken) {
            params.access_token = tokenOverride || accessToken;
        }
        if (forceSync) {
            params.sync = 'true';
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

    const removeItem = async (itemId) => {
        Alert.alert(
            "Remove Connection",
            "Are you sure you want to remove this bank connection? This will stop all tracking and remove accounts from your view. You can add it back anytime.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await api.post('/item/delete', { item_id: itemId });
                            Alert.alert("Success", "Connection removed.");
                            fetchAccounts();
                        } catch (error) {
                            console.error('Delete failed:', error);
                            Alert.alert("Error", "Failed to remove connection.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleItemOptions = (itemId) => {
        if (!itemId) return;
        Alert.alert(
            "Connection Options",
            "What would you like to do with this connection?",
            [
                { text: "Update Connection (Relink)", onPress: () => repairConnection(itemId) },
                { text: "Remove Connection", onPress: () => removeItem(itemId), style: "destructive" },
                { text: "Cancel", style: "cancel" }
            ]
        );
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
                    Alert.alert('Success', 'Connection updated. syncing latest data...');
                    // Reload data with force sync
                    fetchAccounts(null, true);
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
        let institutionName = account.institution_name || 'Bank Account';
        if (institutionName === 'BMO Bank of Montreal') {
            institutionName = 'BMO';
        }

        if (!groups[institutionName]) {
            groups[institutionName] = [];
        }
        groups[institutionName].push(account);
        return groups;
    }, {});

    const displayBalance = filteredAccounts.reduce((sum, acc) => {
        const balance = acc.balances.current || 0;
        const type = acc.type.toLowerCase();
        const subtype = (acc.subtype || '').toLowerCase();

        // If this is Net Worth view, apply mortgage exclusion logic
        if (selectedFilter === 'NET WORTH') {
            const isMortgage = subtype.includes('mortgage') || (type === 'loan' && subtype === 'loan');
            if (isMortgage && !includeMortgage) {
                return sum; // Skip this debt
            }
        }

        if (type === 'credit' || type === 'loan') {
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
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={() => fetchAccounts(null, true)} />
                }
            >


                {/* Net Worth Nav */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navScroll}>
                    <FilterTab label="NET WORTH" />
                    <FilterTab label="CASH" />
                    <FilterTab label="CREDIT CARDS" />
                    <FilterTab label="MORTGAGE" />
                </ScrollView>

                {/* Net Worth Card */}
                <View style={styles.netWorthCard}>
                    <View style={styles.netWorthHeader}>
                        <View>
                            <Text style={styles.netWorthAmount}>
                                {formatCurrency(displayBalance)}
                            </Text>
                            <Text style={styles.netWorthChange}>
                                {displayTitle} balance
                            </Text>
                        </View>

                        {selectedFilter === 'NET WORTH' && (
                            <View style={styles.mortgageToggleContainer}>
                                <Text style={styles.mortgageToggleLabel}>Include Mortgage</Text>
                                <Switch
                                    value={includeMortgage}
                                    onValueChange={setIncludeMortgage}
                                    trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
                                    thumbColor="#FFF"
                                />
                            </View>
                        )}
                    </View>
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
                        const groupTotal = groupAccounts.reduce((sum, acc) => {
                            const balance = acc.balances.current || 0;
                            // For totals, we treat credit/loans as debt (negative) only in Net Worth, 
                            // but usually per-bank total is just sum of balances? 
                            // Actually, standard practice for "Bank Total" is sum, let's keep it simple or follow net worth logic.
                            if (acc.type === 'credit' || acc.type === 'loan') return sum - balance;
                            return sum + balance;
                        }, 0);

                        const itemId = groupAccounts[0]?.item_id;

                        return (
                            <View key={name} style={styles.bankCard}>
                                <TouchableOpacity
                                    style={styles.bankHeader}
                                    onPress={() => toggleGroup(name)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.bankHeaderLeft}>
                                        <View style={styles.bankIconPlaceholder}>
                                            <Text style={styles.bankIconText}>{name.charAt(0)}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.bankName}>{name}</Text>
                                            <Text style={styles.bankSubtext}>{groupAccounts.length} accounts</Text>
                                        </View>
                                    </View>

                                    <View style={styles.bankHeaderRight}>
                                        <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
                                            <Text style={[styles.bankTotal, { color: groupTotal < 0 ? '#EF4444' : '#6366F1' }]}>
                                                {formatCurrency(groupTotal)}
                                            </Text>
                                            <Text style={styles.bankStatus}>Current Balance</Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => handleItemOptions(itemId)}
                                            style={styles.settingsBtn}
                                        >
                                            <MoreVertical size={20} color="#64748B" />
                                        </TouchableOpacity>
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
                                                            const hasError = !!acc.error_code;
                                                            if (hasError) return <AlertCircle size={14} color="#EF4444" style={{ marginLeft: 6 }} />;
                                                            return null;
                                                        })()}
                                                    </View>
                                                    <Text style={styles.accountItemType}>{acc.subtype || acc.type} •••• {acc.mask}</Text>
                                                </View>
                                                <Text style={[styles.accountItemBalance, { color: (acc.type === 'credit' || acc.type === 'loan') ? '#EF4444' : '#1A1A1A' }]}>
                                                    {formatCurrency(acc.balances.current)}
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
        textAlign: 'left',
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1A1A',
        marginLeft: 10,
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
    netWorthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    netWorthAmount: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1A1A1A',
    },
    netWorthChange: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 4,
    },
    mortgageToggleContainer: {
        alignItems: 'center',
    },
    mortgageToggleLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 4,
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
    bankCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: '#FFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
    },
    bankHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
    },
    bankHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bankIconPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    bankIconText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#6366F1',
    },
    bankName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    bankSubtext: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    bankHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bankTotal: {
        fontSize: 18,
        fontWeight: '800',
        color: '#6366F1',
    },
    bankStatus: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    settingsBtn: {
        padding: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
    },
    accountList: {
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    accountItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingLeft: 20,
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
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    addSection: {
        marginTop: 20,
        paddingHorizontal: 16,
    },
});

export default Accounts;
