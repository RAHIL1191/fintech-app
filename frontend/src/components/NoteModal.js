import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NoteModal = ({ visible, onClose, onSave, initialNote = '' }) => {
    const insets = useSafeAreaInsets();
    const [note, setNote] = useState(initialNote);

    useEffect(() => {
        if (visible) {
            setNote(initialNote || '');
        }
    }, [visible, initialNote]);

    const handleSave = () => {
        onSave(note);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    style={styles.keyboardView}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -100} // Adjust offset if needed
                >
                    <View style={[styles.content, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity style={styles.closePlaceholder} disabled>
                                <X size={24} color="transparent" />
                            </TouchableOpacity>
                            <Text style={styles.title}>Edit Notes</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Input Area */}
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter Notes"
                                placeholderTextColor="#94A3B8"
                                value={note}
                                onChangeText={setNote}
                                multiline
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveBtnText}>SAVE</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    keyboardView: {
        width: '100%',
    },
    content: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 300,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    closeBtn: {
        padding: 4,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
    },
    closePlaceholder: {
        padding: 4,
    },
    inputContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 12,
        height: 150,
        marginBottom: 24,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#0F172A',
        textAlignVertical: 'top',
    },
    saveBtn: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default NoteModal;
