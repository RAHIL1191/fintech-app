import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ProgressBarAndroid, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Plus, AlignJustify, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

const { width } = Dimensions.get('window');

const Budget = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState('BUDGETS'); // BUDGETS | GOALS
    const [typeFilter, setTypeFilter] = useState('Expenses'); // Expenses | Income
    const [selectedMonth, setSelectedMonth] = useState('Jan');

    // Mock Data to match picture
    const budgets = [
        {
            id: 1,
            name: 'Hi',
            icon: 'CircleDollarSign', // Using Lucide icon
            spent: 105.00,
            limit: 45.00,
            color: '#EF4444', // Red for over budget
            period: 'Jan'
        }
    ];

    const overallSpent = 105;
    const overallLimit = 45;

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.openDrawer()}>
                <Menu size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Budget</Text>
            <View style={styles.headerRight}>
                <TouchableOpacity style={styles.iconBtn}>
                    <AlignJustify size={24} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('CreateBudget')}>
                    <Plus size={24} color="#3B82F6" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderTabs = () => (
        <View style={styles.tabContainer}>
            <TouchableOpacity
                style={[styles.tabItem, activeTab === 'BUDGETS' && styles.activeTabItem]}
                onPress={() => setActiveTab('BUDGETS')}
            >
                <Text style={[styles.tabText, activeTab === 'BUDGETS' && styles.activeTabText]}>BUDGETS</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tabItem, activeTab === 'GOALS' && styles.activeTabItem]}
                onPress={() => setActiveTab('GOALS')}
            >
                <Text style={[styles.tabText, activeTab === 'GOALS' && styles.activeTabText]}>GOALS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderControls = () => (
        <View style={styles.controlsRow}>
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleBtn, typeFilter === 'Expenses' && styles.activeToggleBtn]}
                    onPress={() => setTypeFilter('Expenses')}
                >
                    <Text style={[styles.toggleText, typeFilter === 'Expenses' && styles.activeToggleText]}>Expenses</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, typeFilter === 'Income' && styles.activeToggleBtn]}
                    onPress={() => setTypeFilter('Income')}
                >
                    <Text style={[styles.toggleText, typeFilter === 'Income' && styles.activeToggleText]}>Income</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.monthSelector}>
                <TouchableOpacity><ChevronLeft size={20} color="#64748B" /></TouchableOpacity>
                <Text style={styles.monthText}>{selectedMonth}</Text>
                <TouchableOpacity><ChevronRight size={20} color="#64748B" /></TouchableOpacity>
            </View>
        </View>
    );

    const renderOverallProgress = () => {
        // Mocking "Spent $0 of $0" from image? Or real calculation? 
        // User picture showed "Spent $0 of $0" in the Overall card 
        // BUT list item showed "Spent $105 of $45".
        // I'll calculate it to be smart, unless they strictly want 0/0.
        // Let's use the actual totals.
        return (
            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>Overall Progress</Text>
                    <Text style={styles.cardAmount}>${(overallLimit - overallSpent).toFixed(0)}</Text>
                </View>
                {/* Text logic: The image had $0 at the top right, probably 'Remaining'? */}

                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                        <View style={[styles.progressBarFill, { width: `${Math.min((overallSpent / overallLimit) * 100, 100)}%`, backgroundColor: overallSpent > overallLimit ? '#DC2626' : '#E2E8F0' }]} />
                    </View>
                    <View style={styles.progressTextOverlay}>
                        <Text style={styles.progressTextInner}>Spent ${overallSpent.toFixed(0)} of ${overallLimit.toFixed(0)}</Text>
                    </View>
                </View>
                <Text style={styles.helperText}>Select budgets to include in overall progress.</Text>
            </View>
        );
    };

    const renderBudgetItem = (item) => {
        const percent = (item.spent / item.limit) * 100;
        const isOver = item.spent > item.limit;
        const remaining = item.limit - item.spent;

        const Icon = LucideIcons[item.icon] || LucideIcons.DollarSign;

        return (
            <View key={item.id} style={styles.budgetItem}>
                <View style={styles.budgetHeader}>
                    <View style={styles.budgetLeft}>
                        <View style={styles.iconCircle}>
                            <Icon size={24} color="#3B82F6" />
                        </View>
                        <Text style={styles.budgetName}>{item.name}</Text>
                    </View>
                    <Text style={styles.budgetRemaining}>
                        {remaining < 0 ? `- $${Math.abs(remaining).toFixed(0)}` : `$${remaining.toFixed(0)}`}
                    </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.itemProgressContainer}>
                    <View style={[styles.itemProgressBar, {
                        backgroundColor: isOver ? '#EF4444' : '#3B82F6',
                        width: '100%', // Fix logic: width should be 100%, visual fill inside? 
                        // The component in picture looks like a solid bar with text INSIDE
                    }]}>
                        <Text style={styles.itemProgressText}>Spent ${item.spent.toFixed(0)} of ${item.limit.toFixed(0)}</Text>
                    </View>
                </View>

                <View style={styles.budgetFooter}>
                    <Text style={styles.percentText}>{percent.toFixed(1)}%</Text>
                    <Text style={styles.periodText}>{item.period}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={{ backgroundColor: '#fff' }}>
                {renderHeader()}
                {renderTabs()}
            </View>

            <ScrollView style={styles.scrollView}>
                {renderControls()}

                <View style={styles.contentPadding}>
                    {renderOverallProgress()}

                    {budgets.map(renderBudgetItem)}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FE' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    headerTitle: { fontSize: 20, fontWeight: '600', color: '#0F172A' },
    headerRight: { flexDirection: 'row', gap: 12 },
    iconBtn: { padding: 4 },

    // Tabs
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    tabItem: {
        paddingVertical: 12,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTabItem: {
        borderBottomColor: '#3B82F6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    activeTabText: {
        color: '#0F172A',
    },

    scrollView: { flex: 1 },
    contentPadding: { padding: 16 },

    // Controls
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0', // Slightly darker bg for toggle track? 
        // Based on pic, it looks like simple text or light pill?
        // Let's use light blue pill style
        backgroundColor: '#EFF6FF',
        borderRadius: 20,
        padding: 4,
    },
    toggleBtn: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 16,
    },
    activeToggleBtn: {
        backgroundColor: '#BFDBFE', // Light blue selection
        // Actually picture has "Expenses" selected with blue background
        backgroundColor: '#DBEAFE',
    },
    toggleText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    activeToggleText: { color: '#1E40AF', fontWeight: '600' },

    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    monthText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

    // Overall Card
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
    cardAmount: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    progressBarContainer: {
        height: 24,
        backgroundColor: '#F1F5F9', // Light gray background
        borderRadius: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        marginBottom: 8,
    },
    progressBarBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#E2E8F0',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 12, // Match container
    },
    progressTextOverlay: {
        position: 'absolute',
        width: '100%',
        paddingLeft: 12,
    },
    progressTextInner: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569', // Dark text on light bar?
        // If bar is red, text might need to be white?
        // In picture, "Spent $0 of $0" is inside a gray bar.
    },
    helperText: { fontSize: 12, color: '#94A3B8' },

    // Budget Item
    budgetItem: {
        marginBottom: 16,
    },
    budgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    budgetName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
    budgetRemaining: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

    itemProgressContainer: {
        height: 28,
        backgroundColor: '#E2E8F0', // Fallback
        borderRadius: 14,
        marginBottom: 4,
        overflow: 'hidden',
    },
    itemProgressBar: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 12,
        borderRadius: 14,
    },
    itemProgressText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    budgetFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    percentText: { fontSize: 12, color: '#64748B' },
    periodText: { fontSize: 12, color: '#64748B' },

});

export default Budget;
