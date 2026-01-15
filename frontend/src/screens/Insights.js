import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Modal, TextInput, Platform, Switch, SectionList, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomDatePicker from '../components/CustomDatePicker';
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Briefcase, Wallet, SlidersHorizontal, X, ShoppingBag, Coffee, Home, CreditCard, DollarSign, ArrowRightLeft, Check, Landmark } from 'lucide-react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import api from '../config/api';
import DonutChart from '../components/DonutChart';
import { CATEGORY_TAXONOMY, getParentCategory, getCategoryColor, getCategoryIcon } from '../constants/CategoryTaxonomy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TransactionFilterModal from '../components/TransactionFilterModal';

const Insights = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { width } = Dimensions.get('window');
    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const [activeTab, setActiveTab] = useState('Cash Flow'); // 'Cash Flow', 'Spending', 'Trends', 'Transactions'
    const [selectedDate, setSelectedDate] = useState(null); // { day, month, year } for Daily Detail
    const [chartMode, setChartMode] = useState('Chart'); // 'Chart', 'Calendar', 'Monthly'
    const [selectedMonthIdx, setSelectedMonthIdx] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const [dailyModalVisible, setDailyModalVisible] = useState(false);
    const [monthDetailModalVisible, setMonthDetailModalVisible] = useState(false);
    const [detailedMonth, setDetailedMonth] = useState(null); // { monthIndex: 0-11, year: YYYY }
    const [expandedModalSection, setExpandedModalSection] = useState(null); // 'income-past', 'income-future', 'expense-past', 'expense-future'
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [transactionFilterModalVisible, setTransactionFilterModalVisible] = useState(false);
    const [transactionFilters, setTransactionFilters] = useState({});
    const [groupBy, setGroupBy] = useState('Monthly'); // 'Monthly', 'Weekly', 'Bi-Weekly', 'Yearly', 'Custom'
    const [startDay, setStartDay] = useState('28'); // Default start day
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showDayOfWeekPicker, setShowDayOfWeekPicker] = useState(false);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 28));
    const [customStartDate, setCustomStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 28));
    const [customEndDate, setCustomEndDate] = useState(new Date(new Date().getFullYear() + 1, new Date().getMonth(), 27));
    const [datePickerTarget, setDatePickerTarget] = useState('single'); // 'single', 'customStart', 'customEnd'
    const [transactionsFilter, setTransactionsFilter] = useState('All'); // 'All', 'Expenses', 'Income', 'Transfer'
    const [spendingFilter, setSpendingFilter] = useState('Category'); // 'Category', 'Merchant', 'Income'
    const [includeBills, setIncludeBills] = useState(true);
    const [drillDownGroup, setDrillDownGroup] = useState(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);

    // Filter Tab State
    const [activeFilterTab, setActiveFilterTab] = useState('group'); // 'group', 'filter'
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountIds, setSelectedAccountIds] = useState([]);
    const [showAccountList, setShowAccountList] = useState(false); // To toggle visibility of account list

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [customCategories, setCustomCategories] = useState([]);

    const mergedTaxonomy = useMemo(() => {
        try {
            // Start with full static taxonomy (includes all system subcategories)
            const merged = JSON.parse(JSON.stringify(CATEGORY_TAXONOMY));

            // Add custom categories on top
            customCategories.forEach(cat => {
                if (!cat) return;
                if (cat.parent_category) {
                    if (merged[cat.parent_category]) {
                        if (merged[cat.parent_category].subcategories && !merged[cat.parent_category].subcategories.includes(cat.name)) {
                            merged[cat.parent_category].subcategories.push(cat.name);
                        }
                    } else {
                        // Parent doesn't exist in Taxonomy? Create dynamic parent
                        merged[cat.parent_category] = {
                            icon: 'tag',
                            color: '#64748B',
                            subcategories: [cat.name]
                        };
                    }
                } else {
                    if (!merged[cat.name] && !Object.keys(merged).includes(cat.name)) {
                        merged[cat.name] = {
                            icon: cat.icon || 'tag',
                            color: cat.color || '#64748B',
                            subcategories: []
                        };
                    }
                }
            });
            return merged;
        } catch (error) {
            console.error('Insights: Error calculating taxonomy', error);
            return CATEGORY_TAXONOMY; // Fallback
        }
    }, [customCategories]);

    useEffect(() => {
        if (isFocused) {
            fetchTransactions();
            fetchCustomCategories();
            fetchAccounts();
        }
    }, [isFocused]);

    const fetchAccounts = async () => {
        try {
            const res = await api.get('/accounts');
            if (res.data.accounts) {
                setAccounts(res.data.accounts);
            }
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
        }
    };

    const fetchCustomCategories = async () => {
        try {
            const res = await api.get('/categories');
            const cats = Array.isArray(res.data) ? res.data : (res.data.categories || []);
            setCustomCategories(cats);
        } catch (err) {
            console.error("Failed to fetch categories:", err);
        }
    };

    const fetchTransactions = async (forceRefresh = false) => {
        try {
            // Load from cache first for instant feedback (if empty and not forced)
            if (!forceRefresh && transactions.length === 0) {
                const cached = await AsyncStorage.getItem('transactions_cache');
                if (cached) {
                    setTransactions(JSON.parse(cached));
                    setLoading(false);
                }
            }

            const res = await api.get('/transactions', { params: { sync: forceRefresh } });
            if (res.data.transactions) {
                setTransactions(res.data.transactions);
                await AsyncStorage.setItem('transactions_cache', JSON.stringify(res.data.transactions));
            }

            // check for sync errors
            if (res.data.sync_errors && res.data.sync_errors.length > 0) {
                const errorMsg = res.data.sync_errors.map(e => `${e.institution}: ${e.code}`).join('\n');
                Alert.alert(
                    'Sync Warning',
                    `Some accounts could not be refreshed:\n${errorMsg}\n\nPlease check your connection in the Accounts tab.`
                );
            }
        } catch (error) {
            console.error("Failed to fetch transactions:", error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTransactions(true);
        setRefreshing(false);
    };

    // --- DATA PROCESSING ---
    // --- DATA PROCESSING ---
    const { chartData, projectedData, allMonthsData, currentMonthData, maxAbsValue } = useMemo(() => {
        if (transactions.length === 0) return { chartData: [], projectedData: [], allMonthsData: [], currentMonthData: {}, maxAbsValue: 1 };

        const groups = new Map();
        const monthlyGroups = new Map(); // Separate map for the Monthly List tab

        // Helper to get ISO week or aligned week
        // Helper to get ISO week or aligned week
        const getWeekKey = (d, startConfig) => {
            const targetDayStr = parseInt(startDay) || 7;
            const targetDay = targetDayStr === 7 ? 0 : targetDayStr; // 0-6

            const currentDay = d.getDay();
            let diff = currentDay - targetDay;
            if (diff < 0) diff += 7;

            const weekStart = new Date(d);
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(d.getDate() - diff);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            const f = date => `${monthAbbr[date.getMonth()]} ${date.getDate()}`;
            const label = `${f(weekStart)} - ${f(weekEnd)}`;

            // Key by Week Start Date
            return {
                key: `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`,
                label: label,
                sortVal: weekStart.getTime(),
                start: weekStart
            };
        };

        transactions.forEach(t => {
            if (t.is_transfer) return;
            if (selectedAccountIds.length > 0 && !selectedAccountIds.includes(t.account_id)) return;

            const amt = parseFloat(t.amount);
            if (isNaN(amt)) return;
            // Ensure strictly using YYYY-MM-DD to avoid timezone shifts if possible, but Date object is safer 
            const [y, m, dVal] = t.date.split('-').map(Number);
            const d = new Date(y, m - 1, dVal);

            // --- 1. Compute Main Groups (based on groupBy) ---
            let key, mainLabel, subLabel, sortVal, startDateObj, yearNumVal;

            if (groupBy === 'Weekly') {
                const info = getWeekKey(d);
                key = info.key;
                mainLabel = info.label;

                // Calculate week end to check for cross-year
                const wEnd = new Date(info.start);
                wEnd.setDate(wEnd.getDate() + 6);

                // If years differ, show both or show end year? 
                // User requirement: "show jan 3 2026".
                // If we set subLabel to end year, it renders "Dec 28 - Jan 3 2026".
                // If we set subLabel to "2025 / 2026", it might be clearer.
                // But generally "Dec 28 - Jan 3 2026" is interpreted as "ending in 2026".
                subLabel = info.start.getFullYear() !== wEnd.getFullYear()
                    ? wEnd.getFullYear().toString()
                    : info.start.getFullYear().toString();

                sortVal = info.start.getTime();
                startDateObj = info.start;
                // Use End Year for the Year Display (so Dec 28 2025 - Jan 3 2026 shows 2026)
                yearNumVal = wEnd.getFullYear();
            } else if (groupBy === 'Bi-Weekly') {
                // TRUE Bi-Weekly Logic aligned with Header "getPeriodRange"
                // Logic: Anchor to `startDate` (e.g. Dec 28). Buckets are 14 days from there.

                // If no startDate provided, fallback to weekly or simple epoch?
                // Assuming startDate is set if using Bi-Weekly Custom mode. If not, use Jan 1.
                const anchor = startDate ? new Date(startDate) : new Date(y, 0, 1);
                anchor.setHours(0, 0, 0, 0);

                // Diff in days from anchor
                const diffTime = d.getTime() - anchor.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                // Find 14-day bucket index
                // Note: diffDays can be negative if transaction is before anchor.
                // Math.floor handles negatives correctly (-5 / 14 = -1).

                const periodIndex = Math.floor(diffDays / 14);

                // Start of this 14-day period
                const biWeekStart = new Date(anchor);
                biWeekStart.setDate(anchor.getDate() + (periodIndex * 14));

                // End of this 14-day period
                const biWeekEnd = new Date(biWeekStart);
                biWeekEnd.setDate(biWeekStart.getDate() + 13);

                const f = date => `${monthAbbr[date.getMonth()]} ${date.getDate()}`;
                mainLabel = `${f(biWeekStart)} - ${f(biWeekEnd)}`;

                key = `${biWeekStart.getFullYear()}-${biWeekStart.getMonth()}-${biWeekStart.getDate()}`;
                subLabel = biWeekStart.getFullYear() !== biWeekEnd.getFullYear()
                    ? biWeekEnd.getFullYear().toString()
                    : biWeekStart.getFullYear().toString();

                sortVal = biWeekStart.getTime();
                startDateObj = biWeekStart;
                // Use End Year
                yearNumVal = biWeekEnd.getFullYear();

            } else if (groupBy === 'Yearly') {
                // Precise Fiscal Year Logic
                const config = startDate || new Date();
                const sMonth = config.getMonth(); // 0-11
                const sDateVal = config.getDate();

                // Determine which fiscal bucket 'd' belongs to.
                // Bucket Start for Year Y: Date(Y, sMonth, sDateVal)
                // If d >= Start(Y), it's in Fiscal Y.
                // Else it's in Fiscal Y-1.

                let checkYear = d.getFullYear();
                let startOfFiscal = new Date(checkYear, sMonth, sDateVal);

                let fiscalY = checkYear;
                if (d < startOfFiscal) {
                    fiscalY = checkYear - 1;
                    startOfFiscal = new Date(fiscalY, sMonth, sDateVal);
                }

                key = `${fiscalY}`;
                // Label: "Dec 28 2025 - ..."
                const endOfFiscal = new Date(startOfFiscal);
                endOfFiscal.setFullYear(endOfFiscal.getFullYear() + 1);
                endOfFiscal.setDate(endOfFiscal.getDate() - 1);

                const f = dt => `${monthAbbr[dt.getMonth()]} ${dt.getDate()} ${dt.getFullYear()}`;

                mainLabel = `${f(startOfFiscal)} - ${f(endOfFiscal)}`;
                subLabel = ''; // Clear subLabel so year is not duplicated in card
                sortVal = startOfFiscal.getTime();
                startDateObj = startOfFiscal;
                yearNumVal = fiscalY;

            } else { // Monthly
                // Precise Fiscal Month Logic
                // sDay (1-31).
                // d.
                const sDayInt = parseInt(startDay) || 1;

                // If d.getDate() >= sDayInt, it belongs to Month M.
                // Else Month M-1.

                let fiscalM = d.getMonth();
                let fiscalY = d.getFullYear();

                if (d.getDate() < sDayInt) {
                    fiscalM--;
                    if (fiscalM < 0) {
                        fiscalM = 11;
                        fiscalY--;
                    }
                }

                // Key needs to be sortable and unique
                key = `${fiscalY}-${fiscalM}`;

                const sDate = new Date(fiscalY, fiscalM, sDayInt);
                const eDate = new Date(fiscalY, fiscalM + 1, sDayInt - 1);

                const f = (date) => `${monthAbbr[date.getMonth()]} ${date.getDate()}`;
                if (sDayInt > 1) {
                    // Match the precise formatting from getPeriodRange
                    if (sDate.getFullYear() !== eDate.getFullYear()) {
                        mainLabel = `${f(sDate)}, ${sDate.getFullYear()} - ${f(eDate)}, ${eDate.getFullYear()}`;
                    } else {
                        mainLabel = `${f(sDate)} - ${f(eDate)}, ${eDate.getFullYear()}`;
                    }
                    startDateObj = sDate;
                    subLabel = ''; // Clear subLabel
                } else {
                    mainLabel = `${months[fiscalM]} ${fiscalY}`;
                    startDateObj = new Date(fiscalY, fiscalM, 1);
                    subLabel = ''; // Clear subLabel since year is in mainLabel now
                }
                yearNumVal = fiscalY;
                sortVal = sDate.getTime();
                startDateObj = sDate;
            }

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    monthLabel: mainLabel,
                    yearLabel: subLabel,
                    yearNum: yearNumVal || y, // Fallback to transaction year if logic fails
                    sortVal,
                    date: startDateObj || d,
                    startDate: startDateObj || d,
                    income: 0,
                    expenses: 0,
                    balance: 0,
                    transactions: []
                });
            }

            const g = groups.get(key);
            if (amt < 0) g.income += Math.abs(amt);
            else g.expenses += amt;
            g.balance = g.income - g.expenses;
            g.transactions.push(t);

            // --- 2. Compute Monthly Groups (ALWAYS, for List Tab) ---
            {
                // FORCE Standard Monthly Grouping (Start Day = 1) for the List View
                // This ensures the "Monthly" list always shows "January", "February" etc.
                // regardless of the custom start day used for Charts/Projected view.
                const sDayInt = 1;

                let fiscalM = d.getMonth();
                let fiscalY = d.getFullYear();

                // Since sDayInt is 1, fiscalM is just d.getMonth().
                // The check (d.getDate() < 1) is impossible, so logic simplifies,
                // but keeping structure for safety is fine.

                const mKey = `${fiscalY}-${fiscalM}`;
                let mLabel, mSubLabel, mStartDate;

                const sDate = new Date(fiscalY, fiscalM, 1);
                // mLabel should be "January 2026"
                mLabel = `${months[fiscalM]} ${fiscalY}`;
                mStartDate = sDate;
                mSubLabel = '';

                if (!monthlyGroups.has(mKey)) {
                    monthlyGroups.set(mKey, {
                        key: mKey,
                        monthLabel: mLabel,
                        yearLabel: mSubLabel,
                        yearNum: fiscalY,
                        sortVal: mStartDate.getTime(),
                        date: mStartDate,
                        startDate: mStartDate,
                        income: 0,
                        expenses: 0,
                        balance: 0,
                        transactions: []
                    });
                }
                const mg = monthlyGroups.get(mKey);
                if (amt < 0) mg.income += Math.abs(amt);
                else mg.expenses += amt;
                mg.balance = mg.income - mg.expenses;
                mg.transactions.push(t);
            }
        });

        // Process Main Groups
        const sorted = Array.from(groups.values()).sort((a, b) => a.sortVal - b.sortVal);

        const cData = sorted.map(g => {
            return {
                value: g.balance,
                label: g.monthLabel.length > 8 ? g.monthLabel.substring(0, 6) + '..' : g.monthLabel, // truncate label for chart
                frontColor: g.balance >= 0 ? '#10B981' : '#F59E0B',
            };
        });

        const maxAbsValue = Math.max(...cData.map(d => Math.abs(d.value)), 1);

        const pData = sorted.map((g, idx) => {
            const prev = sorted[idx - 1];
            const incomePct = prev && prev.income > 0 ? ((g.income - prev.income) / prev.income) * 100 : 0;
            const expensePct = prev && prev.expenses > 0 ? ((g.expenses - prev.expenses) / prev.expenses) * 100 : 0;

            return {
                id: g.key,
                month: g.monthLabel, // Full Label
                year: g.yearNum, // Pass numeric year for potential use, but label has it.
                date: g.date,
                income: g.income,
                expenses: g.expenses,
                balance: g.balance,
                transactionCount: g.transactions.length,
                incomePct,
                expensePct
            };
        }).reverse();

        // Process Monthly History (Always Monthly)
        const sortedMonths = Array.from(monthlyGroups.values()).sort((a, b) => a.sortVal - b.sortVal);
        const allMonthsData = sortedMonths.map((g, idx) => {
            const prev = sortedMonths[idx - 1];
            const incomePct = prev && prev.income > 0 ? ((g.income - prev.income) / prev.income) * 100 : 0;
            const expensePct = prev && prev.expenses > 0 ? ((g.expenses - prev.expenses) / prev.expenses) * 100 : 0;
            return {
                id: g.key,
                month: g.monthLabel,
                year: g.yearNum,
                date: g.date,
                income: g.income,
                expenses: g.expenses,
                balance: g.balance,
                transactionCount: g.transactions.length,
                incomePct,
                expensePct
            };
        }).reverse();

        return { chartData: cData, projectedData: pData, allMonthsData, currentMonthData: null, maxAbsValue };

    }, [transactions, groupBy, startDay, startDate, selectedAccountIds]);

    // --- DATE LOGIC ---
    const [currentDate, setCurrentDate] = useState(new Date());

    const getPeriodRange = (mode, date, startDayVal, startDateConfig) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const sDay = parseInt(startDayVal) || 1;

        if (mode === 'Weekly') {
            // Nearest Sunday
            const day = d.getDay(); // 0 is Sunday
            const diff = d.getDate() - day; // adjust when day is sunday
            const start = new Date(d.setDate(diff));
            const end = new Date(start);
            end.setDate(start.getDate() + 6);

            const f = date => `${monthAbbr[date.getMonth()]} ${date.getDate()}`;
            return {
                start,
                end,
                label: `${f(start)} - ${f(end)}`
            };
        } else if (mode === 'Bi-Weekly') {
            const day = d.getDay();
            const diff = d.getDate() - day;
            const start = new Date(d.setDate(diff));
            const end = new Date(start);
            end.setDate(start.getDate() + 13);

            const f = date => `${monthAbbr[date.getMonth()]} ${date.getDate()}`;
            return {
                start,
                end,
                label: `${f(start)} - ${f(end)}`
            };
        } else if (mode === 'Yearly') {
            // Fiscal Year
            // If startDateConfig is Dec 28, 2025.
            // And currentDate is in 2026.
            // We want the range Dec 28, 2025 - Dec 27, 2026 IF currentDate falls in it?
            // OR simply: Use currentDate's year as the 'anchor' year, but start from the configured Month/Day.

            const configDate = startDateConfig || new Date(); // Default or User Configured Start Date
            const sMonth = configDate.getMonth();
            const sDateVal = configDate.getDate();

            let anchorYear = d.getFullYear();

            // Construct the start date for this anchor year
            let start = new Date(anchorYear, sMonth, sDateVal);

            // If current date 'd' is BEFORE this calculated start date,
            // then 'd' belongs to the fiscal cycle that started in the PREVIOUS year.
            if (d < start) {
                start.setFullYear(anchorYear - 1);
            }

            let end = new Date(start);
            end.setFullYear(start.getFullYear() + 1);
            end.setDate(end.getDate() - 1);

            const f = date => `${monthAbbr[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
            return {
                start,
                end,
                label: `${f(start)} - ${f(end)}`
            };
        } else { // Monthly
            // Standard Monthly
            if (sDay === 1) {
                const start = new Date(d.getFullYear(), d.getMonth(), 1);
                const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                return {
                    start,
                    end,
                    label: `${months[d.getMonth()]} ${d.getFullYear()}`
                };
            } else {
                // Custom Start Day
                const year = d.getFullYear();
                const month = d.getMonth();

                let start, end;
                // If current day is >= startDay, period starts in THIS month.
                // If current day < startDay, period started in PREVIOUS month.
                if (d.getDate() >= sDay) {
                    start = new Date(year, month, sDay);
                    end = new Date(year, month + 1, sDay - 1);
                } else {
                    start = new Date(year, month - 1, sDay);
                    end = new Date(year, month, sDay - 1);
                }

                const f = date => `${monthAbbr[date.getMonth()]} ${date.getDate()}`;
                let label;
                if (start.getFullYear() !== end.getFullYear()) {
                    label = `${f(start)}, ${start.getFullYear()} - ${f(end)}, ${end.getFullYear()}`;
                } else {
                    label = `${f(start)} - ${f(end)}, ${end.getFullYear()}`;
                }

                return {
                    start,
                    end,
                    label
                };
            }
        }
    };

    const changePeriod = (delta) => {
        const newDate = new Date(currentDate);
        if (groupBy === 'Weekly') {
            newDate.setDate(newDate.getDate() + (delta * 7));
        } else if (groupBy === 'Bi-Weekly') {
            newDate.setDate(newDate.getDate() + (delta * 14));
        } else if (groupBy === 'Yearly') {
            newDate.setFullYear(newDate.getFullYear() + delta);
        } else {
            newDate.setMonth(newDate.getMonth() + delta);
        }
        setCurrentDate(newDate);

        // Keep old state in sync for now if needed, or deprecate
        setSelectedMonthIdx(newDate.getMonth());
        setSelectedYear(newDate.getFullYear());
    };

    const renderCalendar = () => {
        const firstDay = new Date(selectedYear, selectedMonthIdx, 1);
        const lastDay = new Date(selectedYear, selectedMonthIdx + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        // Get daily transactions for the month
        const dailyBalances = {};
        transactions.forEach(t => {
            if (t.is_transfer) return;
            const d = new Date(t.date);
            if (d.getMonth() === selectedMonthIdx && d.getFullYear() === selectedYear) {
                const day = d.getDate();
                if (!dailyBalances[day]) {
                    dailyBalances[day] = { income: 0, expenses: 0, balance: 0 };
                }
                const amt = parseFloat(t.amount);
                if (!isNaN(amt)) {
                    if (amt < 0) {
                        dailyBalances[day].income += Math.abs(amt);
                    } else {
                        dailyBalances[day].expenses += amt;
                    }
                    dailyBalances[day].balance = dailyBalances[day].income - dailyBalances[day].expenses;
                }
            }
        });

        const weeks = [];
        let week = [];

        // Add empty cells for days before the first of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            week.push(null);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            week.push(day);
            if (week.length === 7) {
                weeks.push(week);
                week = [];
            }
        }

        // Add remaining days to complete the last week
        if (week.length > 0) {
            while (week.length < 7) {
                week.push(null);
            }
            weeks.push(week);
        }

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        return (
            <View style={styles.calendar}>
                {/* Day headers */}
                <View style={styles.calendarHeader}>
                    {dayNames.map((day, idx) => (
                        <Text key={idx} style={styles.calendarDayName}>{day}</Text>
                    ))}
                </View>

                {/* Calendar weeks */}
                {weeks.map((week, weekIdx) => (
                    <View key={weekIdx} style={styles.calendarWeek}>
                        {week.map((day, dayIdx) => {
                            const balance = day ? dailyBalances[day]?.balance || 0 : 0;
                            const hasData = day && dailyBalances[day];
                            const isSelected = selectedDate &&
                                selectedDate.day === day &&
                                selectedDate.month === selectedMonthIdx &&
                                selectedDate.year === selectedYear;

                            return (
                                <TouchableOpacity
                                    key={dayIdx}
                                    style={[styles.calendarDay, isSelected && styles.calendarDaySelected]}
                                    onPress={() => {
                                        if (day) {
                                            setSelectedDate({ day, month: selectedMonthIdx, year: selectedYear });
                                            setDailyModalVisible(true);
                                        }
                                    }}
                                    disabled={!day}
                                >
                                    {day ? (
                                        <>
                                            <Text style={styles.calendarDayNumber}>{day}</Text>
                                            {hasData && (
                                                <Text style={[
                                                    styles.calendarDayBalance,
                                                    { color: balance >= 0 ? '#10B981' : '#F59E0B' }
                                                ]}>
                                                    {balance >= 0 ? '+' : ''}{Math.floor(balance)}
                                                </Text>
                                            )}
                                        </>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </View>
        );
    };

    const renderDailyDetail = () => {
        if (!selectedDate) return null;

        const dateStr = `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`;
        const dayTransactions = transactions.filter(t => {
            if (t.is_transfer) return false;
            if (selectedAccountIds.length > 0 && !selectedAccountIds.includes(t.account_id)) return false;
            return t.date === dateStr;
        });

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const date = new Date(selectedDate.year, selectedDate.month, selectedDate.day);
        const dayName = dayNames[date.getDay()];
        const monthName = monthNames[selectedDate.month];

        let totalIncome = 0;
        let totalExpense = 0;
        dayTransactions.forEach(t => {
            const amt = parseFloat(t.amount);
            if (!isNaN(amt)) {
                if (amt < 0) {
                    totalIncome += Math.abs(amt);
                } else {
                    totalExpense += amt;
                }
            }
        });
        const balance = totalIncome - totalExpense;

        const expenses = dayTransactions.filter(t => parseFloat(t.amount) > 0);
        const income = dayTransactions.filter(t => parseFloat(t.amount) < 0);

        return (
            <View style={styles.dailyDetailContainer}>
                {/* Header */}
                <View style={styles.dailyDetailHeader}>
                    <Text style={styles.dailyDetailDate}>{dayName}, {selectedDate.day} {monthName} {selectedDate.year}</Text>
                    <TouchableOpacity onPress={() => setSelectedDate(null)} style={styles.closeButton}>
                        <Text style={{ color: '#10B981', fontSize: 24 }}>×</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Expenses */}
                    {expenses.length > 0 && (
                        <View style={styles.dailySection}>
                            <View style={styles.dailySectionHeader}>
                                <Text style={styles.dailySectionTitle}>Expenses</Text>
                                <Text style={styles.dailySectionAmount}>${totalExpense.toFixed(2)}</Text>
                            </View>
                            {expenses.map((t, idx) => (
                                <TouchableOpacity
                                    key={t.transaction_id || idx}
                                    style={styles.dailyTransactionItem}
                                    onPress={() => navigation.navigate('EditTransaction', { transaction: t, mode: 'edit' })}
                                >
                                    <View style={styles.dailyTransactionIcon}>
                                        <Text style={{ color: '#FFF', fontSize: 12 }}>{t.name?.charAt(0) || 'T'}</Text>
                                    </View>
                                    <View style={styles.dailyTransactionInfo}>
                                        <Text style={styles.dailyTransactionName}>{t.name}</Text>
                                        <Text style={styles.dailyTransactionMeta}>
                                            Today, {new Date(t.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} • {t.category || 'Uncategorized'}
                                        </Text>
                                        <Text style={styles.dailyTransactionAccount}>{t.account_name || 'Account'}</Text>
                                    </View>
                                    <Text style={styles.dailyTransactionAmount}>${Math.abs(t.amount).toFixed(2)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Income */}
                    {income.length > 0 && (
                        <View style={styles.dailySection}>
                            <View style={styles.dailySectionHeader}>
                                <Text style={styles.dailySectionTitle}>Income</Text>
                                <Text style={[styles.dailySectionAmount, { color: '#10B981' }]}>${totalIncome.toFixed(2)}</Text>
                            </View>
                            {income.map((t, idx) => (
                                <TouchableOpacity
                                    key={t.transaction_id || idx}
                                    style={styles.dailyTransactionItem}
                                    onPress={() => navigation.navigate('EditTransaction', { transaction: t, mode: 'edit' })}
                                >
                                    <View style={styles.dailyTransactionIcon}>
                                        <Text style={{ color: '#FFF', fontSize: 12 }}>{t.name?.charAt(0) || 'T'}</Text>
                                    </View>
                                    <View style={styles.dailyTransactionInfo}>
                                        <Text style={styles.dailyTransactionName}>{t.name}</Text>
                                        <Text style={styles.dailyTransactionMeta}>
                                            Today, {new Date(t.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} • {t.category || 'Uncategorized'}
                                        </Text>
                                        <Text style={styles.dailyTransactionAccount}>{t.account_name || 'Account'}</Text>
                                    </View>
                                    <Text style={[styles.dailyTransactionAmount, { color: '#10B981' }]}>${Math.abs(t.amount).toFixed(2)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Balance */}
                    <View style={styles.dailyBalanceSection}>
                        <Text style={styles.dailyBalanceLabel}>Balance</Text>
                        <Text style={styles.dailyBalanceDate}>{dayName}, {selectedDate.day} {monthName} {selectedDate.year}</Text>
                        <Text style={[styles.dailyBalanceAmount, { color: balance >= 0 ? '#10B981' : '#F59E0B' }]}>
                            {balance >= 0 ? '' : '- '}${Math.abs(balance).toFixed(2)}
                        </Text>
                    </View>

                    {/* Summary */}
                    <View style={styles.dailySummarySection}>
                        <View style={styles.dailySummaryHeader}>
                            <Text style={styles.dailySummaryTitle}>Summary</Text>
                            <Text style={styles.dailySummaryRange}>{monthName} {selectedDate.day} - {monthName} {selectedDate.day}</Text>
                        </View>
                        <View style={styles.dailySummaryRow}>
                            <Text style={styles.dailySummaryLabel}>Total Income</Text>
                            <Text style={[styles.dailySummaryValue, { color: '#10B981' }]}>${totalIncome.toFixed(2)}</Text>
                        </View>
                        <View style={styles.dailySummaryRow}>
                            <Text style={styles.dailySummaryLabel}>Total Expense</Text>
                            <Text style={styles.dailySummaryValue}>- ${totalExpense.toFixed(2)}</Text>
                        </View>
                        <View style={styles.dailySummaryRow}>
                            <Text style={styles.dailySummaryLabelBold}>Balance (Overall)</Text>
                            <Text style={[styles.dailySummaryValueBold, { color: balance >= 0 ? '#10B981' : '#F59E0B' }]}>
                                {balance >= 0 ? '' : '- '}${Math.abs(balance).toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </View>
        );
    };

    // --- TRANSACTIONS TAB HELPERS ---
    const formatDateHeader = (dateStr) => {
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short', year: 'numeric' });
    };

    const formatTime = (timeStr) => {
        const actualTime = timeStr || '12:00';
        try {
            let [hours, minutes] = actualTime.split(':').map(Number);
            const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const minutesStr = minutes < 10 ? '0' + minutes : minutes;
            return `${hours}:${minutesStr} ${ampm}`;
        } catch (e) {
            return timeStr;
        }
    };

    const formatCategory = (category) => {
        if (!category) return 'Uncategorized';
        const words = category.split(' ');
        if (words.length > 3) {
            return words.slice(0, 2).join(' ') + '...';
        }
        return category;
    };

    const getTransactionDisplayName = (t) => {
        if (t.merchant_name) return t.merchant_name;
        const cat = t.personal_finance_category?.primary || t.category?.[0];
        if (cat) return formatCategory(cat);
        return t.name;
    };

    const getIconForCategory = (category) => {
        const iconName = getCategoryIcon(category, mergedTaxonomy);
        const IconComponent = getIconComponent(iconName);
        return <IconComponent size={20} color="#FFF" />;
    };

    const getIconComponent = (name) => {
        const map = {
            'shopping-bag': ShoppingBag,
            'coffee': Coffee,
            'home': Home,
            'repeat': ArrowRightLeft,
            'arrow-right-left': ArrowRightLeft,
            'trending-up': DollarSign,
            'dollar-sign': DollarSign,
            'credit-card': CreditCard,
            // Add more mappings as needed based on available imports
        };
        return map[name] || CreditCard;
    };

    const getAccountIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'depository': return <Wallet size={12} color="#64748B" />;
            case 'credit': return <CreditCard size={12} color="#64748B" />;
            default: return <Landmark size={12} color="#64748B" />;
        }
    };

    const getIconColor = (category) => {
        return getCategoryColor(category, mergedTaxonomy);
    };

    const renderTransactionsTab = () => {
        // Use useMemo to avoid re-filtering on every render if possible, 
        // but since we are inside a function, we'll execute it directly.
        // Assuming the filter operation itself is fast enough (<50ms for <5k items).
        // The main bottleneck was rendering the ScrollView.

        const filtered = transactions.filter(t => {
            // 1. Type Filter
            let matchesType = true;
            if (transactionsFilter === 'Expenses') matchesType = t.amount > 0;
            else if (transactionsFilter === 'Income') matchesType = t.amount < 0;
            else if (transactionsFilter === 'Transfer') matchesType = !!t.is_transfer;

            // 2. Category Filter
            let matchesCategory = true;
            if (transactionFilters.categories && transactionFilters.categories.length > 0) {
                matchesCategory = transactionFilters.categories.includes(t.category);
            }

            // 3. Account Filter
            let matchesAccount = true;
            if (transactionFilters.accounts && transactionFilters.accounts.length > 0) {
                matchesAccount = transactionFilters.accounts.includes(t.account_id);
            }

            // 4. Date Range
            let matchesDate = true;
            if (transactionFilters.dateRange && transactionFilters.dateRange.start) {
                const tDate = new Date(t.date);
                const start = new Date(transactionFilters.dateRange.start);
                if (transactionFilters.dateRange.end) {
                    matchesDate = tDate >= start && tDate <= new Date(transactionFilters.dateRange.end);
                } else {
                    matchesDate = tDate >= start;
                }
            }

            // 5. Amount Range
            let matchesAmount = true;
            if (transactionFilters.amountRange) {
                const absAmount = Math.abs(t.amount);
                const { min, max } = transactionFilters.amountRange;
                if (min && absAmount < parseFloat(min)) matchesAmount = false;
                if (max && absAmount > parseFloat(max)) matchesAmount = false;
            }

            // 6. Note/Search
            let matchesNote = true;
            if (transactionFilters.note) {
                const search = transactionFilters.note.toLowerCase();
                matchesNote = (t.merchant_name || t.name).toLowerCase().includes(search) ||
                    (t.category && t.category.toLowerCase().includes(search));
            }

            return matchesType && matchesCategory && matchesAccount && matchesDate && matchesAmount && matchesNote;
        });

        // Grouping for SectionList
        const sectionsMap = filtered.reduce((acc, t) => {
            const dateStr = t.date;
            if (!acc[dateStr]) {
                acc[dateStr] = { title: dateStr, data: [], total: 0 };
            }
            acc[dateStr].data.push(t);
            acc[dateStr].total += t.amount;
            return acc;
        }, {});

        const sections = Object.values(sectionsMap).sort((a, b) => new Date(b.title) - new Date(a.title));

        const renderItem = ({ item: t }) => (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('TransactionDetails', { transaction: t })}
            >
                <View style={styles.cardLeft}>
                    <View style={[styles.cardIcon, { backgroundColor: getIconColor(t.personal_finance_category?.primary) }]}>
                        {getIconForCategory(t.personal_finance_category?.primary)}
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle}>{getTransactionDisplayName(t)}</Text>
                        <Text style={styles.cardSubtitle}>
                            {new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{t.updated_at ? `, ${new Date(t.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''} • {formatCategory(t.personal_finance_category?.primary || t.category?.[0])}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                            {getAccountIcon(t.account_type)}
                            <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                                {[
                                    t.account_owner_name,
                                    t.institution_name?.split(' ')[0],
                                    t.account_subtype === 'credit card' ? 'CC' :
                                        t.account_subtype === 'checking' ? 'Chequing' :
                                            t.account_subtype === 'savings' ? 'Savings' :
                                                t.account_subtype === 'mortgage' ? 'Mortgage' :
                                                    t.account_subtype || t.account_type || 'Cash'
                                ].filter(Boolean).join(' · ')}
                            </Text>
                        </View>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.cardAmount, { color: t.amount < 0 ? '#10B981' : '#EF4444' }]}>
                        {t.amount < 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                    </Text>
                    {new Date(t.date) > new Date() && (
                        <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>Future</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );

        const renderSectionHeader = ({ section: { title, total } }) => (
            <View style={styles.dateHeader}>
                <Text style={styles.dateTitle}>{formatDateHeader(title)}</Text>
                <Text style={[styles.dateTotal, { color: total < 0 ? '#10B981' : '#FFF' }]}>
                    {total < 0 ? '+' : ''}${Math.abs(total).toFixed(2)}
                </Text>
            </View>
        );

        return (
            <View style={{ flex: 1 }}>
                <View style={styles.filterRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {['All', 'Expenses', 'Income', 'Transfer'].map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.filterPill, transactionsFilter === f && styles.activePill]}
                                onPress={() => setTransactionsFilter(f)}
                            >
                                <Text style={[styles.filterText, transactionsFilter === f && styles.activeFilterText]}>{f}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <TouchableOpacity style={styles.recurringLink}>
                    <Text style={{ color: '#E2E8F0', fontSize: 14 }}>View Recurring Transactions</Text>
                    <ChevronRight size={16} color="#94A3B8" />
                </TouchableOpacity>

                <SectionList
                    sections={sections}
                    keyExtractor={(item, index) => item.transaction_id || index.toString()}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={styles.listContent}
                    stickySectionHeadersEnabled={false}
                    initialNumToRender={12}
                    windowSize={5}
                    ListFooterComponent={<View style={{ height: 100 }} />}
                />
            </View>
        );
    };

    const renderSpendingTab = () => {
        const { start, end, label } = getPeriodRange(groupBy, currentDate, startDay, startDate);

        const filtered = transactions.filter(t => {
            if (t.is_transfer) return false;
            if (selectedAccountIds.length > 0 && !selectedAccountIds.includes(t.account_id)) return false;

            const [y, m, d] = t.date.split('-').map(Number);
            const txDate = new Date(y, m - 1, d);
            return txDate >= start && txDate <= end;
        });

        const typeFiltered = filtered.filter(t => {
            if (spendingFilter === 'Income') return t.amount < 0;
            return t.amount > 0;
        });

        const finalData = typeFiltered.filter(t => {
            if (!includeBills) {
                const cat = (t.personal_finance_category?.primary || t.category?.[0] || '').toLowerCase();
                if (cat.includes('bill') || cat.includes('utility') || cat.includes('rent') || cat.includes('subscription')) return false;
            }
            return true;
        });

        const grouped = finalData.reduce((acc, t) => {
            let key = 'Uncategorized';
            if (spendingFilter === 'Merchant') {
                key = t.name || t.merchant_name || 'Unknown';
            } else if (spendingFilter === 'Income') {
                // Group by specific subcategory for Income
                if (t.category && t.category.length > 0) {
                    key = t.category[t.category.length - 1];
                } else {
                    key = t.personal_finance_category?.primary || 'Income';
                }
            } else {
                key = getParentCategory(t.personal_finance_category?.primary || t.category?.[0] || 'Uncategorized', mergedTaxonomy);
            }

            if (!acc[key]) {
                acc[key] = {
                    name: key,
                    amount: 0,
                    count: 0,
                    color: spendingFilter === 'Category' || spendingFilter === 'Income' ? getCategoryColor(key, mergedTaxonomy) : '#94A3B8',
                    transactions: []
                };
            }
            acc[key].amount += Math.abs(t.amount);
            acc[key].count += 1;
            acc[key].transactions.push(t);
            return acc;
        }, {});

        const dataArray = Object.values(grouped).sort((a, b) => b.amount - a.amount);
        const total = dataArray.reduce((sum, item) => sum + item.amount, 0);

        const donutData = dataArray.map(item => ({ value: item.amount, color: item.color }));

        return (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.monthSelector}>
                    <TouchableOpacity onPress={() => changePeriod(-1)}>
                        <ChevronLeft size={24} color="#64748B" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={styles.monthTitle}>{label}</Text>
                        <Text style={styles.monthSubtitle}>{groupBy}</Text>
                    </View>
                    <TouchableOpacity onPress={() => changePeriod(1)}>
                        <ChevronRight size={24} color="#64748B" />
                    </TouchableOpacity>
                </View>

                <View style={styles.spendingCard}>
                    <View style={styles.spendingFilterContainer}>
                        {['Category', 'Merchant', 'Income'].map(mode => (
                            <TouchableOpacity
                                key={mode}
                                style={[styles.spendingPill, spendingFilter === mode && styles.spendingPillActive]}
                                onPress={() => setSpendingFilter(mode)}
                            >
                                <Text style={[styles.spendingPillText, spendingFilter === mode && styles.spendingPillTextActive]}>{mode}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ alignItems: 'center', marginVertical: 20 }}>
                        <DonutChart
                            data={donutData}
                            size={220}
                            strokeWidth={30}
                            centerLabel="Total"
                            centerValue={`$${Math.floor(total)}`}
                        />
                    </View>
                </View>

                {spendingFilter !== 'Income' && (
                    <View style={styles.toggleRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 4, height: 16, backgroundColor: '#64748B', borderRadius: 2, marginRight: 8 }} />
                            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Include Bills</Text>
                        </View>
                        <Switch
                            value={includeBills}
                            onValueChange={setIncludeBills}
                            trackColor={{ false: '#334155', true: '#0EA5E9' }}
                            thumbColor="#FFF"
                        />
                    </View>
                )}

                <View style={{ paddingHorizontal: 16 }}>
                    {dataArray.map((item, idx) => {
                        const pct = total > 0 ? (item.amount / total) * 100 : 0;
                        return (
                            <TouchableOpacity
                                key={idx}
                                style={styles.spendingItem}
                                onPress={() => { setDrillDownGroup(item); setSelectedSubcategory(null); }}
                            >
                                <View style={[styles.spendingIcon, { backgroundColor: item.color + '20' }]}>
                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                                </View>
                                <View style={{ flex: 1, marginHorizontal: 12 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={styles.spendingName}>{item.name}</Text>
                                        <Text style={styles.spendingAmount}>${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={styles.spendingPct}>{pct.toFixed(1)} %</Text>
                                        <View style={{ width: 60, height: 4, backgroundColor: '#334155', borderRadius: 2 }}>
                                            <View style={{ width: `${pct}%`, height: 4, backgroundColor: item.color, borderRadius: 2 }} />
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Drill Down Modal */}
                <Modal
                    visible={!!drillDownGroup}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setDrillDownGroup(null)}
                >
                    <View style={styles.drillDownOverlay}>
                        <View style={styles.drillDownContainer}>
                            <View style={styles.drillDownHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    {selectedSubcategory && (
                                        <TouchableOpacity onPress={() => setSelectedSubcategory(null)} style={{ paddingRight: 12 }}>
                                            <ChevronLeft size={24} color="#FFF" />
                                        </TouchableOpacity>
                                    )}
                                    <Text style={[styles.drillDownTitle, { textAlign: 'center', flex: 1, marginRight: selectedSubcategory ? 36 : 0 }]}>
                                        {selectedSubcategory ? selectedSubcategory.name : drillDownGroup?.name}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => { setDrillDownGroup(null); setSelectedSubcategory(null); }} style={{ padding: 8 }}>
                                    <X size={24} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 150 }}>
                                {(() => {
                                    if (!drillDownGroup) return null;

                                    // Category Drill Down Logic
                                    if (spendingFilter === 'Category' && !selectedSubcategory) {
                                        const subGroups = drillDownGroup.transactions.reduce((acc, t) => {
                                            const subName = (t.category && t.category.length > 0) ? t.category[t.category.length - 1] : 'Uncategorized';
                                            if (!acc[subName]) acc[subName] = { name: subName, amount: 0, transactions: [] };
                                            acc[subName].amount += Math.abs(t.amount);
                                            acc[subName].transactions.push(t);
                                            return acc;
                                        }, {});
                                        const subArray = Object.values(subGroups).sort((a, b) => b.amount - a.amount);
                                        const subTotal = drillDownGroup.amount;

                                        const subDonutData = subArray.map(s => ({ value: s.amount, color: drillDownGroup.color }));

                                        return (
                                            <View>
                                                <View style={{ alignItems: 'center', marginVertical: 10 }}>
                                                    <DonutChart data={subDonutData} size={150} strokeWidth={20} centerLabel="Total" centerValue={`$${Math.floor(subTotal)}`} />
                                                </View>
                                                {subArray.map((item, idx) => (
                                                    <TouchableOpacity key={idx} style={styles.spendingItem} onPress={() => setSelectedSubcategory(item)}>
                                                        <View style={[styles.spendingIcon, { backgroundColor: drillDownGroup.color + '20' }]}>
                                                            {getIconForCategory(item.name)}
                                                        </View>
                                                        <View style={{ flex: 1, marginHorizontal: 12 }}>
                                                            <Text style={styles.spendingName}>{item.name}</Text>
                                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                                <Text style={styles.spendingPct}>{((item.amount / subTotal) * 100).toFixed(1)} %</Text>
                                                                <Text style={styles.spendingAmount}>${item.amount.toFixed(2)}</Text>
                                                            </View>
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        );
                                    }

                                    // Transaction List
                                    const txList = selectedSubcategory ? selectedSubcategory.transactions : drillDownGroup.transactions;
                                    return txList.sort((a, b) => new Date(b.date) - new Date(a.date)).map((t, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={styles.drillDownItem}
                                            onPress={() => {
                                                setDrillDownGroup(null);
                                                setSelectedSubcategory(null);
                                                navigation.navigate('TransactionDetails', { transaction: t });
                                            }}
                                        >
                                            <View style={[styles.drillDownIcon, { backgroundColor: drillDownGroup.color + '20' }]}>
                                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: drillDownGroup.color }} />
                                            </View>
                                            <View style={{ flex: 1, marginHorizontal: 12 }}>
                                                <Text style={styles.drillDownName}>{getTransactionDisplayName(t)}</Text>
                                                <Text style={styles.drillDownDate}>{formatDateHeader(t.date)}</Text>
                                            </View>
                                            <Text style={[styles.drillDownAmount, { color: t.amount < 0 ? '#10B981' : '#FFF' }]}>
                                                {t.amount < 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                                            </Text>
                                        </TouchableOpacity>
                                    ));
                                })()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        );
    };

    const renderCashFlowTab = () => {
        if (loading) {
            return (
                <View style={[styles.chartArea, { height: 400 }]}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            );
        }

        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Month Selector */}
                <View style={styles.monthSelector}>
                    <TouchableOpacity onPress={() => changePeriod(-1)}>
                        <ChevronLeft size={24} color="#64748B" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={styles.monthTitle}>
                            {getPeriodRange(groupBy, currentDate, startDay, startDate).label}
                        </Text>
                        <Text style={styles.monthSubtitle}>{groupBy}</Text>
                    </View>
                    <TouchableOpacity onPress={() => changePeriod(1)}>
                        <ChevronRight size={24} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* Main Card */}
                <View style={styles.mainCard}>
                    {/* Inner Tabs (Chart/Calendar/Monthly) */}
                    <View style={styles.chartToggleContainer}>
                        {['Chart', 'Calendar', 'Monthly'].map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[styles.chartToggleBtn, chartMode === mode && styles.chartToggleBtnActive]}
                                onPress={() => setChartMode(mode)}
                            >
                                <Text style={[styles.chartToggleText, chartMode === mode && styles.chartToggleTextActive]}>{mode}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Chart/Calendar/Monthly Area */}
                    <View style={styles.chartArea}>
                        {/* Only show chart and calendar when not in Monthly mode */}
                        {chartMode !== 'Monthly' && (
                            <>
                                {chartMode === 'Chart' && chartData.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
                                        <View style={styles.customChartContainer}>
                                            {chartData.map((item, idx) => {
                                                const barHeight = (Math.abs(item.value) / maxAbsValue) * 140;
                                                return (
                                                    <View key={idx} style={styles.customBarWrapper}>
                                                        <Text style={styles.customBarValue}>
                                                            {Math.abs(item.value) > 0 ? Math.floor(Math.abs(item.value)) : ''}
                                                        </Text>
                                                        <View
                                                            style={[
                                                                styles.customBar,
                                                                {
                                                                    height: Math.max(barHeight, 10),
                                                                    backgroundColor: item.frontColor
                                                                }
                                                            ]}
                                                        />
                                                        <Text style={styles.customBarLabel}>{item.label}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </ScrollView>
                                )}

                                {chartMode === 'Calendar' && (
                                    <View style={styles.calendarContainer}>
                                        {renderCalendar()}
                                    </View>
                                )}

                                {chartData.length === 0 && (
                                    <Text style={{ color: '#94A3B8', marginTop: 20 }}>No data for this period</Text>
                                )}
                            </>
                        )}

                        {/* Monthly View - Show all months with transactions */}
                        {chartMode === 'Monthly' && (
                            <View style={styles.monthlyListContainer}>
                                {allMonthsData.filter(item =>
                                    item.transactionCount > 0 || item.income > 0 || item.expenses > 0
                                ).map((item, idx) => {
                                    const totalVolume = Math.max(item.income + item.expenses, 1);
                                    const incBar = (item.income / totalVolume) * 100;
                                    const expBar = (item.expenses / totalVolume) * 100;

                                    return (
                                        <TouchableOpacity
                                            key={`${item.month}-${item.year}`}
                                            style={styles.projectedCard}
                                            onPress={() => {
                                                const monthName = item.month.split(' ')[0];
                                                setDetailedMonth({ monthIndex: months.indexOf(monthName), year: item.year });
                                                setMonthDetailModalVisible(true);
                                            }}
                                        >
                                            <View style={styles.projectedHeader}>
                                                <Text style={styles.projectedMonth}>{item.month}</Text>
                                                <View style={styles.projectedBadges}>
                                                    {item.incomePct !== 0 && (
                                                        <View style={[styles.badgeUp, { backgroundColor: item.incomePct >= 0 ? '#064E3B' : '#451A03' }]}>
                                                            <Text style={[styles.badgeTextUp, { color: item.incomePct >= 0 ? '#10B981' : '#EF4444' }]}>
                                                                {item.incomePct >= 0 ? '↑' : '↓'} {Math.abs(item.incomePct).toFixed(1)}%
                                                            </Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.incomeText}>+ ${item.income.toLocaleString()}</Text>
                                                </View>
                                            </View>

                                            <View style={styles.progressBarBg}>
                                                <View style={[styles.progressBarFill, { width: `${incBar}%`, backgroundColor: '#10B981', zIndex: 1 }]} />
                                                <View style={[styles.progressBarFill, { width: `${expBar}%`, backgroundColor: '#F59E0B', position: 'absolute', top: 0, left: 0, opacity: 0.8 }]} />
                                            </View>

                                            <View style={styles.projectedFooter}>
                                                <Text style={styles.balanceText}>Balance <Text style={{ color: item.balance >= 0 ? '#10B981' : '#F59E0B' }}>{item.balance >= 0 ? '+' : '-'}${Math.abs(item.balance).toLocaleString()}</Text></Text>
                                                <View style={styles.projectedBadges}>
                                                    {item.expensePct !== 0 && (
                                                        <View style={[styles.badgeDown, { backgroundColor: item.expensePct <= 0 ? '#064E3B' : '#451A03' }]}>
                                                            <Text style={[styles.badgeTextDown, { color: item.expensePct <= 0 ? '#10B981' : '#EF4444' }]}>
                                                                {item.expensePct >= 0 ? '↑' : '↓'} {Math.abs(item.expensePct).toFixed(1)}%
                                                            </Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.expenseText}>- ${item.expenses.toLocaleString()}</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>


                    {/* Projected Section - Only show when not in Monthly mode */}
                    {chartMode !== 'Monthly' && (
                        <>
                            <View style={styles.projectedSectionHeader}>
                                <Text style={styles.sectionTitle}>
                                    {getPeriodRange(groupBy, currentDate, startDay, startDate).end < new Date(new Date().setHours(0, 0, 0, 0)) ? 'Actual' : 'Projected'}
                                </Text>
                                <TouchableOpacity>
                                    <Text style={styles.moreLink}>More {'>'}</Text>
                                </TouchableOpacity>
                            </View>

                            {projectedData.filter(item => {
                                // Filter to show ONLY the item corresponding to the current selected period
                                const { label } = getPeriodRange(groupBy, currentDate, startDay, startDate);
                                return item.month === label;
                            }).map((item, idx) => {
                                // Logic for progress bars
                                const totalVolume = Math.max(item.income + item.expenses, 1);
                                const incBar = (item.income / totalVolume) * 100;
                                const expBar = (item.expenses / totalVolume) * 100;

                                return (
                                    <TouchableOpacity
                                        key={`${item.month}-${item.year}`}
                                        style={styles.projectedCard}
                                        onPress={() => {
                                            // Check if it's a Week/Bi-Week OR a Custom Monthly Range (which has " - " in label)
                                            // The item.month is the label. If it has " - ", it's a range.
                                            const isRange = ['Weekly', 'Bi-Weekly'].includes(groupBy) || item.month.includes(' - ');

                                            if (isRange) {
                                                const start = new Date(item.date);
                                                let end;

                                                if (groupBy === 'Weekly') {
                                                    end = new Date(start);
                                                    end.setDate(start.getDate() + 6);
                                                } else if (groupBy === 'Bi-Weekly') {
                                                    end = new Date(start);
                                                    end.setDate(start.getDate() + 13);
                                                } else {
                                                    // Custom Monthly Range: End is Start + 1 Month - 1 Day
                                                    end = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1);
                                                }

                                                setDetailedMonth({
                                                    monthIndex: -1,
                                                    year: item.year,
                                                    range: {
                                                        start,
                                                        end,
                                                        label: item.month // Use the full label as is
                                                    }
                                                });
                                                setMonthDetailModalVisible(true);
                                            } else {
                                                // Standard Monthly (e.g. "January 2026")
                                                const monthName = item.month.split(' ')[0];
                                                setDetailedMonth({ monthIndex: months.indexOf(monthName), year: item.year });
                                                setMonthDetailModalVisible(true);
                                            }
                                        }}
                                    >
                                        <View style={styles.projectedHeader}>
                                            <Text style={styles.projectedMonth} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                                                {item.month}{['Weekly', 'Bi-Weekly'].includes(groupBy) ? ` ${item.year}` : ''}
                                            </Text>
                                            <View style={styles.projectedBadges}>
                                                {item.incomePct !== 0 && (
                                                    <View style={[styles.badgeUp, { backgroundColor: item.incomePct >= 0 ? '#064E3B' : '#451A03' }]}>
                                                        <Text style={[styles.badgeTextUp, { color: item.incomePct >= 0 ? '#10B981' : '#EF4444' }]}>
                                                            {item.incomePct >= 0 ? '↑' : '↓'} {Math.abs(item.incomePct).toFixed(1)}%
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={styles.incomeText}>+ ${item.income.toLocaleString()}</Text>
                                            </View>
                                        </View>

                                        {/* Progress Bar */}
                                        <View style={styles.progressBarBg}>
                                            <View style={[styles.progressBarFill, { width: `${incBar}%`, backgroundColor: '#10B981', zIndex: 1 }]} />
                                            {/* Expenses as separate bar or stacked? Screenshot 3 shows they might be separate indicators. 
                                   Let's put expense bar starting from left but underneath or transparent?
                                   Actually, let's just show Balance bar if positive (Green) else Orange? 
                                   Re-reading requirement: Screenshot 3 has Green bar and Orange bar. 
                                   Let's try 2 bars overlapping.
                               */}
                                            <View style={[styles.progressBarFill, { width: `${expBar}%`, backgroundColor: '#F59E0B', position: 'absolute', top: 0, left: 0, opacity: 0.8 }]} />
                                        </View>

                                        <View style={styles.projectedFooter}>
                                            <Text style={styles.balanceText}>Balance <Text style={{ color: item.balance >= 0 ? '#10B981' : '#F59E0B' }}>{item.balance >= 0 ? '+' : '-'}${Math.abs(item.balance).toLocaleString()}</Text></Text>
                                            <View style={styles.projectedBadges}>
                                                {item.expensePct !== 0 && (
                                                    <View style={[styles.badgeDown, { backgroundColor: item.expensePct <= 0 ? '#064E3B' : '#451A03' }]}>
                                                        <Text style={[styles.badgeTextDown, { color: item.expensePct <= 0 ? '#10B981' : '#EF4444' }]}>
                                                            {item.expensePct >= 0 ? '↑' : '↓'} {Math.abs(item.expensePct).toFixed(1)}%
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={styles.expenseText}>- ${item.expenses.toLocaleString()}</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </>
                    )}


                    <View style={{ height: 80 }} />
                </View>
            </ScrollView>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                    {/* Menu icon or Back icon depending on nav structure. Assuming drawer or main tab root */}
                    {/* For now, just a placeholder or Menu icon if it's top level */}
                    <View style={{ width: 20, height: 2, backgroundColor: '#3B82F6', marginBottom: 4 }}></View>
                    <View style={{ width: 20, height: 2, backgroundColor: '#3B82F6', marginBottom: 4 }}></View>
                    <View style={{ width: 14, height: 2, backgroundColor: '#3B82F6' }}></View>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Insights</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerIcon} onPress={() => {
                        if (activeTab === 'Transactions') {
                            setTransactionFilterModalVisible(true);
                        } else {
                            setFilterModalVisible(true);
                        }
                    }}>
                        <SlidersHorizontal color="#3B82F6" size={24} />
                    </TouchableOpacity>
                    {activeTab === 'Transactions' && (
                        <TouchableOpacity style={[styles.headerIcon, { justifyContent: 'center', alignItems: 'center' }]} onPress={onRefresh} disabled={refreshing}>
                            {refreshing ? (
                                <ActivityIndicator size="small" color="#3B82F6" />
                            ) : (
                                <Text style={{ color: '#3B82F6', fontSize: 28, marginTop: -11 }}>↻</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Top Tabs */}
            <View style={styles.tabBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['Cash Flow', 'Spending', 'Trends', 'Transactions'].map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                {tab.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {activeTab === 'Cash Flow' && renderCashFlowTab()}
            {activeTab === 'Spending' && renderSpendingTab()}
            {activeTab === 'Transactions' && renderTransactionsTab()}
            {['Trends'].includes(activeTab) && (
                <View style={styles.placeholderContainer}>
                    <Text style={styles.placeholderText}>{activeTab} coming soon</Text>
                </View>
            )}

            {/* Floating Add Button */}
            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('EditTransaction', { mode: 'add' })}>
                <Plus size={32} color="#FFF" />
            </TouchableOpacity>

            {/* Daily Detail Modal */}
            <Modal
                visible={dailyModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setDailyModalVisible(false)}
            >
                {selectedDate && (() => {
                    const dateStr = `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`;
                    const dayTransactions = transactions.filter(t => !t.is_transfer && t.date === dateStr);

                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const date = new Date(selectedDate.year, selectedDate.month, selectedDate.day);
                    const dayName = dayNames[date.getDay()];
                    const monthName = monthNames[selectedDate.month];

                    let totalIncome = 0;
                    let totalExpense = 0;
                    dayTransactions.forEach(t => {
                        const amt = parseFloat(t.amount);
                        if (!isNaN(amt)) {
                            if (amt < 0) totalIncome += Math.abs(amt);
                            else totalExpense += amt;
                        }
                    });
                    const balance = totalIncome - totalExpense;

                    const expenses = dayTransactions.filter(t => parseFloat(t.amount) > 0);
                    const income = dayTransactions.filter(t => parseFloat(t.amount) < 0);

                    return (
                        <View style={styles.drillDownOverlay}>
                            <View style={styles.drillDownContainer}>
                                {/* Modal Header */}
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalDate}>{dayName}, {selectedDate.day} {monthName} {selectedDate.year}</Text>
                                    <TouchableOpacity onPress={() => setDailyModalVisible(false)} style={styles.modalCloseBtn}>
                                        <Text style={{ color: '#10B981', fontSize: 28, fontWeight: '300' }}>×</Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView
                                    style={{ flex: 1 }}
                                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                                    showsVerticalScrollIndicator={false}
                                    bounces={true}
                                >
                                    {/* Expenses Section */}
                                    {expenses.length > 0 && (
                                        <View style={styles.modalSection}>
                                            <View style={styles.modalSectionHeader}>
                                                <Text style={styles.modalSectionTitle}>Expenses</Text>
                                                <Text style={styles.modalSectionAmount}>${totalExpense.toFixed(2)}</Text>
                                            </View>
                                            {expenses.map((t, idx) => (
                                                <TouchableOpacity
                                                    key={t.transaction_id || idx}
                                                    style={styles.modalTransactionItem}
                                                    onPress={() => {
                                                        setDailyModalVisible(false);
                                                        navigation.navigate('TransactionDetails', { transaction: t });
                                                    }}
                                                >
                                                    <View style={styles.modalTransactionIcon}>
                                                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
                                                            {t.name?.charAt(0).toUpperCase() || 'T'}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.modalTransactionInfo}>
                                                        <Text style={styles.modalTransactionName}>{getTransactionDisplayName(t)}</Text>
                                                        <Text style={styles.modalTransactionMeta}>
                                                            Today, {t.date.split('-')[2]} • {t.category || 'Uncategorized'}
                                                        </Text>
                                                        <Text style={styles.modalTransactionAccount}>🏦 {t.account_name || 'Account'}</Text>
                                                    </View>
                                                    <Text style={styles.modalTransactionAmount}>${Math.abs(t.amount).toFixed(2)}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Income Section */}
                                    {income.length > 0 && (
                                        <View style={styles.modalSection}>
                                            <View style={styles.modalSectionHeader}>
                                                <Text style={styles.modalSectionTitle}>Income</Text>
                                                <Text style={[styles.modalSectionAmount, { color: '#10B981' }]}>${totalIncome.toFixed(2)}</Text>
                                            </View>
                                            {income.map((t, idx) => (
                                                <TouchableOpacity
                                                    key={t.transaction_id || idx}
                                                    style={styles.modalTransactionItem}
                                                    onPress={() => {
                                                        setDailyModalVisible(false);
                                                        navigation.navigate('TransactionDetails', { transaction: t });
                                                    }}
                                                >
                                                    <View style={styles.modalTransactionIcon}>
                                                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
                                                            {t.name?.charAt(0).toUpperCase() || 'T'}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.modalTransactionInfo}>
                                                        <Text style={styles.modalTransactionName}>{getTransactionDisplayName(t)}</Text>
                                                        <Text style={styles.modalTransactionMeta}>
                                                            Today, {t.date.split('-')[2]} • {t.category || 'Uncategorized'}
                                                        </Text>
                                                        <Text style={styles.modalTransactionAccount}>🏦 {t.account_name || 'Account'}</Text>
                                                    </View>
                                                    <Text style={[styles.modalTransactionAmount, { color: '#10B981' }]}>${Math.abs(t.amount).toFixed(2)}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Balance Section */}
                                    <View style={styles.modalBalanceSection}>
                                        <Text style={styles.modalBalanceLabel}>Balance</Text>
                                        <Text style={styles.modalBalanceDate}>{dayName}, {selectedDate.day} {monthName} {selectedDate.year}</Text>
                                        <Text style={[styles.modalBalanceAmount, { color: balance >= 0 ? '#10B981' : '#F59E0B' }]}>
                                            {balance >= 0 ? '' : '- '}${Math.abs(balance).toFixed(2)}
                                        </Text>
                                    </View>

                                    {/* Summary Section */}
                                    <View style={styles.modalSummarySection}>
                                        <View style={styles.modalSummaryHeader}>
                                            <Text style={styles.modalSummaryTitle}>Summary</Text>
                                            <Text style={styles.modalSummaryRange}>{monthName} {selectedDate.day} - {monthName} {selectedDate.day}</Text>
                                        </View>
                                        <View style={styles.modalSummaryRow}>
                                            <Text style={styles.modalSummaryLabel}>Total Income</Text>
                                            <Text style={[styles.modalSummaryValue, { color: '#10B981' }]}>${totalIncome.toFixed(2)}</Text>
                                        </View>
                                        <View style={styles.modalSummaryRow}>
                                            <Text style={styles.modalSummaryLabel}>Total Expense</Text>
                                            <Text style={styles.modalSummaryValue}>- ${totalExpense.toFixed(2)}</Text>
                                        </View>
                                        <View style={styles.modalSummaryRow}>
                                            <Text style={styles.modalSummaryLabelBold}>Balance (Overall)</Text>
                                            <Text style={[styles.modalSummaryValueBold, { color: balance >= 0 ? '#10B981' : '#F59E0B' }]}>
                                                {balance >= 0 ? '' : '- '}${Math.abs(balance).toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{ height: 40 }} />
                                </ScrollView>
                            </View>
                        </View>
                    );
                })()}
            </Modal>

            {/* Monthly Detail Modal */}
            <Modal
                visible={monthDetailModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setMonthDetailModalVisible(false);
                    setDetailedMonth(null);
                    setExpandedModalSection(null);
                }}
            >
                <View style={styles.drillDownOverlay}>
                    <View style={styles.drillDownContainer}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' }}>
                            <View style={{ flex: 1 }} />
                            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>
                                {detailedMonth?.range ? detailedMonth.range.label : (detailedMonth ? months[detailedMonth.monthIndex] : '')} {detailedMonth && !detailedMonth.range ? detailedMonth.year : ''}
                            </Text>
                            <TouchableOpacity style={{ flex: 1, alignItems: 'flex-end' }} onPress={() => {
                                setMonthDetailModalVisible(false);
                                setDetailedMonth(null);
                                setExpandedModalSection(null);
                            }}>
                                <Text style={{ color: '#FFF', fontSize: 24 }}>×</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                            {(() => {
                                if (!detailedMonth) return null;

                                const { monthIndex, year, range } = detailedMonth;
                                const today = new Date();

                                // Calculate transactions
                                const monthTransactions = transactions.filter(t => {
                                    if (t.is_transfer) return false;
                                    const d = new Date(t.date);

                                    if (range) {
                                        const tDate = new Date(d); tDate.setHours(0, 0, 0, 0);
                                        const rStart = new Date(range.start); rStart.setHours(0, 0, 0, 0);
                                        const rEnd = new Date(range.end); rEnd.setHours(0, 0, 0, 0);
                                        return tDate >= rStart && tDate <= rEnd;
                                    } else {
                                        const [y, m, day] = t.date.split('-').map(Number);
                                        return (m - 1) === monthIndex && y === year;
                                    }
                                });

                                const isCurrentPeriod = range
                                    ? (range.start <= today && range.end >= today)
                                    : (monthIndex === today.getMonth() && year === today.getFullYear());

                                const isPastPeriod = range
                                    ? (range.end < today)
                                    : (year < today.getFullYear() || (year === today.getFullYear() && monthIndex < today.getMonth()));

                                let totalIncome = 0;
                                let incomeUntilToday = 0;
                                let incomeUpcoming = 0;

                                let totalExpense = 0;
                                let expenseUntilToday = 0;
                                let expenseUpcoming = 0;

                                monthTransactions.forEach(t => {
                                    const amt = parseFloat(t.amount);
                                    const [y, m, d] = t.date.split('-').map(Number);

                                    if (!isNaN(amt)) {
                                        const tDate = new Date(y, m - 1, d); tDate.setHours(0, 0, 0, 0);
                                        const now = new Date(); now.setHours(0, 0, 0, 0);
                                        const isUntilToday = isPastPeriod || (isCurrentPeriod && tDate <= now);

                                        if (amt < 0) { // Income
                                            const absAmt = Math.abs(amt);
                                            totalIncome += absAmt;
                                            if (isUntilToday) incomeUntilToday += absAmt;
                                            else incomeUpcoming += absAmt;
                                        } else { // Expense
                                            totalExpense += amt;
                                            if (isUntilToday) expenseUntilToday += amt;
                                            else expenseUpcoming += amt;
                                        }
                                    }
                                });

                                const balanceOverall = totalIncome - totalExpense;
                                const balanceUntilToday = incomeUntilToday - expenseUntilToday;

                                return (
                                    <>
                                        {/* Total Income Section */}
                                        <View style={{ marginBottom: 24 }}>
                                            <TouchableOpacity onPress={() => setExpandedModalSection('income-all')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Briefcase size={20} color="#3B82F6" />
                                                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Total Income</Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Text style={{ color: '#10B981', fontSize: 16, fontWeight: '700' }}>+ ${totalIncome.toFixed(2)}</Text>
                                                    <ChevronRight size={20} color="#64748B" />
                                                </View>
                                            </TouchableOpacity>

                                            {!isPastPeriod && (
                                                <>
                                                    <TouchableOpacity onPress={() => setExpandedModalSection('income-past')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingLeft: 28 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                                                            <Text style={{ color: '#94A3B8', fontSize: 14 }}>Until today</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <Text style={{ color: '#FFF', fontSize: 14 }}>+ ${incomeUntilToday.toFixed(2)}</Text>
                                                            <ChevronRight size={16} color="#64748B" />
                                                        </View>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity onPress={() => setExpandedModalSection('income-future')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 28 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBFC7E' }} />
                                                            <Text style={{ color: '#94A3B8', fontSize: 14 }}>Upcoming</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <Text style={{ color: '#FFF', fontSize: 14 }}>+ ${incomeUpcoming.toFixed(2)}</Text>
                                                            <ChevronRight size={16} color="#64748B" />
                                                        </View>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>

                                        {/* Total Expense Section */}
                                        <View style={{ marginBottom: 24 }}>
                                            <TouchableOpacity onPress={() => setExpandedModalSection('expense-all')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Wallet size={20} color="#FFF" />
                                                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Total Expense</Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>- ${totalExpense.toFixed(2)}</Text>
                                                    <ChevronRight size={20} color="#64748B" />
                                                </View>
                                            </TouchableOpacity>

                                            {!isPastPeriod && (
                                                <>
                                                    <TouchableOpacity onPress={() => setExpandedModalSection('expense-past')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingLeft: 28 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
                                                            <Text style={{ color: '#94A3B8', fontSize: 14 }}>Until today</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <Text style={{ color: '#FFF', fontSize: 14 }}>${expenseUntilToday.toFixed(0)}</Text>
                                                            <ChevronRight size={16} color="#64748B" />
                                                        </View>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity onPress={() => setExpandedModalSection('expense-future')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 28 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FCD34D' }} />
                                                            <Text style={{ color: '#94A3B8', fontSize: 14 }}>Upcoming Expenses/Bills</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <Text style={{ color: '#FFF', fontSize: 14 }}>${expenseUpcoming.toFixed(0)}</Text>
                                                            <ChevronRight size={16} color="#64748B" />
                                                        </View>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>

                                        <View style={{ height: 1, backgroundColor: '#334155', marginBottom: 24 }} />

                                        {/* Balance Section */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                            <Text style={{ color: '#FFF', fontSize: 16 }}>Balance (Overall)</Text>
                                            <Text style={{ color: balanceOverall >= 0 ? '#10B981' : '#F59E0B', fontSize: 16, fontWeight: 'bold' }}>
                                                {balanceOverall >= 0 ? '+' : ''} ${balanceOverall.toFixed(2)}
                                            </Text>
                                        </View>

                                        {!isPastPeriod && (
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ color: '#FFF', fontSize: 16 }}>Balance (Until Today)</Text>
                                                <Text style={{ color: balanceUntilToday >= 0 ? '#10B981' : '#F59E0B', fontSize: 16, fontWeight: 'bold' }}>
                                                    {balanceUntilToday >= 0 ? '+' : ''} ${balanceUntilToday.toFixed(2)}
                                                </Text>
                                            </View>
                                        )}
                                    </>
                                );
                            })()}
                        </ScrollView >
                    </View >
                </View >
            </Modal >

            {/* Transaction List Modal */}
            < Modal
                visible={!!expandedModalSection}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setExpandedModalSection(null)}
            >
                <View style={styles.drillDownOverlay}>
                    <View style={styles.drillDownContainer}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' }}>
                            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>
                                {expandedModalSection === 'income-past' ? 'Income Until Today' :
                                    expandedModalSection === 'income-future' ? 'Upcoming Income' :
                                        expandedModalSection === 'income-all' ? 'Total Income' :
                                            expandedModalSection === 'expense-past' ? 'Expenses Until Today' :
                                                expandedModalSection === 'expense-future' ? 'Upcoming Expenses' :
                                                    'Total Expenses'}
                            </Text>
                            <TouchableOpacity onPress={() => setExpandedModalSection(null)}>
                                <Text style={{ color: '#FFF', fontSize: 24 }}>×</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                            {(() => {
                                if (!detailedMonth || !expandedModalSection) return null;
                                const { monthIndex, year, range } = detailedMonth;
                                const today = new Date();
                                const currentDay = today.getDate();
                                const type = expandedModalSection.startsWith('income') ? 'income' : 'expense';
                                const period = expandedModalSection.split('-')[1]; // past, future, all

                                const list = transactions.filter(t => {
                                    if (t.is_transfer) return false;
                                    if (selectedAccountIds.length > 0 && !selectedAccountIds.includes(t.account_id)) return false;

                                    const amt = parseFloat(t.amount);
                                    if (isNaN(amt)) return false;
                                    const [y, m, d] = t.date.split('-').map(Number);
                                    const tDate = new Date(y, m - 1, d); tDate.setHours(0, 0, 0, 0);

                                    // Filter by Range or Month/Year
                                    if (range) {
                                        if (tDate < range.start || tDate > range.end) return false;
                                    } else {
                                        if ((m - 1) !== monthIndex || y !== year) return false;
                                    }

                                    // Filter by Period (Until Today / Upcoming / All)
                                    // Calculate isUntilToday based on range or month logic
                                    // For range: isUntilToday if tDate <= today
                                    // For month: isUntilToday if past month OR (current month && d <= currentDay)
                                    // Simplified: tDate <= today covers both essentially?
                                    // But strictly "Until Today" means up to NOW.
                                    const tDateOnly = new Date(y, m - 1, d);
                                    const todayOnly = new Date(); todayOnly.setHours(0, 0, 0, 0);
                                    const isUntilToday = tDateOnly <= todayOnly;

                                    const isTargetPeriod = period === 'all' ? true : (period === 'past' ? isUntilToday : !isUntilToday);
                                    const isTargetType = type === 'income' ? amt < 0 : amt > 0;
                                    return isTargetPeriod && isTargetType;
                                }).sort((a, b) => new Date(b.date) - new Date(a.date));

                                return (
                                    <>
                                        {list.map((t, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => navigation.navigate('TransactionDetails', { transaction: t })}
                                                style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155' }}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '500' }}>{getTransactionDisplayName(t)}</Text>
                                                    <Text style={{ color: '#94A3B8', fontSize: 12 }}>{t.date.split('-')[2]} {months[parseInt(t.date.split('-')[1]) - 1].substring(0, 3)}</Text>
                                                </View>
                                                <Text style={{ color: type === 'income' ? '#10B981' : '#FFF', fontSize: 15, fontWeight: '600' }}>
                                                    ${Math.abs(t.amount).toFixed(2)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                        {list.length === 0 && <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 20 }}>No transactions found</Text>}
                                    </>
                                );
                            })()}
                        </ScrollView>
                    </View>
                </View>
            </Modal >

            {/* Filter Modal */}
            < Modal
                visible={filterModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <View style={[styles.drillDownOverlay, { justifyContent: 'flex-end', paddingBottom: 0 }]}>
                    <View style={[styles.drillDownContainer, { height: '60%', borderTopLeftRadius: 24, borderTopRightRadius: 24, display: 'flex', flexDirection: 'column' }]}>
                        {/* Header Tabs */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', gap: 24 }}>
                                <TouchableOpacity
                                    style={{ borderBottomWidth: 2, borderBottomColor: activeFilterTab === 'group' ? '#3B82F6' : 'transparent', paddingBottom: 8 }}
                                    onPress={() => setActiveFilterTab('group')}
                                >
                                    <Text style={{ color: activeFilterTab === 'group' ? '#3B82F6' : '#94A3B8', fontWeight: '700', fontSize: 14 }}>GROUP BY</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ borderBottomWidth: 2, borderBottomColor: activeFilterTab === 'filter' ? '#3B82F6' : 'transparent', paddingBottom: 8 }}
                                    onPress={() => setActiveFilterTab('filter')}
                                >
                                    <Text style={{ color: activeFilterTab === 'filter' ? '#3B82F6' : '#94A3B8', fontWeight: '700', fontSize: 14 }}>FILTER</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                                <X size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Content Area */}
                        <View style={{ flex: 1 }}>
                            {activeFilterTab === 'group' ? (
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                    {/* Group By Options */}
                                    <View style={{ marginBottom: 24 }}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
                                            {['Monthly', 'Weekly', 'Bi-Weekly', 'Yearly', 'Custom'].map(opt => (
                                                <TouchableOpacity
                                                    key={opt}
                                                    onPress={() => setGroupBy(opt)}
                                                    style={{
                                                        paddingHorizontal: 16,
                                                        paddingVertical: 8,
                                                        borderRadius: 20,
                                                        backgroundColor: opt === groupBy ? '#3B82F6' : '#334155',
                                                        borderWidth: 1,
                                                        borderColor: opt === groupBy ? '#3B82F6' : '#475569'
                                                    }}
                                                >
                                                    <Text style={{ color: '#FFF', fontSize: 14 }}>{opt}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>

                                    {/* Start Date Input - Hide for Custom */}
                                    {groupBy !== 'Custom' && (
                                        <View style={{ marginBottom: 24 }}>
                                            <Text style={{ color: '#FFF', fontSize: 16, marginBottom: 12 }}>
                                                {groupBy === 'Yearly' ? 'Start day of year' :
                                                    (groupBy === 'Weekly' || groupBy === 'Bi-Weekly') ? 'Start day of week' :
                                                        'Start day of month'}
                                            </Text>
                                            {['Monthly', 'Bi-Weekly', 'Yearly'].includes(groupBy) ? (
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#0F172A', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#334155' }}
                                                    onPress={() => {
                                                        setDatePickerTarget('single');
                                                        setShowDatePicker(true);
                                                    }}
                                                >
                                                    <Text style={{ color: '#E2E8F0', fontSize: 15 }}>
                                                        {startDate.getDate()} {monthAbbr[startDate.getMonth()]} {startDate.getFullYear()}
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : groupBy === 'Weekly' ? (
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#0F172A', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#334155' }}
                                                    onPress={() => setShowDayOfWeekPicker(true)}
                                                >
                                                    <Text style={{ color: '#E2E8F0', fontSize: 15 }}>
                                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][parseInt(startDay || 7) - 1] || 'Sunday'}
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={{ backgroundColor: '#0F172A', borderRadius: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}>
                                                    <TextInput
                                                        style={{ flex: 1, color: '#E2E8F0', fontSize: 15, padding: 12 }}
                                                        value={startDay}
                                                        onChangeText={setStartDay}
                                                        keyboardType="numeric"
                                                        placeholder="e.g. 28"
                                                        placeholderTextColor="#64748B"
                                                        maxLength={2}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Custom Date Range */}
                                    {(groupBy === 'Custom') && (
                                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: '#FFF', fontSize: 16, marginBottom: 12 }}>Start Date</Text>
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#0F172A', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#334155' }}
                                                    onPress={() => {
                                                        setDatePickerTarget('customStart');
                                                        setShowDatePicker(true);
                                                    }}
                                                >
                                                    <Text style={{ color: '#E2E8F0', fontSize: 14 }}>
                                                        {customStartDate.getDate()} {monthAbbr[customStartDate.getMonth()]} {customStartDate.getFullYear()}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: '#FFF', fontSize: 16, marginBottom: 12 }}>End Date</Text>
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#0F172A', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#334155' }}
                                                    onPress={() => {
                                                        setDatePickerTarget('customEnd');
                                                        setShowDatePicker(true);
                                                    }}
                                                >
                                                    <Text style={{ color: '#E2E8F0', fontSize: 14 }}>
                                                        {customEndDate.getDate()} {monthAbbr[customEndDate.getMonth()]} {customEndDate.getFullYear()}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    {/* Info Note */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 }}>
                                        <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>i</Text>
                                        </View>
                                        <Text style={{ color: '#94A3B8', fontSize: 14 }}>
                                            {groupBy === 'Yearly' ? `Year will start from Month ${startDay}` :
                                                (groupBy === 'Weekly' || groupBy === 'Bi-Weekly') ? `Week will start from Day ${startDay}` :
                                                    groupBy === 'Custom' ? `Range of ${Math.round((customEndDate - customStartDate) / (1000 * 60 * 60 * 24))} days, Starting from ${customStartDate.getDate()} ${monthAbbr[customStartDate.getMonth()]} ${customStartDate.getFullYear()}` :
                                                        `Month will start from Day ${startDay}`}
                                        </Text>
                                    </View>
                                </ScrollView>
                            ) : (
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                    {/* Accounts Filter */}
                                    <View style={{ marginBottom: 24 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Accounts</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowAccountList(!showAccountList)}
                                            >
                                                <Plus size={20} color="#3B82F6" />
                                            </TouchableOpacity>
                                        </View>
                                        {(showAccountList || selectedAccountIds.length > 0) && (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                {accounts.map(acc => {
                                                    const isSelected = selectedAccountIds.includes(acc.account_id);
                                                    return (
                                                        <TouchableOpacity
                                                            key={acc.account_id}
                                                            onPress={() => {
                                                                setSelectedAccountIds(prev =>
                                                                    isSelected
                                                                        ? prev.filter(id => id !== acc.account_id)
                                                                        : [...prev, acc.account_id]
                                                                );
                                                            }}
                                                            style={{
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 6,
                                                                borderRadius: 16,
                                                                backgroundColor: isSelected ? '#3B82F6' : '#1E293B',
                                                                borderWidth: 1,
                                                                borderColor: isSelected ? '#3B82F6' : '#334155'
                                                            }}
                                                        >
                                                            <Text style={{ color: isSelected ? '#FFF' : '#94A3B8', fontSize: 12 }}>
                                                                {acc.custom_name || acc.name}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>
                            )}
                        </View>


                        {/* Date Picker Modal */}
                        <Modal
                            visible={showDatePicker}
                            transparent={true}
                            animationType="fade"
                            onRequestClose={() => setShowDatePicker(false)}
                        >
                            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
                                <CustomDatePicker
                                    selectedDate={
                                        datePickerTarget === 'customStart' ? customStartDate.toISOString().split('T')[0] :
                                            datePickerTarget === 'customEnd' ? customEndDate.toISOString().split('T')[0] :
                                                startDate.toISOString().split('T')[0]
                                    }
                                    onDateSelect={(dateStr) => {
                                        const [y, m, d] = dateStr.split('-');
                                        const newDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

                                        if (datePickerTarget === 'customStart') {
                                            setCustomStartDate(newDate);
                                        } else if (datePickerTarget === 'customEnd') {
                                            setCustomEndDate(newDate);
                                        } else {
                                            setStartDate(newDate);
                                            setStartDay(parseInt(d).toString());
                                            setCurrentDate(newDate);
                                        }
                                        setShowDatePicker(false);
                                    }}
                                    onClose={() => setShowDatePicker(false)}
                                />
                            </View>
                        </Modal>

                        {/* Day of Week Picker Modal */}
                        <Modal
                            visible={showDayOfWeekPicker}
                            transparent={true}
                            animationType="fade"
                            onRequestClose={() => setShowDayOfWeekPicker(false)}
                        >
                            <TouchableOpacity
                                activeOpacity={1}
                                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}
                                onPress={() => setShowDayOfWeekPicker(false)}
                            >
                                <View style={{ backgroundColor: '#1E293B', borderRadius: 16, overflow: 'hidden' }}>
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => (
                                        <TouchableOpacity
                                            key={day}
                                            style={{
                                                padding: 16,
                                                borderBottomWidth: index < 6 ? 1 : 0,
                                                borderBottomColor: '#334155',
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                            onPress={() => {
                                                setStartDay((index + 1).toString());
                                                setShowDayOfWeekPicker(false);
                                            }}
                                        >
                                            <Text style={{ color: '#E2E8F0', fontSize: 16 }}>{day}</Text>
                                            {parseInt(startDay) === index + 1 && <Check size={20} color="#3B82F6" />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </TouchableOpacity>
                        </Modal>

                        {/* Month Picker Modal */}
                        <Modal
                            visible={showMonthPicker}
                            transparent={true}
                            animationType="fade"
                            onRequestClose={() => setShowMonthPicker(false)}
                        >
                            <TouchableOpacity
                                activeOpacity={1}
                                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}
                                onPress={() => setShowMonthPicker(false)}
                            >
                                <View style={{ backgroundColor: '#1E293B', borderRadius: 16, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
                                    {months.map((month, index) => (
                                        <TouchableOpacity
                                            key={month}
                                            style={{
                                                width: '33.33%',
                                                padding: 16,
                                                borderRightWidth: (index + 1) % 3 === 0 ? 0 : 1,
                                                borderBottomWidth: index < 9 ? 1 : 0,
                                                borderColor: '#334155',
                                                alignItems: 'center'
                                            }}
                                            onPress={() => {
                                                setStartDay((index + 1).toString());
                                                setShowMonthPicker(false);
                                            }}
                                        >
                                            <Text style={{ color: parseInt(startDay) === index + 1 ? '#3B82F6' : '#E2E8F0', fontWeight: parseInt(startDay) === index + 1 ? '700' : '400' }}>
                                                {monthAbbr[index]}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </TouchableOpacity>
                        </Modal>



                        {/* Apply Button */}
                        <TouchableOpacity
                            style={{ backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 30, alignItems: 'center' }}
                            onPress={() => setFilterModalVisible(false)}
                        >
                            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>APPLY</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal >


            {/* Transaction Filter Modal */}
            <TransactionFilterModal
                visible={transactionFilterModalVisible}
                onClose={() => setTransactionFilterModalVisible(false)}
                onApply={(filters) => {
                    setTransactionFilters(filters);
                    // Sync main type filter if changed in modal
                    if (filters.type) setTransactionsFilter(filters.type);
                }}
                initialFilters={{
                    type: transactionsFilter,
                    ...transactionFilters
                }}
                availableCategories={Object.keys(mergedTaxonomy || {})}
                availableAccounts={accounts}
            />

        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050B14', // Very dark background
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '600',
    },
    headerRight: {
        flexDirection: 'row',
        gap: 16
    },
    headerIcon: {
        // padding: 4
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
        marginBottom: 10,
    },
    tabItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {
        borderBottomColor: '#3B82F6',
    },
    tabText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#FFF',
    },
    scrollContent: {
        paddingBottom: 20,
    },
    monthSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    monthTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
    },
    monthSubtitle: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 2
    },
    mainCard: {
        backgroundColor: '#0F172A',
        marginHorizontal: 16,
        borderRadius: 20,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#1E293B'
    },
    chartToggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 4,
        alignSelf: 'center',
        marginBottom: 20,
        width: '100%',
    },
    chartToggleBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 16,
    },
    chartToggleBtnActive: {
        backgroundColor: '#334155', // Or a slightly lighter gray
    },
    chartToggleText: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '500',
    },
    chartToggleTextActive: {
        color: '#FFF',
    },
    chartArea: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
    },
    floatingMoreBtn: {
        position: 'absolute',
        right: 0,
        bottom: 50,
        backgroundColor: '#10B981',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    projectedSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
    moreLink: {
        color: '#3B82F6',
        fontSize: 14,
    },
    projectedCard: {
        backgroundColor: '#0F172A',
        marginHorizontal: 8,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1E293B'
    },
    projectedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    projectedMonth: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        flex: 1, // Allow text to take space but shrink if needed
        marginRight: 8, // Add gap between date and badges
    },
    projectedBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0, // Prevent badges/amount from shrinking
    },
    badgeUp: {
        backgroundColor: '#064E3B',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 8,
    },
    badgeTextUp: {
        color: '#10B981',
        fontSize: 10,
        fontWeight: '700',
    },
    incomeText: {
        color: '#10B981',
        fontSize: 16,
        fontWeight: '700',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#334155',
        borderRadius: 3,
        marginBottom: 12,
        position: 'relative',
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    projectedFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    balanceText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    badgeDown: {
        backgroundColor: '#451A03',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 8,
    },
    badgeTextDown: {
        color: '#EF4444',
        fontSize: 10,
        fontWeight: '700'
    },
    expenseText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700'
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#2DD4BF', // Teal-ish color from screenshot
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        borderWidth: 2,
        borderColor: '#0F172A'
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: '#64748B',
        fontSize: 16,
    },
    customChartContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 10,
        paddingVertical: 20,
        height: 200,
    },
    customBarWrapper: {
        alignItems: 'center',
        marginHorizontal: 8,
        justifyContent: 'flex-end',
    },
    customBar: {
        width: 24,
        borderRadius: 4,
        marginVertical: 4,
    },
    customBarValue: {
        color: '#FFF',
        fontSize: 10,
        marginBottom: 4,
        textAlign: 'center',
    },
    customBarLabel: {
        color: '#64748B',
        fontSize: 10,
        marginTop: 4,
        textAlign: 'center',
    },
    calendarContainer: {
        width: '100%',
        paddingVertical: 10,
    },
    calendar: {
        paddingHorizontal: 8,
    },
    calendarHeader: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    calendarDayName: {
        flex: 1,
        color: '#64748B',
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '600',
    },
    calendarWeek: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    calendarDay: {
        flex: 1,
        aspectRatio: 1,
        padding: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F172A',
        marginHorizontal: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    calendarDayNumber: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    calendarDayBalance: {
        fontSize: 9,
        fontWeight: '700',
    },
    monthlyContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    monthlyListContainer: {
        width: '100%',
        paddingHorizontal: 16,
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#1E293B',
    },
    modalDate: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalCloseBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#334155',
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 16,
    },
    modalSection: {
        marginTop: 24,
    },
    modalSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalSectionTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    modalSectionAmount: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    modalTransactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: '#1E293B',
        borderRadius: 12,
        marginBottom: 8,
    },
    modalTransactionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    modalTransactionInfo: {
        flex: 1,
    },
    modalTransactionName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    modalTransactionMeta: {
        color: '#94A3B8',
        fontSize: 12,
        marginBottom: 2,
    },
    modalTransactionAccount: {
        color: '#94A3B8',
        fontSize: 12,
    },
    modalTransactionAmount: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalBalanceSection: {
        marginTop: 32,
        padding: 20,
        backgroundColor: '#1E293B',
        borderRadius: 16,
        alignItems: 'flex-start',
    },
    modalBalanceLabel: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    modalBalanceDate: {
        color: '#64748B',
        fontSize: 14,
        marginBottom: 12,
    },
    modalBalanceAmount: {
        fontSize: 32,
        fontWeight: '700',
    },
    modalSummarySection: {
        marginTop: 24,
        padding: 20,
        backgroundColor: '#1E293B',
        borderRadius: 16,
    },
    modalSummaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    modalSummaryTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    modalSummaryRange: {
        color: '#64748B',
        fontSize: 13,
    },
    modalSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    modalSummaryLabel: {
        color: '#94A3B8',
        fontSize: 15,
    },
    modalSummaryValue: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '500',
    },
    modalSummaryLabelBold: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    modalSummaryValueBold: {
        fontSize: 18,
        fontWeight: '700',
    },
    // Transactions Tab Styles
    filterRow: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    filterPill: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1E293B',
        marginRight: 10,
    },
    activePill: {
        backgroundColor: '#075985',
    },
    filterText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    activeFilterText: {
        color: '#38BDF8',
    },
    recurringLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1E293B',
        padding: 16,
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 20,
    },
    listContent: {
        paddingBottom: 40,
    },
    dateGroup: {
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    dateTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    dateTotal: {
        fontSize: 16,
        fontWeight: '700',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1E293B',
        borderRadius: 16,
        marginBottom: 10,
        padding: 16,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardSubtitle: {
        color: '#94A3B8',
        fontSize: 13,
    },
    cardAmount: {
        fontSize: 15,
        fontWeight: '700',
    },
    spendingCard: {
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    spendingFilterContainer: {
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        borderRadius: 12,
        padding: 4,
        justifyContent: 'space-between',
    },
    spendingPill: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    spendingPillActive: {
        backgroundColor: '#334155',
    },
    spendingPillText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    spendingPillTextActive: {
        color: '#FFF',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
        padding: 12,
        borderRadius: 16,
    },
    spendingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 8,
    },
    spendingIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spendingName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    spendingAmount: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
    spendingPct: {
        color: '#94A3B8',
        fontSize: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    drillDownOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    drillDownContainer: {
        backgroundColor: '#1E293B',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '92%',
        padding: 20,
    },
    drillDownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    drillDownTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
        marginLeft: 30,
    },
    drillDownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    drillDownIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    drillDownName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    drillDownDate: {
        color: '#94A3B8',
        fontSize: 13,
    },
    drillDownAmount: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default Insights;
// Force Rebuild
