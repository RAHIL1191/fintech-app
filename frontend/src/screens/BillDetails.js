import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Edit3, Trash2, MoreVertical, Calendar, Clock, Check, FileText, Bell, Repeat, LayoutGrid, StickyNote } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { getCategoryIcon, getCategoryColor } from '../constants/CategoryTaxonomy';
import { formatAuditDate } from '../utils/dateUtils';
import api from '../config/api';
import CalculatorModal from '../components/CalculatorModal';
import NoteModal from '../components/NoteModal';
import EditScopeModal from '../components/EditScopeModal';
import DeleteScopeModal from '../components/DeleteScopeModal';

const BillDetails = ({ navigation, route }) => {
    // Route params contain the bill object
    const { bill } = route.params;
    const insets = useSafeAreaInsets();
    const [note, setNote] = useState(bill.note || '');
    const [loading, setLoading] = useState(false);
    const [localAmount, setLocalAmount] = useState(bill.amount);
    const [showCalculator, setShowCalculator] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [showEditScopeModal, setShowEditScopeModal] = useState(false);
    const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const iconName = getCategoryIcon(bill.category);
    const IconComponent = LucideIcons[iconName] || LucideIcons.Tag;
    const categoryColor = getCategoryColor(bill.category);

    const handleSaveException = async (newAmount) => {
        try {
            const amountVal = parseFloat(newAmount);
            await api.post('/bills/exception', {
                billId: bill.billId,
                originalDate: bill.dueDate, // Used as key for the exception
                newAmount: amountVal,
                isSkipped: false
            });
            setLocalAmount(amountVal);
            setShowCalculator(false);
            Alert.alert('Success', 'Amount updated for this occurrence only.');
        } catch (error) {
            console.error('Failed to update amount:', error);
            Alert.alert('Error', 'Failed to update amount.');
        }
    };

    const handleSaveNote = async (newNote) => {
        if (newNote === note && newNote === bill.note) return; // No change

        // Optimistic update
        const previousNote = note;
        setNote(newNote);

        try {
            await api.post('/bills/exception', {
                billId: bill.billId,
                originalDate: bill.dueDate,
                note: newNote,
                isSkipped: false
            });
        } catch (error) {
            console.error('Failed to update note:', error);
            setNote(previousNote); // Revert on error
            Alert.alert('Error', 'Failed to update note.');
        }
    };

    const handleMarkPaid = async () => {
        try {
            setLoading(true);
            // Use local date for payment date to avoid timezone issues (prevents "tomorrow" date late in evening)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const paymentDate = `${year}-${month}-${day}`;
            // Match the ID format used in Bills.js: bill_pay_{id}_{date}
            // Use bill.dueDate from the item, NOT today's date, to ensure uniqueness per instance
            // But wait, if user pays early? We should probably use the DUE DATE for the ID mapping.
            const uniqueDate = bill.dueDate.replace(/-/g, '');
            const transactionId = `bill_pay_${bill.billId}_${uniqueDate}`;

            const transactionData = {
                category: bill.category,
                merchant_name: bill.description || bill.category,
                amount: bill.amount, // Positive amount? Wait. Bills.js used billObj.amount.
                // In Bills.js: amount: billObj.amount.
                // In BillDetails.js original: -Math.abs(bill.amount).
                // Let's stick to POSITIVE if it's an expense transaction that the backend handles as debit?
                // Backend schema: amount is numeric.
                // Plaid transactions are positive for expense.
                // renderBillCard shows ${bill.amount}.
                // I should use bill.amount (positive).
                date: paymentDate,
                // Bills.js uses billObj.dueDate. Let's consistency.
                account_id: bill.accountId,
                note: `Paid bill: ${bill.category}`,
                transaction_id: transactionId
            };

            // 1. Create Transaction
            await api.post('/transactions', transactionData);

            // 2. Hide from Upcoming (Exception)
            await api.post('/bills/exception', {
                billId: bill.billId,
                originalDate: bill.dueDate,
                isSkipped: true
            });

            Alert.alert('Success', 'Bill marked as paid!', [
                {
                    text: 'OK',
                    onPress: () => {
                        // Navigate back to Bills list to refresh
                        navigation.navigate('Bills');
                    }
                }
            ]);
        } catch (error) {
            console.error('Failed to mark bill as paid:', error);
            const msg = error.response?.data?.error || error.message || 'Unknown error';
            Alert.alert('Error', `Failed to record payment: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        if (bill.isPaid) {
            Alert.alert(
                'Delete?',
                'Are you sure to delete this entry?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await api.delete(`/transactions/${bill.transaction_id}`);
                                Alert.alert('Success', 'Payment record deleted.');
                                navigation.navigate('Bills');
                            } catch (error) {
                                console.error('Failed to delete transaction:', error);
                                Alert.alert('Error', 'Failed to delete payment.');
                            }
                        }
                    }
                ]
            );
        } else {
            setShowDeleteScopeModal(true);
        }
    };

    const handleMarkUnpaid = async () => {
        console.log('handleMarkUnpaid triggered');
        console.log('Bill Object:', JSON.stringify(bill));
        console.log('Transaction ID to delete:', bill.transaction_id);

        try {
            if (!bill.transaction_id) {
                console.error('No transaction_id found for bill');
                Alert.alert('Error', 'Cannot unpay: Missing transaction ID');
                return;
            }

            await api.delete(`/transactions/${bill.transaction_id}`);
            await api.post('/bills/exception', {
                billId: bill.billId,
                originalDate: bill.dueDate,
                isSkipped: false
            });
            Alert.alert('Success', 'Marked as unpaid. Restored to upcoming list.', [
                { text: 'OK', onPress: () => navigation.navigate('Bills') }
            ]);
        } catch (error) {
            console.error('Failed to mark unpaid:', error);
            Alert.alert('Error', 'Failed to mark as unpaid.');
        }
    };

    const handleDeleteSelectScope = async (scope) => {
        setShowDeleteScopeModal(false);
        try {
            if (scope === 'single') {
                // Skip this instance
                await api.post('/bills/exception', {
                    billId: bill.billId,
                    originalDate: bill.dueDate,
                    isSkipped: true
                });
                Alert.alert('Success', 'This occurrence has been removed.');
            } else {
                // Delete entire bill
                await api.delete(`/bills/${bill.billId}`);
                Alert.alert('Success', 'Recurring bill deleted.');
            }
            navigation.navigate('Bills'); // Refresh list
        } catch (error) {
            console.error('Failed to delete bill:', error);
            Alert.alert('Error', 'Failed to delete bill.');
        }
    };

    const handleEdit = () => {
        setShowEditScopeModal(true);
    };

    const handleSelectScope = (scope) => {
        setShowEditScopeModal(false);
        navigation.navigate('EditTransaction', {
            mode: 'edit',
            type: 'BILLS',
            bill: { ...bill, id: bill.billId }, // Normalize ID field
            editScope: scope // 'single' or 'future'
        });
    };

    // Date formatting
    const dueDateObj = new Date(bill.dueDate + 'T12:00:00');
    const formattedDate = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Days text logic
    let daysText = '';
    if (bill.isToday) {
        daysText = 'Due Today';
    } else if (bill.isPastDue) {
        const days = Math.abs(bill.daysUntilDue);
        daysText = `${days} ${days === 1 ? 'Day' : 'Days'} Past`;
    } else {
        daysText = `${bill.daysUntilDue} Days to pay`;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <ArrowLeft size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Details</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={handleEdit} style={styles.iconBtn}>
                        <Edit3 size={24} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
                        <Trash2 size={24} color="#EF4444" />
                    </TouchableOpacity>

                    {/* Overflow Menu */}
                    <View style={{ position: 'relative', zIndex: 10 }}>
                        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.iconBtn}>
                            <MoreVertical size={24} color="#0F172A" />
                        </TouchableOpacity>

                        {showMenu && (
                            <View style={styles.menuDropdown}>
                                {bill.isPaid && (
                                    <TouchableOpacity
                                        style={styles.menuItem}
                                        onPress={() => {
                                            setShowMenu(false);
                                            handleMarkUnpaid();
                                        }}
                                    >
                                        <Text style={styles.menuItemText}>Mark Unpaid</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        setShowMenu(false);
                                        // Handle Snooze logic here if needed, for now just close
                                        Alert.alert('Snooze', 'Snooze functionality coming soon.');
                                    }}
                                >
                                    <Text style={styles.menuItemText}>Snooze</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Main Icon & Amount */}
                <View style={styles.heroSection}>
                    <View style={[styles.largeIconCircle, { backgroundColor: categoryColor + '20' }]}>
                        <IconComponent size={32} color={categoryColor} />
                    </View>
                    <Text style={styles.categoryTitle}>{bill.category}</Text>
                    {bill.description && <Text style={styles.descriptionText}>{bill.description}</Text>}

                    <View style={styles.amountContainer}>
                        <Text style={styles.amountText}>${localAmount.toFixed(2)}</Text>
                        <TouchableOpacity onPress={() => setShowCalculator(true)} style={styles.editAmountBtn}>
                            <Edit3 size={16} color="#3B82F6" />
                        </TouchableOpacity>
                    </View>

                    {/* Chips Row */}
                    <View style={styles.chipsRow}>
                        <View style={styles.chip}>
                            <Calendar size={14} color="#64748B" />
                            <Text style={styles.chipText}>By {formattedDate}</Text>
                        </View>
                        {bill.isPaid ? (
                            <View style={[styles.chip, { backgroundColor: '#DCFCE7' }]}>
                                <Check size={14} color="#16A34A" />
                                <Text style={[styles.chipText, { color: '#16A34A' }]}>
                                    Paid {new Date(bill.paidDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.chip, bill.isPastDue && { backgroundColor: '#FEF2F2' }]}>
                                <Clock size={14} color={bill.isPastDue ? "#EF4444" : "#64748B"} />
                                <Text style={[styles.chipText, bill.isPastDue && { color: '#EF4444' }]}>{daysText}</Text>
                            </View>
                        )}
                    </View>

                    {bill.isPaid ? (
                        <Text style={styles.paidAmountText}>$ {localAmount.toFixed(2)} Paid</Text>
                    ) : (
                        <TouchableOpacity
                            style={[styles.markPaidBtn, loading && { opacity: 0.7 }]}
                            onPress={handleMarkPaid}
                            disabled={loading}
                        >
                            {loading ? (
                                <Text style={styles.markPaidText}>Processing...</Text>
                            ) : (
                                <>
                                    <Check size={20} color="#3B82F6" />
                                    <Text style={styles.markPaidText}>Mark Paid</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Details List */}
                <View style={styles.detailsList}>

                    {/* Notes Field */}
                    <TouchableOpacity style={styles.noteItem} onPress={() => setShowNoteModal(true)}>
                        <View style={styles.detailIcon}>
                            <StickyNote size={20} color="#64748B" />
                        </View>
                        <Text style={[styles.noteText, !note && { color: '#94A3B8' }]} numberOfLines={1}>
                            {note || "Enter Notes"}
                        </Text>
                        <Edit3 size={16} color="#94A3B8" />
                    </TouchableOpacity>

                    {/* Category Display */}
                    <View style={styles.detailItemReadOnly}>
                        <View style={styles.detailLeft}>
                            <View style={styles.detailIcon}>
                                <LayoutGrid size={20} color="#64748B" />
                            </View>
                            <Text style={styles.detailLabel}>Category</Text>
                        </View>
                        <Text style={styles.detailValue}>{bill.category}</Text>
                    </View>

                    {/* Reminder Display */}
                    <View style={styles.detailItemReadOnly}>
                        <View style={styles.detailLeft}>
                            <View style={styles.detailIcon}>
                                <Bell size={20} color="#64748B" />
                            </View>
                            <Text style={styles.detailLabel}>Reminder</Text>
                        </View>
                        <View style={styles.reminderChip}>
                            <Text style={styles.reminderText}>{bill.reminder || 'No reminder'}</Text>
                        </View>
                    </View>

                    {/* Recurring Display */}
                    <View style={styles.detailItemReadOnly}>
                        <View style={styles.detailLeft}>
                            <View style={styles.detailIcon}>
                                <Repeat size={20} color="#64748B" />
                            </View>
                            <Text style={styles.detailLabel}>Recurring</Text>
                        </View>
                        <Text style={styles.detailValue}>{bill.recurrenceFrequency}</Text>
                    </View>


                </View>

                {/* Payments Section (Visible only if paid) */}
                {bill.isPaid && (
                    <View style={styles.paymentsSection}>
                        <Text style={styles.sectionHeader}>Payments</Text>
                        <View style={styles.paymentCard}>
                            <Text style={styles.paymentDate}>
                                {new Date(bill.paidDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Text>
                            <Text style={styles.paymentAmount}>$ {localAmount.toFixed(2)}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.footer}>
                    {bill.updatedAt && new Date(bill.updatedAt).getTime() !== new Date(bill.createdAt).getTime() && (
                        <Text style={styles.footerText}>
                            Updated {formatAuditDate(bill.updatedAt)}
                        </Text>
                    )}
                    <Text style={styles.footerText}>
                        Created {new Date(bill.createdAt || bill.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                </View>

            </ScrollView>

            <CalculatorModal
                visible={showCalculator}
                onClose={() => setShowCalculator(false)}
                onConfirm={(val) => handleSaveException(val)}
                initialAmount={localAmount.toString()}
            />

            <NoteModal
                visible={showNoteModal}
                onClose={() => setShowNoteModal(false)}
                onSave={handleSaveNote}
                initialNote={note}
            />

            <EditScopeModal
                visible={showEditScopeModal}
                onClose={() => setShowEditScopeModal(false)}
                onSelectScope={handleSelectScope}
            />

            <DeleteScopeModal
                visible={showDeleteScopeModal}
                onClose={() => setShowDeleteScopeModal(false)}
                onSelectScope={handleDeleteSelectScope}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        zIndex: 100, // Ensure header is above scroll content for menu dropdown
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    headerRight: {
        flexDirection: 'row',
        gap: 8,
    },
    iconBtn: {
        padding: 8,
    },
    content: {
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    largeIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    categoryTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 4,
    },
    descriptionText: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 12,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    amountText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#0F172A',
        marginRight: 8,
    },
    editAmountBtn: {
        padding: 4,
    },
    chipsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    chipText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '500',
    },
    markPaidBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 32,
        gap: 8,
        minWidth: 200,
    },
    markPaidText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3B82F6',
    },
    detailsList: {
        paddingHorizontal: 16,
        gap: 16,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        padding: 16,
        height: 60,
    },
    detailItemReadOnly: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        padding: 16,
        height: 60,
    },
    detailLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    detailIcon: {
        marginRight: 12,
        width: 24,
        alignItems: 'center',
    },
    detailInput: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
        marginRight: 8,
    },
    noteItem: {
        flexDirection: 'row',
        alignItems: 'center', // Center vertically like other items
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        padding: 16,
        minHeight: 60, // Standard height
    },
    noteText: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
        marginLeft: 8,
        marginRight: 8,
        marginTop: 0,
    },
    detailLabel: {
        fontSize: 16,
        color: '#64748B',
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
    },
    reminderChip: {
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    reminderText: {
        fontSize: 13,
        color: '#0284C7',
        fontWeight: '600',
    },
    footer: {
        marginTop: 40,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
    },
    paidAmountText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#16A34A',
        marginTop: 8,
    },
    menuDropdown: {
        position: 'absolute',
        top: 40,
        right: 0,
        backgroundColor: 'white',
        borderRadius: 8,
        paddingVertical: 8,
        width: 150,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 50,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    menuItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    menuItemText: {
        fontSize: 16,
        color: '#0F172A',
    },
    paymentsSection: {
        paddingHorizontal: 16,
        marginTop: 24,
    },
    sectionHeader: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 8,
        textAlign: 'center',
    },
    paymentCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        padding: 16,
    },
    paymentDate: {
        fontSize: 16,
        color: '#0F172A',
    },
    paymentAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
    }
});

export default BillDetails;
