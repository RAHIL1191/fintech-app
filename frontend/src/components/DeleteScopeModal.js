import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

const DeleteScopeModal = ({ visible, onClose, onSelectScope }) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} />
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <AlertTriangle size={24} color="#EF4444" style={{ marginRight: 12 }} />
                        <Text style={styles.title}>Delete Bill?</Text>
                    </View>
                    <Text style={styles.message}>
                        Delete all future occurrences of this repeat bill, or this occurrence only?
                    </Text>
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.textButton}
                            onPress={() => onSelectScope('future')}
                        >
                            <Text style={styles.buttonText}>THIS & ALL FUTURE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.textButton}
                            onPress={() => onSelectScope('single')}
                        >
                            <Text style={styles.buttonText}>THIS ONLY</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        elevation: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#0F172A',
    },
    message: {
        fontSize: 16,
        color: '#334155',
        lineHeight: 24,
        marginBottom: 24,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    textButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 4,
    },
    buttonText: {
        color: '#EF4444', // Red for delete
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});

export default DeleteScopeModal;
