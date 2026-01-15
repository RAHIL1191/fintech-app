import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react-native';
import DonutChart from './DonutChart';
import { formatCurrency } from '../utils/dateUtils';
import { getCategoryColor } from '../constants/CategoryTaxonomy';

const CategoryDrillDownModal = ({ visible, onClose, parentCategory, transactions = [], navigation }) => {
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);

    // Group transactions by Subcategory
    const subcategoryData = useMemo(() => {
        if (!transactions.length) return { data: [], total: 0 };

        const grouped = transactions.reduce((acc, t) => {
            // Identify subcategory (t.category is usually the subcategory name now, or we can use taxonomy logic if needed)
            // Ideally t.category is the specific name like "Restaurants".
            // Since we filtered by Parent, grouping by the raw category name gives us the subcategories.
            const subName = (typeof t.category === 'string' ? t.category : t.category?.[0]) || 'Uncategorized';

            if (!acc[subName]) {
                acc[subName] = { name: subName, amount: 0, count: 0, transactions: [] };
            }
            acc[subName].amount += Math.abs(t.amount);
            acc[subName].count += 1;
            acc[subName].transactions.push(t);
            return acc;
        }, {});

        const dataArray = Object.values(grouped).sort((a, b) => b.amount - a.amount);
        const total = dataArray.reduce((sum, item) => sum + item.amount, 0);

        // Assign colors based on taxonomy or generate palette
        // We can reuse the parent's color but with varying opacity or shift, or just standard palette
        // For subcategories, standard palette is fine or consistent colors if defined
        const palette = ['#F59E0B', '#84CC16', '#F43F5E', '#3B82F6', '#8B5CF6'];
        const dataWithColors = dataArray.map((item, idx) => ({
            ...item,
            value: item.amount,
            color: getCategoryColor(item.name) // Try to get specific subcategory color if defined (it defaults to parent color usually)
            // If getCategoryColor returns parent color (which is same for all), we might want visual distinction.
            // Let's use the palette if all subcategories get the same color.
        }));

        // Check if colors are identical (naive check), if so, distribute palette
        if (dataWithColors.length > 1 && dataWithColors[0].color === dataWithColors[1].color) {
            dataWithColors.forEach((item, idx) => {
                item.color = palette[idx % palette.length];
            });
        }

        return { data: dataWithColors, total };
    }, [transactions]);

    const handleClose = () => {
        setSelectedSubcategory(null);
        onClose();
    };

    const renderSubcategoryList = () => (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.chartContainer}>
                <DonutChart
                    data={subcategoryData.data}
                    size={180}
                    strokeWidth={20}
                    centerLabel="Total"
                    centerValue={`$${Math.round(subcategoryData.total)}`}
                />
            </View>

            <View style={styles.listContainer}>
                {subcategoryData.data.map((item) => (
                    <TouchableOpacity
                        key={item.name}
                        style={styles.listItem}
                        onPress={() => setSelectedSubcategory(item)}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                            <View style={[styles.dot, { backgroundColor: item.color }]} />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemSub}>{((item.amount / subcategoryData.total) * 100).toFixed(1)}%</Text>
                        </View>
                        <Text style={styles.itemAmount}>${item.amount.toFixed(2)}</Text>
                        <View style={[styles.bar, { backgroundColor: item.color }]} />
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );

    const renderTransactionList = () => (
        <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.backRow} onPress={() => setSelectedSubcategory(null)}>
                <ArrowLeft size={20} color="#1E293B" />
                <Text style={styles.backText}>Back to {parentCategory}</Text>
            </TouchableOpacity>

            <View style={styles.subHeader}>
                <View style={[styles.iconCircleLarge, { backgroundColor: selectedSubcategory.color + '20' }]}>
                    {/* Could implement dynamic icon here if passed */}
                    <Text style={{ fontSize: 24 }}>🏷️</Text>
                </View>
                <Text style={styles.subTitle}>{selectedSubcategory.name}</Text>
                <Text style={styles.subTotal}>
                    {selectedSubcategory.count} transactions • ${selectedSubcategory.amount.toFixed(2)}
                </Text>
            </View>

            <FlatList
                data={selectedSubcategory.transactions}
                keyExtractor={(t) => t.id?.toString() || Math.random().toString()}
                contentContainerStyle={{ paddingBottom: 24 }}
                renderItem={({ item: t }) => (
                    <TouchableOpacity
                        style={styles.txnItem}
                        onPress={() => {
                            // Navigate to details and close modal? Or just navigate pushed
                            onClose();
                            navigation.navigate('TransactionDetails', { transaction: t });
                        }}
                    >
                        <View style={[styles.txnIconCircle, { backgroundColor: '#1E293B' }]}>
                            {/* Simple generic icon or brand logo */}
                            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                                {(t.merchant_name || t.name || '?').charAt(0)}
                            </Text>
                        </View>
                        <View style={styles.txnContent}>
                            <Text style={styles.txnName}>{t.merchant_name || t.name}</Text>
                            <Text style={styles.txnDate}>{t.date} • {t.account_name || 'Cash'}</Text>
                        </View>
                        <Text style={styles.txnAmount}>-${Math.abs(t.amount).toFixed(2)}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true} // Generally false for full screen/pageSheet on iOS, but can be true for custom overlay
            // Updating to use SafeAreaView inside a full-screen view
            onRequestClose={handleClose}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{parentCategory}</Text>
                    {!selectedSubcategory && (
                        <TouchableOpacity
                            onPress={handleClose}
                            style={styles.closeBtn}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            <X size={24} color="#64748B" />
                        </TouchableOpacity>
                    )}
                </View>

                {selectedSubcategory ? renderTransactionList() : renderSubcategoryList()}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center', // Center title
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginHorizontal: 16,
        position: 'relative', // Context for absolute close button
        zIndex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    closeBtn: {
        position: 'absolute', // Absolute to header
        right: 0,
        zIndex: 10,
        padding: 4,
    },
    chartContainer: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    listContainer: {
        paddingHorizontal: 24,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    itemContent: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1E293B',
    },
    itemSub: {
        fontSize: 13,
        color: '#64748B',
    },
    itemAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        marginRight: 12,
    },
    bar: {
        width: 4,
        height: 24,
        borderRadius: 2,
    },
    // Sub-view styles
    backRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        marginLeft: 8,
    },
    subHeader: {
        alignItems: 'center',
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    iconCircleLarge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    subTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    subTotal: {
        fontSize: 14,
        color: '#64748B',
    },
    txnItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    txnIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    txnContent: {
        flex: 1,
    },
    txnName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
    },
    txnDate: {
        fontSize: 13,
        color: '#64748B',
    },
    txnAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
    }
});

export default CategoryDrillDownModal;
