import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search } from 'lucide-react-native';
import api from '../config/api';
import { getCategoryIcon, getCategoryColor } from '../constants/CategoryTaxonomy';
import * as LucideIcons from 'lucide-react-native';

const SearchScreen = ({ navigation }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (text) => {
        setQuery(text);

        if (text.trim().length < 2) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            const response = await api.get('/transactions', { params: { search: text } });
            setResults(response.data.transactions || []);
        } catch (error) {
            console.error('Search failed:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const renderTransaction = ({ item }) => {
        const category = item.personal_finance_category?.primary || item.category?.[0] || 'General';
        const iconName = getCategoryIcon(category);
        const IconComponent = LucideIcons[iconName] || LucideIcons.Tag;
        const iconColor = getCategoryColor(category);
        const isIncome = item.amount < 0;

        return (
            <TouchableOpacity
                style={styles.resultItem}
                onPress={() => navigation.navigate('TransactionDetails', { transaction: item })}
            >
                <View style={[styles.resultIcon, { backgroundColor: iconColor + '20' }]}>
                    <IconComponent size={20} color={iconColor} />
                </View>
                <View style={styles.resultContent}>
                    <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.resultCategory}>{category}</Text>
                    <Text style={styles.resultDate}>{item.date}</Text>
                </View>
                <Text style={[styles.resultAmount, isIncome ? styles.income : styles.expense]}>
                    {isIncome ? '+' : '-'}${Math.abs(item.amount).toFixed(2)}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* Header with Search Bar */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#0F172A" />
                </TouchableOpacity>
                <View style={styles.searchInputContainer}>
                    <Search size={18} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by merchant or category..."
                        placeholderTextColor="#94A3B8"
                        value={query}
                        onChangeText={handleSearch}
                        autoFocus
                        returnKeyType="search"
                    />
                </View>
            </View>

            {/* Results */}
            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 60 }} />
                ) : !hasSearched ? (
                    <View style={styles.promptState}>
                        <Search size={64} color="#CBD5E1" />
                        <Text style={styles.promptText}>Search transactions</Text>
                        <Text style={styles.promptSubtext}>Type a merchant name or category</Text>
                    </View>
                ) : results.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No transactions found for "{query}"</Text>
                    </View>
                ) : (
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.transaction_id}
                        renderItem={renderTransaction}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
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
        padding: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backBtn: {
        padding: 8,
        marginRight: 8,
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
    content: {
        flex: 1,
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
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    resultIcon: {
        width: 44,
        height: 44,
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
    resultCategory: {
        fontSize: 12,
        color: '#3B82F6',
        marginTop: 2,
    },
    resultDate: {
        fontSize: 12,
        color: '#94A3B8',
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
    promptState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100,
    },
    promptText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 16,
    },
    promptSubtext: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 4,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100,
    },
    emptyText: {
        fontSize: 14,
        color: '#64748B',
    },
});

export default SearchScreen;
