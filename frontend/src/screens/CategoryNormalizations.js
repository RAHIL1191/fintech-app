import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Edit2, Trash2, X } from 'lucide-react-native';
import api from '../config/api';

const CategoryNormalizations = ({ navigation }) => {
    const [normalizations, setNormalizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentNormalization, setCurrentNormalization] = useState(null);
    const [fromCategory, setFromCategory] = useState('');
    const [toCategory, setToCategory] = useState('');

    useEffect(() => {
        fetchNormalizations();
    }, []);

    const fetchNormalizations = async () => {
        try {
            setLoading(true);
            const res = await api.get('/category-normalizations');
            setNormalizations(res.data.normalizations || []);
        } catch (error) {
            console.error('Failed to fetch normalizations:', error);
            Alert.alert('Error', 'Failed to load category normalizations');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setEditMode(false);
        setCurrentNormalization(null);
        setFromCategory('');
        setToCategory('');
        setModalVisible(true);
    };

    const handleEdit = (normalization) => {
        setEditMode(true);
        setCurrentNormalization(normalization);
        setFromCategory(normalization.from_category);
        setToCategory(normalization.to_category);
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!fromCategory || !toCategory) {
            Alert.alert('Error', 'Both fields are required');
            return;
        }

        try {
            if (editMode && currentNormalization) {
                await api.put(`/category-normalizations/${currentNormalization.id}`, {
                    from_category: fromCategory,
                    to_category: toCategory
                });
            } else {
                await api.post('/category-normalizations', {
                    from_category: fromCategory,
                    to_category: toCategory
                });
            }
            setModalVisible(false);
            fetchNormalizations();
        } catch (error) {
            console.error('Failed to save normalization:', error);
            Alert.alert('Error', 'Failed to save normalization');
        }
    };

    const handleDelete = (normalization) => {
        Alert.alert(
            'Delete Normalization',
            `Remove mapping: "${normalization.from_category}" → "${normalization.to_category}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/category-normalizations/${normalization.id}`);
                            fetchNormalizations();
                        } catch (error) {
                            console.error('Failed to delete:', error);
                            Alert.alert('Error', 'Failed to delete normalization');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Insights' })} style={styles.backButton}>
                    <ChevronLeft size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Category Normalizations</Text>
                <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
                    <Plus size={24} color="#0EA5E9" />
                </TouchableOpacity>
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                    Category normalizations automatically merge similar categories (e.g., "Grocery" → "Groceries")
                </Text>
            </View>

            {/* List */}
            {loading ? (
                <ActivityIndicator size="large" color="#0EA5E9" style={styles.loader} />
            ) : (
                <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 20 }}>
                    {normalizations.length === 0 ? (
                        <Text style={styles.emptyText}>No normalizations yet. Add one to get started!</Text>
                    ) : (
                        normalizations.map((norm) => (
                            <View key={norm.id} style={styles.normItem}>
                                <View style={styles.normContent}>
                                    <Text style={styles.fromText}>{norm.from_category}</Text>
                                    <Text style={styles.arrow}>→</Text>
                                    <Text style={styles.toText}>{norm.to_category}</Text>
                                </View>
                                <View style={styles.actions}>
                                    <TouchableOpacity onPress={() => handleEdit(norm)} style={styles.actionButton}>
                                        <Edit2 size={18} color="#0EA5E9" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(norm)} style={styles.actionButton}>
                                        <Trash2 size={18} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Add/Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editMode ? 'Edit' : 'Add'} Normalization</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.label}>From Category</Text>
                            <TextInput
                                style={styles.input}
                                value={fromCategory}
                                onChangeText={setFromCategory}
                                placeholder="e.g., Grocery"
                                placeholderTextColor="#64748B"
                            />

                            <Text style={styles.label}>To Category</Text>
                            <TextInput
                                style={styles.input}
                                value={toCategory}
                                onChangeText={setToCategory}
                                placeholder="e.g., Groceries"
                                placeholderTextColor="#64748B"
                            />

                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0F1E',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#0F1629',
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
        flex: 1,
        textAlign: 'center',
        marginLeft: -28, // offset add button
    },
    addButton: {
        padding: 4,
    },
    infoBox: {
        backgroundColor: '#1E293B',
        padding: 12,
        margin: 16,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#0EA5E9',
    },
    infoText: {
        color: '#94A3B8',
        fontSize: 13,
    },
    loader: {
        marginTop: 50,
    },
    list: {
        flex: 1,
        paddingHorizontal: 16,
    },
    emptyText: {
        textAlign: 'center',
        color: '#64748B',
        fontSize: 15,
        marginTop: 50,
    },
    normItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    normContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    fromText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '500',
    },
    arrow: {
        color: '#0EA5E9',
        fontSize: 18,
        marginHorizontal: 12,
    },
    toText: {
        color: '#10B981',
        fontSize: 15,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '90%',
        backgroundColor: '#0F1629',
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#1E293B',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
    },
    modalBody: {
        padding: 20,
    },
    label: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 8,
        padding: 12,
        color: '#FFF',
        fontSize: 15,
    },
    saveButton: {
        backgroundColor: '#0EA5E9',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 24,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default CategoryNormalizations;
