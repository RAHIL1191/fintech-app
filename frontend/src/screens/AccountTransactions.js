import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Modal,
    Switch,
    Dimensions,
    Keyboard,
    Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ChevronLeft,
    Search,
    Filter,
    X,
    CreditCard,
    ChevronDown,
    ArrowUpDown,
    Calendar,
    Tag,
    DollarSign,
    Layers,
    User,
    Check
} from 'lucide-react-native';
import api from '../config/api';

const { height } = Dimensions.get('window');

const AccountTransactions = ({ route, navigation }) => {
    const { account } = route.params;
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFilterVisible, setIsFilterVisible] = useState(false);

    // Filter Logic States
    const [expandedSection, setExpandedSection] = useState(null); // 'SORT BY' | 'AMOUNTS' | null
    const [tempFilters, setTempFilters] = useState({
        dateRange: 'All time',
        sortBy: 'Date (new to old)',
        categories: [], // Empty array for multi-select
        merchants: [],  // Empty array for multi-select
        amounts: [],    // Empty array for multi-select
    });

    const [activeFilters, setActiveFilters] = useState({ ...tempFilters });

    // Modals visibility
    const [showDateRangeModal, setShowDateRangeModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showMerchantModal, setShowMerchantModal] = useState(false);

    // Data for selectors
    const [categories, setCategories] = useState([]);
    const [merchants, setMerchants] = useState([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [merchantSearch, setMerchantSearch] = useState('');

    useEffect(() => {
        fetchTransactions();
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [catRes, merRes] = await Promise.all([
                api.get('/categories'),
                api.get('/merchants')
            ]);
            setCategories(catRes.data || []);
            setMerchants(merRes.data.merchants || []);
        } catch (error) {
            console.error('Error fetching filter metadata:', error);
        }
    };

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const response = await api.get('/transactions');
            const txs = response.data.transactions?.filter(
                t => t.account_id === account.account_id
            ) || [];
            setTransactions(txs);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        const isNegative = amount > 0; // In Plaid, positive amount is often a debit (expense)
        const absAmount = Math.abs(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return `${isNegative ? '-' : '+'}$${absAmount}`;
    };

    const filteredAndGroupedTransactions = useMemo(() => {
        let filtered = [...transactions];

        // 1. Search (Merchant name or description)
        if (searchQuery) {
            filtered = filtered.filter(t =>
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.merchant_name && t.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        // 2. Date Range Filter
        if (activeFilters.dateRange !== 'All time') {
            const now = new Date();
            const pastDate = new Date();
            let applyFilter = true;

            if (activeFilters.dateRange === 'Last 7 days') pastDate.setDate(now.getDate() - 7);
            else if (activeFilters.dateRange === 'Last 14 days') pastDate.setDate(now.getDate() - 14);
            else if (activeFilters.dateRange === 'Last 30 days') pastDate.setDate(now.getDate() - 30);
            else if (activeFilters.dateRange === 'Last 60 days') pastDate.setDate(now.getDate() - 60);
            else if (activeFilters.dateRange === 'This month') pastDate.setDate(1);
            else if (activeFilters.dateRange === 'Last month') {
                pastDate.setMonth(now.getMonth() - 1);
                pastDate.setDate(1);
                const endPastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                filtered = filtered.filter(t => {
                    const d = new Date(t.date);
                    return d >= pastDate && d <= endPastMonth;
                });
                applyFilter = false;
            } else if (activeFilters.dateRange === 'This year') {
                pastDate.setMonth(0, 1);
            } else if (activeFilters.dateRange === 'Last year') {
                pastDate.setFullYear(now.getFullYear() - 1, 0, 1);
                const endLastYear = new Date(now.getFullYear() - 1, 11, 31);
                filtered = filtered.filter(t => {
                    const d = new Date(t.date);
                    return d >= pastDate && d <= endLastYear;
                });
                applyFilter = false;
            }

            if (applyFilter) {
                filtered = filtered.filter(t => new Date(t.date) >= pastDate);
            }
        }

        // 3. Category Filter (Multi-select)
        if (activeFilters.categories.length > 0) {
            filtered = filtered.filter(t => {
                const primary = t.personal_finance_category?.primary;
                return activeFilters.categories.some(cat =>
                    t.category?.includes(cat) || primary === cat
                );
            });
        }

        // 4. Merchant Filter (Multi-select)
        if (activeFilters.merchants.length > 0) {
            filtered = filtered.filter(t =>
                activeFilters.merchants.includes(t.merchant_name || t.name)
            );
        }

        // 5. Amount Range Filter (Multi-select)
        if (activeFilters.amounts.length > 0) {
            filtered = filtered.filter(t => {
                const amt = Math.abs(t.amount);
                return activeFilters.amounts.some(range => {
                    if (range === '$0 - $50') return amt >= 0 && amt <= 50;
                    if (range === '$50 - $100') return amt > 50 && amt <= 100;
                    if (range === '$100 - $500') return amt > 100 && amt <= 500;
                    if (range === '$500+') return amt > 500;
                    return false;
                });
            });
        }

        // 6. Sorting
        filtered.sort((a, b) => {
            if (activeFilters.sortBy === 'Date (new to old)') return new Date(b.date) - new Date(a.date);
            if (activeFilters.sortBy === 'Date (old to new)') return new Date(a.date) - new Date(b.date);
            if (activeFilters.sortBy === 'Amount (high to low)') return Math.abs(b.amount) - Math.abs(a.amount);
            if (activeFilters.sortBy === 'Amount (low to high)') return Math.abs(a.amount) - Math.abs(b.amount);
            return new Date(b.date) - new Date(a.date);
        });

        // 7. Grouping (unless we are sorting by amount, then grouping by date is weird)
        if (activeFilters.sortBy.includes('Amount')) {
            return [['Results', filtered]];
        }

        const groups = {};
        filtered.forEach(t => {
            const dateStr = new Date(t.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(t);
        });

        return Object.entries(groups);
    }, [transactions, searchQuery, activeFilters]);

    const handleApply = () => {
        setActiveFilters({ ...tempFilters });
        setIsFilterVisible(false);
        Keyboard.dismiss();
    };

    const handleClear = () => {
        const reset = {
            dateRange: 'All time',
            sortBy: 'Date (new to old)',
            categories: [],
            merchants: [],
            amounts: [],
        };
        setTempFilters(reset);
        setActiveFilters(reset);
    };

    const appliedFilterCount = useMemo(() => {
        let count = 0;
        if (activeFilters.dateRange !== 'All time') count++;
        if (activeFilters.sortBy !== 'Date (new to old)') count++;
        if (activeFilters.categories.length > 0) count++;
        if (activeFilters.merchants.length > 0) count++;
        if (activeFilters.amounts.length > 0) count++;
        return count;
    }, [activeFilters]);

    const FilterItem = ({ label, value, icon: Icon, onPress, isExpanded }) => (
        <View>
            <TouchableOpacity style={styles.filterRow} onPress={onPress}>
                <View style={styles.filterRowLeft}>
                    <Icon size={18} color="#94A3B8" style={{ marginRight: 12 }} />
                    <Text style={styles.filterLabelText}>{label}</Text>
                </View>
                <View style={styles.filterRowRight}>
                    {value && (
                        <Text style={styles.filterValueText} numberOfLines={1}>
                            {Array.isArray(value) ? (value.length > 0 ? `${value.length} selected` : 'All') : value}
                        </Text>
                    )}
                    <ChevronDown
                        size={18}
                        color={isExpanded ? "#F59E0B" : "#94A3B8"}
                        style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                    />
                </View>
            </TouchableOpacity>
        </View>
    );

    const SelectOption = ({ label, isSelected, onSelect }) => (
        <TouchableOpacity style={styles.optionRow} onPress={onSelect}>
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{label}</Text>
            {isSelected && <View style={styles.optionDot} />}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header / Search Bar */}
            <View style={styles.topContainer}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ChevronLeft size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        5360 xxxx xxxx {account.mask}
                    </Text>
                </View>

                <View style={styles.searchBarContainer}>
                    <View style={styles.searchBox}>
                        <Search size={20} color="#94A3B8" />
                        <TextInput
                            placeholder="Search"
                            placeholderTextColor="#64748B"
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <TouchableOpacity onPress={() => {
                            setIsFilterVisible(true);
                            Keyboard.dismiss();
                        }}>
                            <View style={styles.filterIconBadge}>
                                <Filter size={18} color="#F59E0B" />
                                {appliedFilterCount > 0 && (
                                    <View style={styles.badgeSmall}>
                                        <Text style={styles.badgeTextSmall}>{appliedFilterCount}</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#6366F1" />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContent}>
                    {filteredAndGroupedTransactions.map(([date, items]) => (
                        <View key={date}>
                            <Text style={styles.dateHeader}>{date}</Text>
                            {items.map(item => (
                                <TouchableOpacity key={item.transaction_id} style={styles.transactionItem}>
                                    <View style={styles.iconContainer}>
                                        <CreditCard size={18} color="#FFF" />
                                    </View>
                                    <Text style={styles.merchantText} numberOfLines={1}>{item.merchant_name || item.name}</Text>
                                    <Text style={[
                                        styles.amountText,
                                        { color: item.amount > 0 ? '#EF4444' : '#10B981' }
                                    ]}>
                                        {formatCurrency(item.amount)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                    {filteredAndGroupedTransactions.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No transactions found</Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Filter Modal */}
            <Modal
                visible={isFilterVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsFilterVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filters</Text>
                            <TouchableOpacity onPress={() => {
                                setIsFilterVisible(false);
                                Keyboard.dismiss();
                            }}>
                                <X size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* DATE RANGE */}
                            <FilterItem
                                label="DATE RANGE"
                                value={tempFilters.dateRange}
                                icon={Calendar}
                                onPress={() => setShowDateRangeModal(true)}
                            />

                            {/* SORT BY */}
                            <FilterItem
                                label="SORT BY"
                                icon={ArrowUpDown}
                                isExpanded={expandedSection === 'SORT BY'}
                                onPress={() => setExpandedSection(expandedSection === 'SORT BY' ? null : 'SORT BY')}
                            />
                            {expandedSection === 'SORT BY' && (
                                <View style={styles.expandedContent}>
                                    {['Date (new to old)', 'Date (old to new)', 'Amount (high to low)', 'Amount (low to high)'].map(opt => (
                                        <SelectOption
                                            key={opt}
                                            label={opt}
                                            isSelected={tempFilters.sortBy === opt}
                                            onSelect={() => setTempFilters({ ...tempFilters, sortBy: opt })}
                                        />
                                    ))}
                                </View>
                            )}

                            {/* ACCOUNTS (Disabled/Static since we're in one account) */}
                            <FilterItem label="ACCOUNTS" value={account.name} icon={CreditCard} />

                            {/* CATEGORIES */}
                            <FilterItem
                                label="CATEGORIES"
                                value={tempFilters.categories}
                                icon={Layers}
                                onPress={() => setShowCategoryModal(true)}
                            />

                            {/* MERCHANTS */}
                            <FilterItem
                                label="MERCHANTS"
                                value={tempFilters.merchants}
                                icon={User}
                                onPress={() => setShowMerchantModal(true)}
                            />

                            {/* AMOUNTS */}
                            <FilterItem
                                label="AMOUNTS"
                                icon={DollarSign}
                                isExpanded={expandedSection === 'AMOUNTS'}
                                onPress={() => setExpandedSection(expandedSection === 'AMOUNTS' ? null : 'AMOUNTS')}
                            />
                            {expandedSection === 'AMOUNTS' && (
                                <View style={styles.expandedContent}>
                                    {['$0 - $50', '$50 - $100', '$100 - $500', '$500+'].map(opt => (
                                        <SelectOption
                                            key={opt}
                                            label={opt}
                                            isSelected={tempFilters.amounts.includes(opt)}
                                            onSelect={() => {
                                                const current = tempFilters.amounts;
                                                const next = current.includes(opt)
                                                    ? current.filter(x => x !== opt)
                                                    : [...current, opt];
                                                setTempFilters({ ...tempFilters, amounts: next });
                                            }}
                                        />
                                    ))}
                                </View>
                            )}

                            <FilterItem label="TAGS" value="" icon={Tag} />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                                <Text style={styles.clearBtnText}>Clear all</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
                                <Text style={styles.applyBtnText}>Apply</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Date Range Selection Modal */}
            <Modal
                visible={showDateRangeModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowDateRangeModal(false)}
            >
                <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
                    <View style={[styles.modalContent, { height: 'auto', maxHeight: '70%', borderRadius: 16, padding: 0 }]}>
                        <ScrollView>
                            {[
                                'Last 7 days', 'Last 14 days', 'Last 30 days', 'Last 60 days',
                                'This month', 'Last month', 'This year', 'Last year', 'All time'
                            ].map(opt => (
                                <TouchableOpacity
                                    key={opt}
                                    style={styles.pickerItem}
                                    onPress={() => {
                                        setTempFilters({ ...tempFilters, dateRange: opt });
                                        setShowDateRangeModal(false);
                                    }}
                                >
                                    <Text style={[styles.pickerText, tempFilters.dateRange === opt && { color: '#F59E0B' }]}>{opt}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={[styles.pickerItem, { borderBottomWidth: 0 }]}
                                onPress={() => setShowDateRangeModal(false)}
                            >
                                <Text style={[styles.pickerText, { color: '#6366F1' }]}>Cancel</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Category Selector Modal */}
            <Modal
                visible={showCategoryModal}
                animationType="slide"
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <SafeAreaView style={styles.selectorContainer}>
                    <View style={styles.selectorHeader}>
                        <TouchableOpacity onPress={() => {
                            setShowCategoryModal(false);
                            Keyboard.dismiss();
                        }}>
                            <X size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.selectorTitle}>Select Category</Text>
                        <TouchableOpacity onPress={() => {
                            setShowCategoryModal(false);
                            Keyboard.dismiss();
                        }}>
                            <Text style={styles.selectorDoneText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.searchBox}>
                        <Search size={20} color="#94A3B8" />
                        <TextInput
                            placeholder="Search categories"
                            placeholderTextColor="#64748B"
                            style={styles.searchInput}
                            value={categorySearch}
                            onChangeText={setCategorySearch}
                        />
                    </View>
                    <ScrollView style={{ flex: 1 }}>
                        <TouchableOpacity
                            style={styles.selectorItem}
                            onPress={() => {
                                setTempFilters({ ...tempFilters, categories: [] });
                            }}
                        >
                            <Text style={[styles.selectorItemText, tempFilters.categories.length === 0 && { color: '#F59E0B' }]}>All Categories</Text>
                            {tempFilters.categories.length === 0 && <Check size={18} color="#F59E0B" />}
                        </TouchableOpacity>
                        {categories
                            .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                            .map(c => {
                                const isSelected = tempFilters.categories.includes(c.name);
                                return (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={styles.selectorItem}
                                        onPress={() => {
                                            const current = tempFilters.categories;
                                            const next = isSelected
                                                ? current.filter(x => x !== c.name)
                                                : [...current, c.name];
                                            setTempFilters({ ...tempFilters, categories: next });
                                        }}
                                    >
                                        <Text style={[styles.selectorItemText, isSelected && { color: '#F59E0B' }]}>{c.name}</Text>
                                        {isSelected && <Check size={18} color="#F59E0B" />}
                                    </TouchableOpacity>
                                );
                            })
                        }
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Merchant Selector Modal */}
            <Modal
                visible={showMerchantModal}
                animationType="slide"
                onRequestClose={() => setShowMerchantModal(false)}
            >
                <SafeAreaView style={styles.selectorContainer}>
                    <View style={styles.selectorHeader}>
                        <TouchableOpacity onPress={() => {
                            setShowMerchantModal(false);
                            Keyboard.dismiss();
                        }}>
                            <X size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.selectorTitle}>Select Merchant</Text>
                        <TouchableOpacity onPress={() => {
                            setShowMerchantModal(false);
                            Keyboard.dismiss();
                        }}>
                            <Text style={styles.selectorDoneText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.searchBox}>
                        <Search size={20} color="#94A3B8" />
                        <TextInput
                            placeholder="Search merchants"
                            placeholderTextColor="#64748B"
                            style={styles.searchInput}
                            value={merchantSearch}
                            onChangeText={setMerchantSearch}
                        />
                    </View>
                    <ScrollView style={{ flex: 1 }}>
                        <TouchableOpacity
                            style={styles.selectorItem}
                            onPress={() => {
                                setTempFilters({ ...tempFilters, merchants: [] });
                            }}
                        >
                            <Text style={[styles.selectorItemText, tempFilters.merchants.length === 0 && { color: '#F59E0B' }]}>All Merchants</Text>
                            {tempFilters.merchants.length === 0 && <Check size={18} color="#F59E0B" />}
                        </TouchableOpacity>
                        {merchants
                            .filter(m => m.toLowerCase().includes(merchantSearch.toLowerCase()))
                            .map(m => {
                                const isSelected = tempFilters.merchants.includes(m);
                                return (
                                    <TouchableOpacity
                                        key={m}
                                        style={styles.selectorItem}
                                        onPress={() => {
                                            const current = tempFilters.merchants;
                                            const next = isSelected
                                                ? current.filter(x => x !== m)
                                                : [...current, m];
                                            setTempFilters({ ...tempFilters, merchants: next });
                                        }}
                                    >
                                        <Text style={[styles.selectorItemText, isSelected && { color: '#F59E0B' }]}>{m}</Text>
                                        {isSelected && <Check size={18} color="#F59E0B" />}
                                    </TouchableOpacity>
                                );
                            })
                        }
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#071021', // Match user screenshot dark theme
    },
    topContainer: {
        backgroundColor: '#0F2441',
        paddingBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        marginRight: 12,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    searchBarContainer: {
        paddingHorizontal: 16,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        marginLeft: 10,
    },
    filterIconBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeSmall: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#F59E0B',
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeTextSmall: {
        color: '#000',
        fontSize: 10,
        fontWeight: 'bold',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    dateHeader: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 16,
        marginTop: 8,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconContainer: {
        width: 40,
        height: 28,
        backgroundColor: '#F59E0B',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    merchantText: {
        flex: 1,
        color: '#FFF',
        fontSize: 15,
        fontWeight: '500',
    },
    amountText: {
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
    },
    // Expanded Content Styles
    expandedContent: {
        backgroundColor: '#1E293B',
        paddingVertical: 8,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 50,
        paddingVertical: 12,
    },
    optionText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    optionTextSelected: {
        color: '#F59E0B',
        fontWeight: '700',
    },
    optionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F59E0B',
    },
    // Picker Styles
    pickerItem: {
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
        alignItems: 'center',
    },
    pickerText: {
        fontSize: 18,
        color: '#3B82F6',
        fontWeight: '500',
    },
    // Selector Styles
    selectorContainer: {
        flex: 1,
        backgroundColor: '#071021',
    },
    selectorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    selectorTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    selectorDoneText: {
        color: '#6366F1',
        fontSize: 16,
        fontWeight: '700',
    },
    selectorItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectorItemText: {
        color: '#FFF',
        fontSize: 16,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#0F172A',
        height: height * 0.9,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
    },
    modalBody: {
        flex: 1,
    },
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    filterRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterRowRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterLabelText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    filterValueText: {
        color: '#FFF',
        fontSize: 14,
        marginRight: 8,
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#0F172A',
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    clearBtn: {
        flex: 1,
        backgroundColor: '#1E293B',
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    clearBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    applyBtn: {
        flex: 1,
        backgroundColor: '#F59E0B',
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    }
});

export default AccountTransactions;
