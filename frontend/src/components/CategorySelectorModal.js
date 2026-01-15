import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Alert } from 'react-native';
import { X, Search, ChevronLeft, ChevronRight, Plus, Check, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORY_TAXONOMY, getCategoryIcon, getCategoryColor } from '../constants/CategoryTaxonomy';
import * as LucideIcons from 'lucide-react-native';
import api from '../config/api';

// Helper to render dynamic icon
const DynamicIcon = ({ name, color, size = 24 }) => {
    const iconName = name ? (name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase())) : 'Tag';
    const LucideIcon = LucideIcons[iconName] || LucideIcons.Tag;
    return <LucideIcon size={size} color={color} />;
};

const CategorySelectorModal = ({ visible, onClose, onSelect, currentCategory }) => {
    const [selectedParent, setSelectedParent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [customCategories, setCustomCategories] = useState([]);

    // Modes: 'SELECT' or 'CREATE'
    const [mode, setMode] = useState('SELECT');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchCustomCategories();
            setMode('SELECT');
            setNewCategoryName('');
            setSearchQuery('');
        }
    }, [visible]);

    const fetchCustomCategories = async () => {
        try {
            const res = await api.get('/categories');
            const cats = Array.isArray(res.data) ? res.data : (res.data.categories || []);
            setCustomCategories(cats);
        } catch (err) {
            // console.log('Error fetching categories:', err);
        }
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        setCreating(true);
        try {
            const name = newCategoryName.trim();
            const parent = selectedParent; // If null, it's a main category. If selectedParent is set (from nav), it's sub.

            // Default color/icon for now
            const color = parent ? (CATEGORY_TAXONOMY[parent]?.color || '#64748B') : '#64748B';
            const icon = parent ? (CATEGORY_TAXONOMY[parent]?.icon || 'tag') : 'tag';

            await api.post('/categories', {
                name,
                parent_category: parent,
                color,
                icon
            });
            await fetchCustomCategories();

            // Cleanup and Select
            setMode('SELECT');
            setNewCategoryName('');
            if (parent) {
                // Stay in parent view, select new sub
                onSelect(name);
                onClose();
            } else {
                // Creating main category
                setSelectedParent(name); // Enter the new folder
            }
        } catch (err) {
            console.error('Failed to create category', err);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteCategory = (categoryName) => {
        // Check if it's a system category
        const isSystem = !customCategories.some(c => c.name === categoryName);
        if (isSystem) {
            Alert.alert("Cannot Delete", `"${categoryName}" is a built-in category and cannot be deleted.`);
            return;
        }

        Alert.alert(
            "Delete Category",
            `Are you sure you want to delete "${categoryName}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/categories/${categoryName}`);
                            await fetchCustomCategories();
                        } catch (err) {
                            console.error('Delete failed:', err);
                            Alert.alert("Error", "Failed to delete category");
                        }
                    }
                }
            ]
        );
    };



    const mergedTaxonomy = useMemo(() => {
        // Start with full static taxonomy
        const merged = JSON.parse(JSON.stringify(CATEGORY_TAXONOMY));

        customCategories.forEach(cat => {
            if (cat.parent_category) {
                if (merged[cat.parent_category]) {
                    if (!merged[cat.parent_category].subcategories.includes(cat.name)) {
                        merged[cat.parent_category].subcategories.push(cat.name);
                    }
                } else {
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
    }, [customCategories]);

    const renderCreationView = () => (
        <View style={styles.creationContainer}>
            <View style={styles.formGroup}>
                <Text style={styles.label}>Category Name</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. My Custom Category"
                    placeholderTextColor="#94A3B8"
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    autoFocus
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Parent Category</Text>
                <View style={styles.parentDisplay}>
                    {selectedParent ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.iconCircleSmall, { backgroundColor: (mergedTaxonomy[selectedParent]?.color || '#64748B') + '20' }]}>
                                <DynamicIcon name={mergedTaxonomy[selectedParent]?.icon} color={mergedTaxonomy[selectedParent]?.color || '#64748B'} size={18} />
                            </View>
                            <Text style={styles.parentText}>{selectedParent}</Text>
                        </View>
                    ) : (
                        <Text style={styles.parentText}>None (Top Level Category)</Text>
                    )}
                </View>
                <Text style={styles.hint}>
                    {selectedParent
                        ? "This will be added as a subcategory."
                        : "This will be a new main category folder."}
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.createBtn, !newCategoryName.trim() && styles.disabledBtn]}
                onPress={handleCreateCategory}
                disabled={creating || !newCategoryName.trim()}
            >
                {creating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.createBtnText}>Create Category</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('SELECT')}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
        </View>
    );

    const renderParentGrid = () => {
        const parents = Object.keys(mergedTaxonomy).filter(p =>
            p.toLowerCase().includes(searchQuery.toLowerCase()) ||
            mergedTaxonomy[p].subcategories.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        return (
            <ScrollView contentContainerStyle={styles.gridContainer}>
                {parents.map((parent) => {
                    const data = mergedTaxonomy[parent];
                    const isCustomParent = customCategories.some(c => c.name === parent && !c.parent_category);
                    return (
                        <View key={parent} style={styles.gridItemWrapper}>
                            <TouchableOpacity
                                style={styles.gridItem}
                                onPress={() => setSelectedParent(parent)}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: data.color + '20' }]}>
                                    <DynamicIcon name={data.icon} color={data.color} size={28} />
                                </View>
                                <Text style={styles.gridLabel} numberOfLines={2}>{parent}</Text>
                            </TouchableOpacity>
                            {isCustomParent && (
                                <TouchableOpacity
                                    style={styles.gridDeleteButton}
                                    onPress={() => handleDeleteCategory(parent)}
                                >
                                    <Trash2 size={18} color="#EF4444" />
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        );
    };

    const renderSubcategories = () => {
        if (!selectedParent) return null;
        const data = mergedTaxonomy[selectedParent];
        const subs = data.subcategories.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

        return (
            <View style={{ flex: 1 }}>
                <TouchableOpacity style={styles.backButton} onPress={() => setSelectedParent(null)}>
                    <ChevronLeft size={20} color="#64748B" />
                    <Text style={styles.backText}>{selectedParent}</Text>
                </TouchableOpacity>

                <ScrollView contentContainerStyle={styles.listContainer}>

                    {subs.map((sub) => {
                        const isCustom = customCategories.some(c => c.name === sub);
                        return (
                            <View key={sub} style={styles.listItemRow}>
                                <TouchableOpacity
                                    style={styles.listItemContent}
                                    onPress={() => {
                                        onSelect(sub);
                                        onClose();
                                    }}
                                >
                                    <View style={[styles.iconCircleSmall, { backgroundColor: '#F1F5F9' }]}>
                                        <View style={[styles.dot, { backgroundColor: data.color }]} />
                                    </View>
                                    <Text style={styles.listLabel}>{sub}</Text>
                                    {currentCategory === sub && <Check size={16} color={data.color} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleDeleteCategory(sub)}
                                >
                                    <Trash2 size={18} color={isCustom ? "#EF4444" : "#94A3B8"} />
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => mode === 'CREATE' ? setMode('SELECT') : onClose()}
                            style={styles.closeButtonLeft}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            {mode === 'CREATE' ? <Text style={styles.cancelLink}>Cancel</Text> : <X size={24} color="#1E293B" />}
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>
                            {mode === 'CREATE' ? 'New Category' : 'Select Category'}
                        </Text>

                        {mode === 'SELECT' && (
                            <TouchableOpacity
                                onPress={() => setMode('CREATE')}
                                style={styles.addButton}
                                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            >
                                <Plus size={24} color="#3B82F6" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {mode === 'SELECT' && (
                        <View style={styles.searchContainer}>
                            <Search size={20} color="#94A3B8" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search categories..."
                                placeholderTextColor="#94A3B8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    )}

                    {mode === 'CREATE' ? renderCreationView() : (
                        selectedParent && !searchQuery ? renderSubcategories() : (selectedParent ? renderSubcategories() : renderParentGrid())
                    )}
                </KeyboardAvoidingView>
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
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        position: 'relative',
        zIndex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    closeButtonLeft: {
        position: 'absolute',
        left: 16,
        zIndex: 10,
        padding: 4,
    },
    cancelLink: {
        color: '#64748B',
        fontSize: 16,
    },
    addButton: {
        position: 'absolute',
        right: 16,
        zIndex: 10,
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
        height: 40,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        paddingBottom: 40,
    },
    gridItem: {
        width: '33.33%',
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 4,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    gridLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#334155',
        textAlign: 'center',
        lineHeight: 16,
    },
    backButton: {
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
    listContainer: {
        padding: 16,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    iconCircleSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    listLabel: {
        flex: 1,
        fontSize: 16,
        color: '#334155',
    },
    // Creation Styles
    creationContainer: {
        padding: 24,
        flex: 1,
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
    },
    input: {
        fontSize: 18,
        color: '#0F172A',
        borderBottomWidth: 2,
        borderBottomColor: '#3B82F6',
        paddingVertical: 8,
    },
    parentDisplay: {
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    parentText: {
        fontSize: 16,
        color: '#0F172A',
        fontWeight: '500',
    },
    hint: {
        marginTop: 8,
        fontSize: 13,
        color: '#94A3B8',
    },
    createBtn: {
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    disabledBtn: {
        backgroundColor: '#94A3B8',
    },
    createBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    cancelBtn: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#64748B',
        fontSize: 16,
        fontWeight: '600',
    },
    listItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    listItemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    deleteButton: {
        padding: 12,
        marginRight: 4,
    },
    gridItemWrapper: {
        position: 'relative',
        width: '30%',
        marginBottom: 20,
    },
    gridDeleteButton: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    }
});

export default CategorySelectorModal;

