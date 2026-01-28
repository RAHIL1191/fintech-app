import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { X, Bell, Check, Trash2 } from 'lucide-react-native';
import api from '../config/api';

const AlertsModal = ({ visible, onClose, notifications, onRefresh }) => {

    const handleMarkRead = async (id) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            onRefresh();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/notifications/${id}`);
            onRefresh();
        } catch (e) {
            console.error(e);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.post('/notifications/mark-all-read');
            onRefresh();
        } catch (e) {
            console.error(e);
        }
    };

    const renderItem = ({ item }) => {
        const isRead = item.read;
        const color = item.type === 'danger' ? '#EF4444' : item.type === 'warning' ? '#F59E0B' : '#3B82F6';

        return (
            <View style={[styles.card, isRead && styles.readCard]}>
                <View style={[styles.iconBar, { backgroundColor: color }]} />
                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <Text style={[styles.title, isRead && styles.readText]}>{item.title}</Text>
                        <Text style={styles.date}>
                            {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <Text style={[styles.body, isRead && styles.readText]}>{item.body}</Text>

                    <View style={styles.actions}>
                        {!isRead && (
                            <TouchableOpacity onPress={() => handleMarkRead(item.id)} style={styles.actionBtn}>
                                <Check size={16} color="#4ADE80" />
                                <Text style={styles.actionText}>Mark Read</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                            <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <View style={styles.header}>
                        <View style={styles.headerTitleRow}>
                            <Bell color="#fff" size={20} />
                            <Text style={styles.modalText}>Notifications</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X color="#A1A1AA" size={24} />
                        </TouchableOpacity>
                    </View>

                    {notifications.length > 0 && notifications.some(n => !n.read) && (
                        <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
                            <Text style={styles.markAllText}>Mark all as read</Text>
                        </TouchableOpacity>
                    )}

                    <FlatList
                        data={notifications}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No notifications</Text>
                            </View>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        backgroundColor: '#18181B',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        height: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    modalText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeButton: {
        padding: 5,
    },
    listContent: {
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#27272A',
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    readCard: {
        opacity: 0.6,
    },
    iconBar: {
        width: 4,
        height: '100%',
    },
    content: {
        flex: 1,
        padding: 12,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
        flex: 1,
    },
    date: {
        color: '#71717A',
        fontSize: 10,
        marginLeft: 8,
    },
    body: {
        color: '#D4D4D8',
        fontSize: 13,
    },
    readText: {
        color: '#A1A1AA',
    },
    actions: {
        flexDirection: 'row',
        marginTop: 10,
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 15,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    actionText: {
        color: '#4ADE80',
        fontSize: 12,
        fontWeight: '500',
    },
    deleteBtn: {
        padding: 4,
    },
    markAllBtn: {
        alignSelf: 'flex-end',
        marginBottom: 10,
    },
    markAllText: {
        color: '#3B82F6',
        fontSize: 12,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#71717A',
    },
});

export default AlertsModal;
