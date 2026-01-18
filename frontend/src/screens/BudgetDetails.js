import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Pencil, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

const BudgetDetails = ({ navigation, route }) => {
    const { budget } = route.params || {};
    const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'short' }));

    if (!budget) {
        return (
            <SafeAreaView style={styles.container}>
                <Text>No budget data</Text>
            </SafeAreaView>
        );
    }

    const spent = budget.spent || 0;
    const limit = budget.limit || budget.amount || 0;
    const remaining = limit - spent;
    const isOver = spent > limit;
    const overAmount = isOver ? spent - limit : 0;
    const percent = limit > 0 ? (spent / limit) * 100 : 0;

    const Icon = LucideIcons[budget.icon] || LucideIcons.DollarSign;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace(',', '');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <ArrowLeft size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Budget</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerBtn}>
                        <Pencil size={20} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn}>
                        <MoreVertical size={20} color="#0F172A" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {/* Month Selector */}
                <View style={styles.monthRow}>
                    <TouchableOpacity>
                        <ChevronLeft size={24} color="#64748B" />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>{selectedMonth}</Text>
                    <TouchableOpacity>
                        <ChevronRight size={24} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* Budget Icon and Name */}
                <View style={styles.budgetHero}>
                    <View style={styles.iconCircle}>
                        <Icon size={32} color="#3B82F6" />
                    </View>
                    <Text style={styles.budgetName}>{budget.name}</Text>
                </View>

                {/* Progress Section */}
                <View style={styles.progressSection}>
                    <Text style={styles.percentLabel}>{percent.toFixed(1)}%</Text>
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, {
                            width: `${Math.min(percent, 100)}%`,
                            backgroundColor: isOver ? '#EF4444' : '#3B82F6'
                        }]}>
                            <Text style={styles.progressText}>Spent ${spent.toFixed(0)} of ${limit.toFixed(0)}</Text>
                        </View>
                    </View>
                    <Text style={styles.todayLabel}>Today</Text>
                </View>

                {/* Over Budget Card */}
                {isOver && (
                    <View style={styles.overCard}>
                        <View>
                            <Text style={styles.overAmount}>${overAmount.toFixed(0)}</Text>
                            <Text style={styles.overLabel}>Over</Text>
                        </View>
                        <TouchableOpacity>
                            <Text style={styles.addAmountBtn}>ADD AMOUNT &gt;</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Under Budget Card */}
                {!isOver && remaining > 0 && (
                    <View style={[styles.overCard, { backgroundColor: '#DCFCE7' }]}>
                        <View>
                            <Text style={[styles.overAmount, { color: '#16A34A' }]}>${remaining.toFixed(0)}</Text>
                            <Text style={[styles.overLabel, { color: '#16A34A' }]}>Remaining</Text>
                        </View>
                    </View>
                )}

                {/* Details */}
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Budget</Text>
                    <TouchableOpacity style={styles.detailValue}>
                        <Text style={styles.detailAmount}>${limit.toFixed(0)}</Text>
                        <ChevronRight size={16} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Expenses</Text>
                    <TouchableOpacity style={styles.detailValue}>
                        <Text style={styles.detailAmount}>${spent.toFixed(0)}</Text>
                        <ChevronRight size={16} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                {/* Timestamps */}
                <View style={styles.timestamps}>
                    <Text style={styles.timestampText}>Created On {formatDate(budget.created_at)}</Text>
                    <Text style={styles.timestampText}>Last updated {formatDate(budget.updated_at)}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F9FF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F0F9FF',
    },
    headerBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    monthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 40,
        paddingVertical: 16,
    },
    monthText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    budgetHero: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    budgetName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    progressSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    percentLabel: {
        textAlign: 'right',
        fontSize: 14,
        color: '#64748B',
        marginBottom: 4,
    },
    progressBarContainer: {
        height: 32,
        backgroundColor: '#E2E8F0',
        borderRadius: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 16,
        justifyContent: 'center',
        paddingHorizontal: 12,
        minWidth: 120,
    },
    progressText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    todayLabel: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 8,
    },
    overCard: {
        backgroundColor: '#FEE2E2',
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    overAmount: {
        fontSize: 24,
        fontWeight: '700',
        color: '#EF4444',
    },
    overLabel: {
        fontSize: 14,
        color: '#EF4444',
    },
    addAmountBtn: {
        color: '#EF4444',
        fontWeight: '600',
        fontSize: 14,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFF',
    },
    detailLabel: {
        fontSize: 16,
        color: '#0F172A',
    },
    detailValue: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        marginRight: 4,
    },
    timestamps: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    timestampText: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 4,
    },
});

export default BudgetDetails;
