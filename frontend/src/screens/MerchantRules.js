import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, Switch, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Save, CheckCircle, ChevronRight, User, Tag, ArrowLeft, Check, Plus, Repeat } from 'lucide-react-native';
import api from '../config/api';

const MerchantRules = ({ navigation }) => {
    const insets = useSafeAreaInsets();

    // Data State
    const [merchants, setMerchants] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [selectedMerchant, setSelectedMerchant] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isTransfer, setIsTransfer] = useState(false);

    // UI State
    const [showMerchantModal, setShowMerchantModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [merchantSearchQuery, setMerchantSearchQuery] = useState('');
    const [categorySearchQuery, setCategorySearchQuery] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [merchRes, catRes] = await Promise.all([
                api.get('/merchants'),
                api.get('/categories')
            ]);
            setMerchants(merchRes.data.merchants || []);
            setCategories(catRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRule = async (applyToPast) => {
        if (!selectedMerchant) {
            Alert.alert('Validation', 'Please select a merchant.');
            return;
        }
        if (!selectedCategory && !isTransfer) {
            Alert.alert('Validation', 'Please select a category or mark as transfer.');
            return;
        }

        setProcessing(true);
        try {
            if (applyToPast) {
                const response = await api.post('/merchants/apply-rule', {
                    merchant_name: selectedMerchant,
                    category: selectedCategory,
                    is_transfer: isTransfer
                });
                Alert.alert('Success', response.data.message);
            } else {
                // Future transactions only
                await api.post(`/metadata/merchant/${selectedMerchant}`, {
                    category: selectedCategory,
                    is_transfer: isTransfer ? 1 : 0
                });
                Alert.alert('Saved', 'Rule saved for future transactions.');
            }
            // Optional: clear form or navigate back? User likely wants to add another rule.
            // Reset logic if needed, currently keeping form active
        } catch (error) {
            console.error('Error saving rule:', error);
            const detail = error.response?.data?.details || error.message;
            Alert.alert('Error', `Failed to save rule.\n\n${detail}`);
        } finally {
            setProcessing(false);
        }
    };

    const filteredMerchants = useMemo(() => {
        if (!merchantSearchQuery) return merchants;
        return merchants.filter(m => m.toLowerCase().includes(merchantSearchQuery.toLowerCase()));
    }, [merchants, merchantSearchQuery]);

    const filteredCategories = useMemo(() => {
        if (!categorySearchQuery) return categories;
        return categories.filter(c => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()));
    }, [categories, categorySearchQuery]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                    <ChevronLeft size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Merchant Rules</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#0EA5E9" />
                </View>
            ) : (
                <ScrollView style={styles.content}>
                    <Text style={styles.helperText}>
                        Create rules to automatically categorize transactions or mark them as transfers based on the merchant name.
                    </Text>

                    <View style={styles.formList}>
                        {/* Merchant Selector */}
                        <TouchableOpacity
                            style={styles.listItem}
                            onPress={() => setShowMerchantModal(true)}
                        >
                            <View style={[styles.itemIconCircle, { backgroundColor: '#3B82F6' }]}>
                                <User size={20} color="#FFF" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemLabel}>Merchant</Text>
                                <Text style={styles.itemValue}>{selectedMerchant || 'Select Merchant'}</Text>
                            </View>
                            <ChevronRight size={20} color="#475569" />
                        </TouchableOpacity>

                        {/* Category Selector */}
                        <TouchableOpacity
                            style={styles.listItem}
                            onPress={() => setShowCategoryModal(true)}
                        >
                            <View style={[styles.itemIconCircle, { backgroundColor: '#10B981' }]}>
                                <Tag size={20} color="#FFF" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemLabel}>Set Category</Text>
                                <Text style={styles.itemValue}>{selectedCategory || 'Select Category'}</Text>
                            </View>
                            <ChevronRight size={20} color="#475569" />
                        </TouchableOpacity>

                        {/* Transfer Toggle */}
                        <View style={styles.toggleItem}>
                            <View style={[styles.itemIconCircle, { backgroundColor: '#6366F1' }]}>
                                <Repeat size={20} color="#FFF" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemLabel}>Mark as Transfer</Text>
                                <Text style={styles.itemSubtext}>
                                    Hide from spending reports
                                </Text>
                            </View>
                            <Switch
                                value={isTransfer}
                                onValueChange={setIsTransfer}
                                trackColor={{ false: '#334155', true: '#0EA5E9' }}
                                thumbColor="#FFF"
                            />
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.btnSecondary}
                            onPress={() => handleSaveRule(false)}
                            disabled={processing}
                        >
                            <Text style={styles.btnTextSec}>Save Rule Only</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.btnPrimary}
                            onPress={() => handleSaveRule(true)}
                            disabled={processing}
                        >
                            {processing ? <ActivityIndicator color="#FFF" /> : (
                                <>
                                    <CheckCircle size={18} color="#FFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.btnText}>Save & Apply to Past</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}

            {/* Merchant Selection Modal */}
            <Modal
                visible={showMerchantModal}
                presentationStyle="fullScreen"
                animationType="slide"
                onRequestClose={() => setShowMerchantModal(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
                    <View style={styles.modalContentFullscreen}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowMerchantModal(false)} style={styles.iconButton}>
                                <ArrowLeft size={24} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Merchant</Text>
                            <View style={{ width: 40 }} />
                        </View>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search merchants..."
                            placeholderTextColor="#64748B"
                            value={merchantSearchQuery}
                            onChangeText={setMerchantSearchQuery}
                        />

                        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                            {filteredMerchants.map((m, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={[
                                        styles.modalOption,
                                        selectedMerchant === m && styles.modalOptionActive
                                    ]}
                                    onPress={() => {
                                        setSelectedMerchant(m);
                                        setShowMerchantModal(false);
                                    }}
                                >
                                    <View style={styles.row}>
                                        <View style={[styles.itemIconCircleSmall, { backgroundColor: '#334155' }]}>
                                            <User size={16} color="#FFF" />
                                        </View>
                                        <Text style={[
                                            styles.modalOptionText,
                                            selectedMerchant === m && styles.modalOptionTextActive
                                        ]}>
                                            {m}
                                        </Text>
                                    </View>
                                    {selectedMerchant === m ? <Check size={20} color="#0EA5E9" /> : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Category Selection Modal */}
            <Modal
                visible={showCategoryModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContentSheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.iconButton}>
                                <Text style={{ color: '#64748B', fontSize: 16 }}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Category</Text>
                            <View style={{ width: 40 }} />
                        </View>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search categories..."
                            placeholderTextColor="#64748B"
                            value={categorySearchQuery}
                            onChangeText={setCategorySearchQuery}
                        />

                        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} style={{ maxHeight: 400 }}>
                            {filteredCategories.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id || cat.name}
                                    style={[
                                        styles.modalOption,
                                        selectedCategory === cat.name && styles.modalOptionActive
                                    ]}
                                    onPress={() => {
                                        setSelectedCategory(cat.name);
                                        setShowCategoryModal(false);
                                    }}
                                >
                                    <View style={styles.row}>
                                        <View style={[styles.itemIconCircleSmall, { backgroundColor: cat.color || '#334155' }]}>
                                            <Tag size={16} color="#FFF" />
                                        </View>
                                        <Text style={[
                                            styles.modalOptionText,
                                            selectedCategory === cat.name && styles.modalOptionTextActive
                                        ]}>
                                            {cat.name}
                                        </Text>
                                    </View>
                                    {selectedCategory === cat.name ? <Check size={20} color="#0EA5E9" /> : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1E293B' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
    iconButton: { padding: 4 },
    content: { flex: 1 },
    helperText: { color: '#94A3B8', padding: 16, fontSize: 14, lineHeight: 20 },

    // Form List
    formList: { marginTop: 8 },
    listItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B', backgroundColor: '#0F172A' },
    toggleItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    itemIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    itemIconCircleSmall: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    itemContent: { flex: 1 },
    itemLabel: { color: '#94A3B8', fontSize: 13, marginBottom: 2 },
    itemValue: { color: '#FFF', fontSize: 16, fontWeight: '500' },
    itemSubtext: { color: '#64748B', fontSize: 13, marginTop: 2 },

    // Actions
    actionButtons: { padding: 16, gap: 12, marginTop: 24 },
    btnPrimary: { flexDirection: 'row', backgroundColor: '#0EA5E9', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnSecondary: { backgroundColor: '#334155', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    btnTextSec: { color: '#E2E8F0', fontWeight: '600', fontSize: 16 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContentFullscreen: { flex: 1, padding: 16 },
    modalContentSheet: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    searchInput: { backgroundColor: '#334155', borderRadius: 12, padding: 12, color: '#FFF', fontSize: 16, marginBottom: 16 },
    modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
    modalOptionActive: { backgroundColor: 'rgba(14, 165, 233, 0.1)', paddingHorizontal: 12, marginHorizontal: -12, borderRadius: 8 },
    modalOptionText: { color: '#E2E8F0', fontSize: 16 },
    modalOptionTextActive: { color: '#0EA5E9', fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center' },
});

export default MerchantRules;
