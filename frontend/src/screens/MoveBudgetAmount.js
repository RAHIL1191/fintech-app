import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, ChevronRight, ChevronDown, DollarSign } from 'lucide-react-native';
import api from '../config/api';

const MoveBudgetAmount = ({ navigation, route }) => {
    // Mode: 'pull' (Default, Add to Active) | 'push' (Move from Active)
    const { activeBudget, dateStr, mode = 'pull' } = route.params;

    const [amount, setAmount] = useState('');
    const [selectedOtherBudget, setSelectedOtherBudget] = useState(null);
    const [budgets, setBudgets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showBudgetSelector, setShowBudgetSelector] = useState(false);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    useEffect(() => {
        fetchBudgets();
    }, []);

    const fetchBudgets = async () => {
        try {
            // Manual parse dateStr (YYYY-MM-DD) to avoid UTC->Local timezone shifts
            const [yStr, mStr] = dateStr.split('-');
            const year = parseInt(yStr);
            const month = parseInt(mStr);



            const res = await api.get(`/budgets/summary?month=${month}&year=${year}`);
            // Filter out the active budget itself from the selection list
            const available = res.data.filter(b => b.id !== activeBudget.id);
            setBudgets(available);
        } catch (error) {
            console.error('Failed to fetch budgets:', error);
            Alert.alert('Error', 'Failed to load available budgets');
        }
    };

    const handleSave = async () => {
        // Determine Source and Target based on mode
        const sourceBudget = mode === 'push' ? activeBudget : selectedOtherBudget;
        const targetBudget = mode === 'pull' ? activeBudget : selectedOtherBudget;

        if (!selectedOtherBudget) {
            Alert.alert('Error', `Please select a budget to ${mode === 'push' ? 'move funds to' : 'move funds from'}.`);
            return;
        }

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            Alert.alert('Error', 'Please enter a valid amount.');
            return;
        }

        const moveAmount = parseFloat(amount);
        setLoading(true);

        try {
            // Calculate new amounts
            const newSourceAmount = sourceBudget.limit - moveAmount;
            const newTargetAmount = (targetBudget.limit || targetBudget.amount) + moveAmount;

            // Update Source
            await api.put(`/budgets/${sourceBudget.id}`, {
                ...sourceBudget,
                amount: newSourceAmount,
                editMode: 'this_only',
                focusDate: dateStr
            });

            // Update Target
            await api.put(`/budgets/${targetBudget.id}`, {
                ...targetBudget,
                amount: newTargetAmount,
                editMode: 'this_only',
                focusDate: dateStr
            });

            Alert.alert('Success', 'Funds moved successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

        } catch (error) {
            console.error('Move failed:', error);
            Alert.alert('Error', 'Failed to move funds.');
        } finally {
            setLoading(false);
        }
    };

    const renderBudgetSelector = () => (
        <Modal
            animationType="fade"
            transparent={true}
            visible={showBudgetSelector}
            onRequestClose={() => setShowBudgetSelector(false)}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowBudgetSelector(false)}
            >
                <View style={styles.dropdownContent}>
                    <ScrollView>
                        {budgets.map(b => (
                            <TouchableOpacity
                                key={b.id}
                                style={styles.dropdownItem}
                                onPress={() => {
                                    setSelectedOtherBudget(b);
                                    setShowBudgetSelector(false);
                                }}
                            >
                                <Text style={styles.dropdownItemText}>{b.name}</Text>
                                <Text style={styles.dropdownItemSub}>
                                    Remaining: ${(b.limit - b.spent).toFixed(0)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </TouchableOpacity>
        </Modal>
    );

    // Determine what to show in From/To boxes
    const sourceDisplay = mode === 'push' ? activeBudget : selectedOtherBudget;
    const targetDisplay = mode === 'pull' ? activeBudget : selectedOtherBudget;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <ArrowLeft size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Move Budget Amount</Text>
                <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                    <Check size={24} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* From Section */}
                <View style={styles.card}>
                    <View style={styles.cardRow}>
                        <View style={styles.iconPlaceholder} />
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.label}>From:</Text>
                                <Text style={styles.dateLabel}>{dateStr}</Text>
                            </View>

                            {/* If mode is Pull, this is Selectable. If Push, this is Active (Static) */}
                            {mode === 'pull' ? (
                                <TouchableOpacity onPress={() => setShowBudgetSelector(true)}>
                                    <Text style={[styles.valueLarge, !sourceDisplay && { color: '#94A3B8' }]}>
                                        {sourceDisplay ? sourceDisplay.name : 'Select Budget'}
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.valueLarge}>{sourceDisplay ? sourceDisplay.name : ''}</Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Amount Input */}
                <View style={styles.amountContainer}>
                    <View style={styles.amountBox}>
                        <Text style={styles.amountLabel}>Move ($)</Text>
                        <TextInput
                            style={styles.amountInput}
                            placeholder="Enter Amount"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>
                    <View style={styles.arrowContainer}>
                        <ArrowLeft size={24} color="#3B82F6" style={{ transform: [{ rotate: '-90deg' }] }} />
                    </View>
                </View>

                {/* To Section */}
                <View style={styles.card}>
                    <View style={styles.cardRow}>
                        <View style={[styles.iconPlaceholder, { backgroundColor: '#DBEAFE' }]}>
                            <DollarSign size={20} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.label}>To:</Text>
                                <Text style={styles.dateLabel}>{dateStr}</Text>
                            </View>

                            {/* If mode is Pull, this is Active (Static). If Push, this is Selectable. */}
                            {mode === 'pull' ? (
                                <Text style={styles.valueLarge}>{targetDisplay ? targetDisplay.name : ''}</Text>
                            ) : (
                                <TouchableOpacity onPress={() => setShowBudgetSelector(true)}>
                                    <Text style={[styles.valueLarge, !targetDisplay && { color: '#94A3B8' }]}>
                                        {targetDisplay ? targetDisplay.name : 'Select Budget'}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <View style={styles.divider} />

                            {targetDisplay && (
                                <>
                                    <Text style={styles.spentText}>
                                        Spent <Text style={{ fontWeight: '700', color: '#0F172A' }}>${(targetDisplay.spent || 0).toFixed(0)}</Text> of ${(targetDisplay.limit || 0).toFixed(0)}
                                    </Text>

                                    <Text style={styles.newBudgetResult}>
                                        New Budget: ${((targetDisplay.limit || 0) + (parseFloat(amount) || 0)).toFixed(0)}
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>
                </View>

            </ScrollView>

            {showBudgetSelector && renderBudgetSelector()}

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
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    content: {
        padding: 16,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#000', // IOS
        shadowOffset: { height: 2, width: 0 }, // IOS
        shadowOpacity: 0.05, // IOS
        shadowRadius: 4, //IOS
        elevation: 2, // Android
    },
    cardRow: {
        flexDirection: 'row',
        gap: 16,
    },
    iconPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 4,
    },
    dateLabel: {
        fontSize: 14,
        color: '#64748B',
    },
    valueLarge: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    amountContainer: {
        alignItems: 'center',
        marginBottom: 24,
        zIndex: 1, // ensure arrow is on top if needed
    },
    amountBox: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        width: '60%',
        shadowColor: '#000',
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        marginBottom: -16, // pull arrow up
    },
    amountLabel: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 8,
    },
    amountInput: {
        fontSize: 20,
        fontWeight: '600',
        color: '#0F172A',
        textAlign: 'center',
        width: '100%',
    },
    arrowContainer: {
        marginTop: 24,
    },
    divider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 12,
    },
    spentText: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 4,
    },
    newBudgetResult: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        marginTop: 4,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    dropdownContent: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        maxHeight: '60%',
    },
    dropdownItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    dropdownItemText: {
        fontSize: 16,
        color: '#0F172A',
        fontWeight: '500',
    },
    dropdownItemSub: {
        fontSize: 12,
        color: '#64748B',
    }
});

export default MoveBudgetAmount;
