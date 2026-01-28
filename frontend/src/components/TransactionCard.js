import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Wallet, CreditCard, Landmark } from 'lucide-react-native';

const getAccountIcon = (type) => {
    switch (type?.toLowerCase()) {
        case 'depository': return <Wallet size={12} color="#64748B" />;
        case 'credit': return <CreditCard size={12} color="#64748B" />;
        default: return <Landmark size={12} color="#64748B" />;
    }
};

const formatCategory = (category) => {
    if (!category) return 'Uncategorized';
    // Clean string if needed
    const catStr = Array.isArray(category) ? category[0] : category;
    if (typeof catStr !== 'string') return 'Uncategorized';

    const words = catStr.split(' ');
    if (words.length > 3) {
        return words.slice(0, 2).join(' ') + '...';
    }
    return catStr;
};

const getTransactionDisplayName = (t) => {
    if (t.merchant_name) return t.merchant_name;
    const cat = t.personal_finance_category?.primary || (Array.isArray(t.category) ? t.category[0] : t.category);
    if (cat) return formatCategory(cat);
    return t.name || 'Unknown Transaction';
};

const TransactionCard = React.memo(({
    t,
    navigation,
    getIconColor, // Pass from parent or use default if needed (but simpler to pass for taxonomy consistency)
    getIconForCategory, // Pass from parent
    theme = 'dark' // 'dark' | 'light'
}) => {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#FFF' : '#0F172A';
    const subTextColor = isDark ? '#94A3B8' : '#64748B';
    const amountPositiveColor = '#10B981'; // Green
    const amountNegativeColor = '#EF4444'; // Red

    // Helper to parse date string as local date (avoid UTC timezone shift)
    const parseLocalDate = (dateStr) => {
        if (!dateStr) return new Date();
        // If it's just a date string (YYYY-MM-DD), parse as local date
        if (dateStr.length === 10 && dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day, 12, 0, 0);
        }
        // If it's a timestamp, parse it
        return new Date(dateStr);
    };

    // Check if we have actual time info (not just a date)
    const hasTimeInfo = t.authorized_date && (t.authorized_date.includes('T') || t.authorized_date.includes(' '));

    // Use authorized_date if available, otherwise use posted date
    const displayDate = parseLocalDate(t.authorized_date || t.date);
    const dateStr = displayDate.toLocaleString('en-US', { month: 'short', day: 'numeric' });

    // Only show time if authorized_date contains actual time info
    const timeStr = hasTimeInfo ? `, ${displayDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : '';

    const categoryName = formatCategory(t.personal_finance_category?.primary || t.category);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('TransactionDetails', { transaction: t })}
        >
            <View style={styles.cardLeft}>
                <View style={[styles.cardIcon, { backgroundColor: getIconColor ? getIconColor(t.personal_finance_category?.primary) : '#64748B' }]}>
                    {getIconForCategory ? getIconForCategory(t.personal_finance_category?.primary) : <CreditCard size={20} color="#FFF" />}
                </View>
                <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>
                        {getTransactionDisplayName(t)}
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: subTextColor }]} numberOfLines={1}>
                        {dateStr}{timeStr} • {categoryName}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                        {getAccountIcon(t.account_type)}
                        <Text style={{ color: subTextColor, fontSize: 12 }}>
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
                <Text style={[styles.cardAmount, { color: t.amount < 0 ? amountPositiveColor : amountNegativeColor }]}>
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
});

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12, // Ensure text doesn't overlap amount
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
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 13,
    },
    cardAmount: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default TransactionCard;
