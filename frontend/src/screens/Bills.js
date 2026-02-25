import React, { useState, useEffect, useCallback } from 'react';
import Calendar from 'react-native-calendars/src/calendar';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, RefreshControl, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, SlidersHorizontal, Download, Plus, Receipt, Search, RefreshCw, Zap, Trash2, X, CheckCircle, Check, ArrowRight } from 'lucide-react-native';
import api from '../config/api';
import { getCategoryIcon, getCategoryColor } from '../constants/CategoryTaxonomy';
import * as LucideIcons from 'lucide-react-native';
import { NotificationService } from '../services/NotificationService';

const { width, height } = Dimensions.get('window');

const Bills = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState('UPCOMING');
    const [upcomingBills, setUpcomingBills] = useState([]);
    const [paidBills, setPaidBills] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBills, setSelectedBills] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Calendar State
    const [selectedDate, setSelectedDate] = useState('');
    const [showDayModal, setShowDayModal] = useState(false);
    const [dayBills, setDayBills] = useState([]);
    const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM
    const [modalTitle, setModalTitle] = useState('');

    // Reset selection when tab changes
    useEffect(() => {
        setIsSelectionMode(false);
        setSelectedBills(new Set());
    }, [activeTab]);

    const handleLongPress = (bill) => {
        setIsSelectionMode(true);
        toggleSelection(bill);
    };

    const toggleSelection = (bill) => {
        const uniqueId = `${bill.billId}|${bill.dueDate}`;
        setSelectedBills(prev => {
            const newSet = new Set(prev);
            if (newSet.has(uniqueId)) {
                newSet.delete(uniqueId);
            } else {
                newSet.add(uniqueId);
            }

            // Exit selection mode if last item deselected
            if (newSet.size === 0 && isSelectionMode) {
                // We might want to keep mode active even if empty? Usually no.
                setIsSelectionMode(false);
            }
            return newSet;
        });
    };

    const exitSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedBills(new Set());
    };

    const getSelectedTotal = () => {
        let total = 0;
        // This is inefficient if list is huge, but fine for bills list
        upcomingBills.forEach(group => {
            group.bills.forEach(bill => {
                if (selectedBills.has(`${bill.billId}|${bill.dueDate}`)) {
                    total += bill.amount;
                }
            });
        });
        return total;
    };

    useFocusEffect(
        useCallback(() => {
            if (activeTab === 'UPCOMING' || activeTab === 'RECURRING') {
                fetchUpcomingBills();
            } else if (activeTab === 'PAID') {
                fetchPaidBills();
            } else if (activeTab === 'CALENDAR') {
                fetchUpcomingBills();
                fetchPaidBills();
            }
        }, [activeTab])
    );

    const fetchPaidBills = async () => {
        try {
            setLoading(true);
            const response = await api.get('/bills/paid');
            setPaidBills(response.data.grouped || []);
        } catch (error) {
            console.error('Failed to fetch paid bills:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUpcomingBills = async () => {
        try {
            setLoading(true);
            const response = await api.get('/bills/upcoming');
            const grouped = response.data.grouped || [];
            setUpcomingBills(grouped);

            // Check for bill reminders (async)
            NotificationService.checkBillReminders(grouped);

            // Calculate overdue bills for badge
            let overdueCount = 0;
            grouped.forEach(group => {
                group.bills.forEach(bill => {
                    if (bill.isPastDue) overdueCount++;
                });
            });

            navigation.setOptions({
                tabBarBadge: overdueCount > 0 ? overdueCount : null,
                tabBarBadgeStyle: { backgroundColor: '#EF4444', color: 'white' }
            });

        } catch (error) {
            console.error('Failed to fetch upcoming bills:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (activeTab === 'UPCOMING') {
            await fetchUpcomingBills();
        } else if (activeTab === 'PAID') {
            await fetchPaidBills();
        }
        setRefreshing(false);
    }, [activeTab]);

    const renderBillCard = (bill) => {
        const iconName = getCategoryIcon(bill.category);
        // Resolve the component from the import object
        const IconComponent = LucideIcons[iconName] || LucideIcons.Tag;
        const iconColor = getCategoryColor(bill.category);

        const uniqueId = `${bill.billId}|${bill.dueDate}`;
        const isSelected = selectedBills.has(uniqueId);

        // Format days until due text
        let daysText = '';
        if (bill.isToday) {
            daysText = 'Pay now';
        } else if (bill.isPastDue) {
            daysText = `${Math.abs(bill.daysUntilDue)} days overdue`;
        } else {
            daysText = `${bill.daysUntilDue} days`;
        }

        const handlePress = () => {
            if (isSelectionMode) {
                toggleSelection(bill);
            } else {
                navigation.navigate('BillDetails', { bill });
            }
        };

        return (
            <TouchableOpacity
                key={uniqueId}
                style={[styles.billCard, isSelected && styles.billCardSelected]}
                onPress={handlePress}
                onLongPress={() => handleLongPress(bill)}
                delayLongPress={300}
            >
                <View style={[styles.billIconCircle, { backgroundColor: isSelected ? '#38BDF8' : iconColor + '20' }]}>
                    {isSelected ? (
                        <Check size={24} color="#FFF" />
                    ) : (
                        <IconComponent size={24} color={iconColor} />
                    )}
                </View>
                <View style={styles.billContent}>
                    <Text style={styles.billCategory}>{bill.category}</Text>
                    {bill.isPaid ? (
                        <Text style={styles.billDateText}>
                            {new Date(bill.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' · Paid '}
                            {new Date(bill.paidDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                    ) : (
                        <>
                            <Text style={[
                                styles.billDueText,
                                bill.isToday && { color: '#DC2626', fontWeight: '600' },
                                bill.isPastDue && { color: '#DC2626' }
                            ]}>
                                {daysText}
                            </Text>
                            <Text style={styles.billDateText}>
                                {new Date(bill.dueDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                        </>
                    )}
                </View>
                <View style={styles.billRight}>
                    <Text style={styles.billAmount}>${bill.amount.toFixed(2)}</Text>
                    {!isSelectionMode && (
                        <TouchableOpacity style={styles.refreshBtn}>
                            <RefreshCw size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity >
        );
    };

    const renderUpcomingContent = () => {
        if (loading && upcomingBills.length === 0) {
            return (
                <View style={styles.emptyStateContainer}>
                    <Text style={styles.placeholderText}>Loading bills...</Text>
                </View>
            );
        }

        if (upcomingBills.length === 0) {
            return (
                <View style={styles.emptyStateContainer}>
                    <View style={styles.iconContainer}>
                        <Receipt size={64} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyTitle}>
                        Add recurring bills & subscriptions to get payment reminders.
                    </Text>
                    <TouchableOpacity>
                        <Text style={styles.linkText}>How to organize my bills?</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        // Filter by search
        let filteredGroups = upcomingBills;
        if (searchQuery.trim()) {
            filteredGroups = upcomingBills.map(group => ({
                ...group,
                bills: group.bills.filter(bill =>
                    bill.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    bill.description?.toLowerCase().includes(searchQuery.toLowerCase())
                )
            })).filter(group => group.bills.length > 0);
        }

        return (
            <ScrollView
                style={styles.billsScrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Search */}
                <View style={styles.searchContainer}>
                    <Search size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search ..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Monthly Groups */}
                {filteredGroups.map((group, index) => (
                    <View key={index} style={styles.monthGroup}>
                        <View style={styles.monthHeader}>
                            <Text style={styles.monthTitle}>{group.month}</Text>
                            <Text style={styles.monthTotal}>${group.total.toFixed(2)}</Text>
                        </View>
                        {group.bills.map(renderBillCard)}
                    </View>
                ))}
                <View style={{ height: 100 }} />
            </ScrollView>
        );
    };

    const renderCalendarContent = () => {
        // Flatten bills for efficient processing
        const allUpcoming = upcomingBills.flatMap(g => g.bills);
        const allPaid = paidBills.flatMap(g => g.bills);

        const markedDates = {};

        // Helper to add dot
        const addDot = (date, color, key) => {
            if (!markedDates[date]) {
                markedDates[date] = { dots: [] };
            }
            // Avoid duplicate dots of same color
            if (!markedDates[date].dots.find(d => d.key === key)) {
                markedDates[date].dots.push({ key, color });
            }
        };

        allUpcoming.forEach(bill => {
            const date = bill.dueDate; // YYYY-MM-DD
            if (bill.isPastDue) {
                addDot(date, '#EF4444', 'overdue');
            } else {
                addDot(date, '#F59E0B', 'upcoming'); // Amber for upcoming
            }
        });

        allPaid.forEach(bill => {
            const date = bill.paidDate ? bill.paidDate : bill.dueDate; // Use paid date if available
            addDot(date, '#10B981', 'paid');
        });

        // Highlight selected date
        if (selectedDate) {
            markedDates[selectedDate] = {
                ...(markedDates[selectedDate] || {}),
                selected: true,
                selectedColor: '#38BDF8'
            };
        }

        // Calculate Summary for the current visible month
        const getMonthBills = (type) => {
            if (type === 'paid') {
                return allPaid.filter(b => {
                    const d = b.paidDate || b.dueDate;
                    return d && d.startsWith(calendarMonth);
                });
            } else if (type === 'overdue') {
                return allUpcoming.filter(b => b.isPastDue && b.dueDate.startsWith(calendarMonth));
            } else if (type === 'upcoming') {
                return allUpcoming.filter(b => !b.isPastDue && b.dueDate.startsWith(calendarMonth));
            }
            return [];
        };

        const currentPaidBills = getMonthBills('paid');
        const currentOverdueBills = getMonthBills('overdue');
        const currentUpcomingBills = getMonthBills('upcoming');

        const totalPaid = currentPaidBills.reduce((sum, b) => sum + b.amount, 0);
        const totalOverdue = currentOverdueBills.reduce((sum, b) => sum + b.amount, 0);
        const totalUpcoming = currentUpcomingBills.reduce((sum, b) => sum + b.amount, 0);

        const handleSummaryClick = (type, bills, title) => {
            if (bills.length === 0) return;
            setDayBills(bills);
            setModalTitle(title);
            setSelectedDate(''); // Clear specific date selection
            setShowDayModal(true);
        };

        return (
            <View style={styles.calendarContainer}>
                <Calendar
                    current={calendarMonth + '-01'} // Ensure calendar follows state
                    onDayPress={day => {
                        setSelectedDate(day.dateString);

                        // Filter bills for this day
                        const dateStr = day.dateString;
                        const matchingUpcoming = allUpcoming.filter(b => b.dueDate === dateStr);
                        const matchingPaid = allPaid.filter(b => (b.paidDate || b.dueDate) === dateStr);

                        setDayBills([...matchingUpcoming, ...matchingPaid]);
                        // Set nice title for the day
                        const dateObj = new Date(dateStr + 'T12:00:00');
                        const niceDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
                        setModalTitle(niceDate);
                        setShowDayModal(true);
                    }}
                    onMonthChange={month => {
                        // Month object has .year, .month (1-12), .dateString
                        setCalendarMonth(month.dateString.substring(0, 7));
                    }}
                    markedDates={markedDates}
                    markingType={'multi-dot'}
                    theme={{
                        calendarBackground: '#0B1120',
                        textSectionTitleColor: '#64748B',
                        selectedDayBackgroundColor: '#38BDF8',
                        selectedDayTextColor: '#FFFFFF',
                        todayTextColor: '#38BDF8',
                        dayTextColor: '#E2E8F0',
                        textDisabledColor: '#334155',
                        monthTextColor: '#F1F5F9',
                        arrowColor: '#38BDF8',
                        dotStyle: { width: 6, height: 6, borderRadius: 3 }
                    }}
                />

                {/* Summary View */}
                <View style={styles.summaryContainer}>
                    <TouchableOpacity style={styles.summaryItem} onPress={() => handleSummaryClick('paid', currentPaidBills, `Paid Bills - ${calendarMonth}`)}>
                        <Text style={styles.summaryAmount}>${totalPaid.toFixed(0)}</Text>
                        <View style={styles.summaryLabelRow}>
                            <Text style={styles.summaryLabel}>Paid</Text>
                            <View style={[styles.summaryDot, { backgroundColor: '#10B981' }]} />
                        </View>
                    </TouchableOpacity>

                    <View style={styles.summaryDivider} />

                    <TouchableOpacity style={styles.summaryItem} onPress={() => handleSummaryClick('overdue', currentOverdueBills, `Overdue Bills - ${calendarMonth}`)}>
                        <Text style={styles.summaryAmount}>${totalOverdue.toFixed(0)}</Text>
                        <View style={styles.summaryLabelRow}>
                            <Text style={styles.summaryLabel}>Overdue</Text>
                            <View style={[styles.summaryDot, { backgroundColor: '#EF4444' }]} />
                        </View>
                    </TouchableOpacity>

                    <View style={styles.summaryDivider} />

                    <TouchableOpacity style={styles.summaryItem} onPress={() => handleSummaryClick('upcoming', currentUpcomingBills, `Upcoming Bills - ${calendarMonth}`)}>
                        <Text style={styles.summaryAmount}>${totalUpcoming.toFixed(0)}</Text>
                        <View style={styles.summaryLabelRow}>
                            <Text style={styles.summaryLabel}>Upcoming</Text>
                            <View style={[styles.summaryDot, { backgroundColor: '#F59E0B' }]} />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderPaidContent = () => {
        if (loading && paidBills.length === 0) {
            return (
                <View style={styles.emptyStateContainer}>
                    <Text style={styles.placeholderText}>Loading history...</Text>
                </View>
            );
        }

        let filteredGroups = paidBills;
        if (searchQuery.trim()) {
            filteredGroups = paidBills.map(group => ({
                ...group,
                bills: group.bills.filter(bill =>
                    bill.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    bill.description?.toLowerCase().includes(searchQuery.toLowerCase())
                )
            })).filter(group => group.bills.length > 0);
        }

        if (filteredGroups.length === 0 && !loading) {
            return (
                <View style={styles.emptyStateContainer}>
                    <View style={styles.iconContainer}>
                        <CheckCircle size={64} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyTitle}>
                        {searchQuery ? 'No matching paid bills.' : 'No paid bills yet.'}
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView
                style={styles.billsScrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.searchContainer}>
                    <Search size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search history..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {filteredGroups.map((group, index) => (
                    <View key={index} style={styles.monthGroup}>
                        <View style={styles.monthHeader}>
                            <Text style={styles.monthTitle}>{group.month}</Text>
                            <Text style={styles.monthTotal}>${group.total.toFixed(2)}</Text>
                        </View>
                        {group.bills.map(renderBillCard)}
                    </View>
                ))}
                <View style={{ height: 100 }} />
            </ScrollView>
        );
    };

    const renderRecurringContent = () => {
        if (loading && upcomingBills.length === 0) {
            return (
                <View style={styles.emptyStateContainer}>
                    <Text style={styles.placeholderText}>Loading subscriptions...</Text>
                </View>
            );
        }

        // Derive unique recurring bills (next due instance)
        // Deduplicate by Name/Description to avoid showing multiple subscriptions for the same service
        const allInstances = upcomingBills.flatMap(g => g.bills);
        const uniqueRecurring = [];
        const seenKeys = new Set();

        for (const bill of allInstances) {
            // Use description or category as the unique key
            const key = (bill.description || bill.category).toLowerCase().trim();
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueRecurring.push(bill);
            }
        }

        // Sort by Category Name or Bill Name? Or just keep sorted by Next Due?
        // Usually list of subscriptions is alphabetical or by amount. Let's keep existing sort (Due Date).

        if (uniqueRecurring.length === 0) {
            return (
                <View style={styles.emptyStateContainer}>
                    <View style={styles.iconContainer}>
                        <RefreshCw size={64} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyTitle}>No recurring bills found.</Text>
                </View>
            );
        }

        return (
            <ScrollView
                style={styles.billsScrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.monthGroup, { marginTop: 16 }]}>
                    {uniqueRecurring.map(bill => {
                        const iconName = getCategoryIcon(bill.category);
                        const IconComponent = LucideIcons[iconName] || LucideIcons.Tag;
                        const iconColor = getCategoryColor(bill.category);
                        const dateObj = new Date(bill.dueDate + 'T12:00:00');
                        const nextDueText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                        // Map frequency to nicer text
                        const freqMap = {
                            'Weekly': 'Every Week',
                            'Bi-weekly': 'Every 2 Weeks',
                            'Monthly': 'Every Month',
                            'Bimonthly': 'Every 2 Months',
                            'Yearly': 'Every Year',
                            'Quarterly': 'Every Quarter',
                            'Daily': 'Every Day'
                        };

                        const rawFreq = bill.recurrenceFrequency || 'Monthly';
                        const freqText = freqMap[rawFreq] || `Every ${rawFreq}`;

                        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

                        return (
                            <TouchableOpacity
                                key={bill.billId}
                                style={styles.billCard}
                                onPress={() => navigation.navigate('BillDetails', { bill })}
                            >
                                <View style={[styles.billIconCircle, { backgroundColor: iconColor + '20' }]}>
                                    <IconComponent size={24} color={iconColor} />
                                </View>
                                <View style={styles.billContent}>
                                    <Text style={styles.billCategory}>{bill.description || bill.category}</Text>
                                    <Text style={styles.billDateText}>{freqText} · {weekday}</Text>
                                    <Text style={styles.billDueText}>Next due · {nextDueText}</Text>
                                </View>
                                <View style={styles.billRight}>
                                    <Text style={styles.billAmount}>${bill.amount.toFixed(2)}</Text>
                                    <TouchableOpacity style={styles.refreshBtn}>
                                        <RefreshCw size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'UPCOMING':
                return renderUpcomingContent();
            case 'PAID':
                return renderPaidContent();
            case 'CALENDAR':
                return renderCalendarContent();
            case 'RECURRING':
                return renderRecurringContent();
            default:
                return (
                    <View style={styles.placeholderContainer}>
                        <Text style={styles.placeholderText}>{activeTab} Coming Soon</Text>
                    </View>
                );
        }
    };

    const handleBulkDelete = async () => {
        // Here we handle the delete logic.
        // For simplicity, we assume "Delete This Instance" (Skip) for recurring bills in bulk.
        // If we want "Delete Series", that's too complex for bulk mixed selection.
        Alert.alert(
            'Delete Bills',
            `Are you sure you want to delete ${selectedBills.size} bills?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // Process deletions in parallel
                            const deletePromises = Array.from(selectedBills).map(uniqueId => {
                                const parts = uniqueId.split('|');
                                if (parts.length < 2) return Promise.resolve();
                                const billId = parts[0];
                                const dueDate = parts[1];
                                return api.post('/bills/exception', {
                                    billId: parseInt(billId),
                                    originalDate: dueDate,
                                    isSkipped: true
                                });
                            });

                            await Promise.all(deletePromises);

                            // Refresh and exit
                            await fetchUpcomingBills();
                            exitSelectionMode();
                        } catch (error) {
                            console.error('Bulk delete failed:', error);
                            Alert.alert('Error', 'Failed to delete some bills.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleBulkMarkPaid = () => {
        Alert.alert(
            'Mark as Paid',
            `Mark ${selectedBills.size} bills as paid? This will create transactions for them and remove them from the upcoming list.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark Paid',
                    onPress: async () => {
                        try {
                            setLoading(true);

                            // Use local date for payment date
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = String(now.getMonth() + 1).padStart(2, '0');
                            const day = String(now.getDate()).padStart(2, '0');
                            const paymentDate = `${year}-${month}-${day}`;

                            // Process in parallel
                            const promises = Array.from(selectedBills).map(async uniqueId => {
                                const parts = uniqueId.split('|');
                                if (parts.length < 2) return;
                                const billIdStr = parts[0];
                                const dueDate = parts[1];
                                const billId = parseInt(billIdStr);

                                // Find the bill object to get details
                                let billObj = null;
                                for (const group of upcomingBills) {
                                    const found = group.bills.find(b => b.billId === billId && b.dueDate === dueDate);
                                    if (found) {
                                        billObj = found;
                                        break;
                                    }
                                }

                                if (!billObj) {
                                    console.error('CRITICAL: Could not find bill object for', billId, dueDate);
                                    return;
                                }

                                // 1. Create Transaction
                                const transactionData = {
                                    date: paymentDate,
                                    amount: billObj.amount,
                                    name: billObj.description || billObj.category, // Use desc if available (e.g. Hydro), else Category
                                    category: billObj.category,
                                    account_id: billObj.accountId,
                                    note: `Paid bill: ${billObj.category}`,
                                    transaction_id: `bill_pay_${billId}_${dueDate.replace(/-/g, '')}` // Unique ID to prevent dupes
                                };
                                await api.post('/transactions', transactionData);

                                // 2. Mark Bill Instance as Skipped (Hidden)
                                await api.post('/bills/exception', {
                                    billId: billId,
                                    originalDate: dueDate,
                                    isSkipped: true
                                });
                            });

                            await Promise.all(promises);

                            // Refresh and exit
                            await fetchUpcomingBills();
                            exitSelectionMode();
                            Alert.alert('Success', 'Bills marked as paid.');
                        } catch (error) {
                            console.error('Bulk mark paid failed:', error);
                            const msg = error.response?.data?.error || error.message || 'Unknown error';
                            Alert.alert('Error', `Failed to mark some bills as paid: ${msg}`);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderHeader = () => {
        if (isSelectionMode) {
            return (
                <View style={[styles.header, styles.selectionHeader]}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={exitSelectionMode} style={styles.iconBtn}>
                            <X size={24} color="#E2E8F0" />
                        </TouchableOpacity>
                        <Text style={styles.selectionCount}>{selectedBills.size}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity style={styles.iconBtn} onPress={handleBulkDelete}>
                            <Trash2 size={24} color="#DC2626" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={handleBulkMarkPaid}>
                            <Check size={24} color="#38BDF8" />
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconBtn}>
                    <Menu size={24} color="#E2E8F0" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Bills</Text>
                <View style={styles.headerRight}>
                    {activeTab !== 'PAID' && (
                        <TouchableOpacity style={styles.iconBtn}>
                            <SlidersHorizontal size={24} color="#38BDF8" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.iconBtn}>
                        <Download size={24} color="#38BDF8" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            {renderHeader()}

            {/* Selection Info Bar */}
            {isSelectionMode && (
                <View style={styles.selectionInfoBar}>
                    <Text style={styles.selectionInfoText}>Selected Bills</Text>
                    <Text style={styles.selectionInfoAmount}>${getSelectedTotal().toFixed(2)}</Text>
                </View>
            )}

            {/* Tabs (Hidden in selection mode? Or disabled? Screenshot implies visible but maybe pushed down) */}
            {!isSelectionMode && (
                <View style={styles.tabsContainer}>
                    {['UPCOMING', 'CALENDAR', 'RECURRING', 'PAID'].map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Content */}
            <View style={styles.content}>
                {renderContent()}
            </View>

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('EditTransaction', { mode: 'add', type: 'BILLS' })}
            >
                <Plus size={24} color="#FFF" />
            </TouchableOpacity>
            {/* Day Details Modal */}
            <Modal
                transparent={true}
                visible={showDayModal}
                animationType="slide"
                onRequestClose={() => setShowDayModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowDayModal(false)}
                >
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {modalTitle || (selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : '')}
                            </Text>
                            <TouchableOpacity onPress={() => setShowDayModal(false)} style={styles.closeBtn}>
                                <X size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScroll}>
                            {dayBills.length > 0 ? (
                                dayBills.map(bill => (
                                    <TouchableOpacity
                                        key={`${bill.billId}-${bill.dueDate}`}
                                        style={styles.modalBillCard}
                                        onPress={() => {
                                            setShowDayModal(false);
                                            navigation.navigate('BillDetails', { bill });
                                        }}
                                    >
                                        <View style={[styles.miniIconCircle, { backgroundColor: getCategoryColor(bill.category) + '20' }]}>
                                            <LucideIcons.Zap size={16} color={getCategoryColor(bill.category)} />
                                        </View>
                                        <View style={styles.billContent}>
                                            <Text style={styles.billCategory}>{bill.category}</Text>
                                            <Text style={[
                                                styles.billStatusText,
                                                bill.isPaid ? { color: '#10B981' } : (bill.isPastDue ? { color: '#EF4444' } : { color: '#F59E0B' })
                                            ]}>
                                                {bill.isPaid ? 'Paid' : (bill.isPastDue ? 'Overdue' : 'Upcoming')}
                                            </Text>
                                        </View>
                                        <Text style={styles.billAmount}>${bill.amount.toFixed(2)}</Text>
                                        <ArrowRight size={16} color="#94A3B8" style={{ marginLeft: 8 }} />
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={styles.emptyDayContainer}>
                                    <Text style={styles.emptyDayText}>No bills for this date.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B1120'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#0B1120',
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#F1F5F9',
        flex: 1,
        marginLeft: 16,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 16,
    },
    iconBtn: {
        padding: 4,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    selectionHeader: {
        backgroundColor: '#111827',
    },
    selectionCount: {
        fontSize: 20,
        fontWeight: '700',
        color: '#F1F5F9',
    },
    selectionInfoBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#111827',
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    selectionInfoText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#64748B',
    },
    selectionInfoAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F1F5F9',
    },
    billCardSelected: {
        backgroundColor: '#38BDF815',
        borderColor: '#38BDF8',
        borderWidth: 1,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#0B1120',
        paddingHorizontal: 4,
    },
    tabItem: {
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {
        borderBottomColor: '#38BDF8',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        letterSpacing: 0.5,
    },
    tabTextActive: {
        color: '#38BDF8',
    },
    content: {
        flex: 1,
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        marginTop: -60,
    },
    iconContainer: {
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 24,
        marginBottom: 16,
    },
    linkText: {
        fontSize: 14,
        color: '#38BDF8',
        fontWeight: '600',
        marginTop: 12,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 16,
        color: '#64748B',
    },
    fab: {
        position: 'absolute',
        bottom: 80,
        right: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#38BDF8',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        zIndex: 999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    // New styles for bills display
    billsScrollView: {
        flex: 1,
        backgroundColor: '#0B1120',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111827',
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#F1F5F9',
    },
    monthGroup: {
        marginBottom: 8,
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#0B1120',
    },
    monthTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F1F5F9',
    },
    monthTotal: {
        fontSize: 16,
        fontWeight: '700',
        color: '#38BDF8',
    },
    billCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111827',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    billIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    billContent: {
        flex: 1,
    },
    billCategory: {
        fontSize: 16,
        fontWeight: '600',
        color: '#E2E8F0',
        marginBottom: 4,
    },
    billDueText: {
        fontSize: 13,
        color: '#64748B',
    },
    billDateText: {
        fontSize: 12,
        color: '#475569',
        marginTop: 2,
    },
    billRight: {
        alignItems: 'flex-end',
    },
    billAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F1F5F9',
        marginBottom: 4,
    },
    refreshBtn: {
        padding: 4,
    },
    paidBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#10B981',
        borderRadius: 8,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#111827',
    },
    // Calendar Styles
    calendarContainer: {
        backgroundColor: '#0B1120',
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#111827',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '60%',
        paddingBottom: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#F1F5F9',
    },
    closeBtn: {
        padding: 4,
    },
    modalScroll: {
        padding: 16,
    },
    modalBillCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    miniIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    billStatusText: {
        fontSize: 12,
        marginTop: 2,
        fontWeight: '500',
    },
    emptyDayContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyDayText: {
        color: '#64748B',
        fontSize: 14,
    },
    // Summary Styles
    summaryContainer: {
        flexDirection: 'row',
        backgroundColor: '#111827',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#1E293B',
    },
    summaryAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F1F5F9',
        marginBottom: 4,
    },
    summaryLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#64748B',
    },
    summaryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});

export default Bills;
