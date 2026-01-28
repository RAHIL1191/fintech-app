import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search, Wallet } from 'lucide-react-native';
import api from '../config/api';
import { getCategoryIcon, getCategoryColor } from '../constants/CategoryTaxonomy';
import * as LucideIcons from 'lucide-react-native';

const SearchModal = ({ visible, onClose, navigation }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible) {
            setQuery('');
            setResults([]);
        }
    }, [visible]);

    const handleSearch = async (text) => {
        setQuery(text);
        if (text.trim().length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const response = await api.get('/transactions', { params: { search: text } });
            setResults(response.data.transactions || []);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderTransaction = ({ item }) => {
        const iconName = getCategoryIcon(item.personal_finance_category?.primary || item.category?.[0] || 'General');
        const IconComponent = LucideIcons[iconName] || LucideIcons.Wallet;
        const iconColor = getCategoryColor(item.personal_finance_category?.primary || item.category?.[0] || 'General');
        const isIncome = item.amount < 0;

        return (
            <TouchableOpacity
                style={styles.resultItem}
                onPress={() => {
                    onClose();
                    navigation.navigate('TransactionDetails', { transaction: item });
                }}
            >
                <View style={[styles.resultIcon, { backgroundColor: iconColor + '20' }]}>
                    <IconComponent size={20} color={iconColor} />
                </View>
                <View style={styles.resultContent}>
                    <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.resultDate}>{item.authorized_date || item.date}</Text>
                </View>
                <Text style={[styles.resultAmount, isIncome ? styles.income : styles.expense]}>
                    {isIncome ? '+' : '-'}${Math.abs(item.amount).toFixed(2)}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderContent = () => {
        if (loading) {
            return <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />;
        }
        if (query.length < 2) {
            return (
                <View style={styles.emptyState}>
                    <Search size={48} color="#CBD5E1" />
                    <Text style={styles.promptText}>Type to search transactions...</Text>
                </View>
            );
        }
        if (results.length === 0) {
            return (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No transactions found for "{query}"</Text>
                </View>
            );
        }
        return (
            <FlatList
                data={results}
                keyExtractor={(item) => item.transaction_id}
                renderItem={renderTransaction}
                contentContainerStyle={styles.listContent}
            />
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Search Header */}
                <View style={styles.header}>
                    <View style={styles.searchInputContainer}>
                        <Search size={20} color="#94A3B8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search transactions..."
                            placeholderTextColor="#94A3B8"
                            value={query}
                            onChangeText={handleSearch}
                            autoFocus
                        />
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={24} color="#0F172A" />
                    </TouchableOpacity>
                </View>

                {/* Results */}
                {renderContent()}
            </SafeAreaView>
        </Modal>
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
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#0F172A',
    },
    closeBtn: {
        marginLeft: 12,
        padding: 4,
    },
    listContent: {
        padding: 16,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
    },
    resultIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    resultContent: {
        flex: 1,
    },
    resultName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
    },
    resultDate: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    resultAmount: {
        fontSize: 15,
        fontWeight: '700',
    },
    income: {
        color: '#16A34A',
    },
    expense: {
        color: '#DC2626',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#64748B',
    },
    promptText: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 16,
    },
});

export default SearchModal;
