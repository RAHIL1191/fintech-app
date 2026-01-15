import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { X, Delete, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CalculatorModal = ({ visible, onClose, onConfirm, initialAmount }) => {
    const insets = useSafeAreaInsets();
    const [displayValue, setDisplayValue] = useState('0');
    const [operator, setOperator] = useState(null);
    const [firstValue, setFirstValue] = useState(null);
    const [waitingForSecondValue, setWaitingForSecondValue] = useState(false);

    useEffect(() => {
        if (visible) {
            setDisplayValue(initialAmount && initialAmount !== '0' ? String(initialAmount) : '0');
            setOperator(null);
            setFirstValue(null);
            setWaitingForSecondValue(false);
        }
    }, [visible, initialAmount]);

    const handleDigitPress = (digit) => {
        if (waitingForSecondValue) {
            setDisplayValue(String(digit));
            setWaitingForSecondValue(false);
        } else {
            setDisplayValue(displayValue === '0' ? String(digit) : displayValue + digit);
        }
    };

    const handleDecimalPress = () => {
        if (waitingForSecondValue) {
            setDisplayValue('0.');
            setWaitingForSecondValue(false);
            return;
        }
        if (!displayValue.includes('.')) {
            setDisplayValue(displayValue + '.');
        }
    };

    const handleClear = () => {
        setDisplayValue('0');
        setOperator(null);
        setFirstValue(null);
        setWaitingForSecondValue(false);
    };

    const handleBackspace = () => {
        if (displayValue.length > 1) {
            setDisplayValue(displayValue.slice(0, -1));
        } else {
            setDisplayValue('0');
        }
    };

    const performOperation = (nextOperator) => {
        const inputValue = parseFloat(displayValue);

        if (firstValue === null) {
            setFirstValue(inputValue);
        } else if (operator) {
            const result = calculate(firstValue, inputValue, operator);
            setDisplayValue(String(result));
            setFirstValue(result);
        }

        setWaitingForSecondValue(true);
        setOperator(nextOperator);
    };

    const calculate = (first, second, op) => {
        switch (op) {
            case '+': return first + second;
            case '-': return first - second;
            case '*': return first * second;
            case '/': return first / second;
            default: return second;
        }
    };

    const handleEqual = () => {
        if (!operator || firstValue === null) return;

        const inputValue = parseFloat(displayValue);
        const result = calculate(firstValue, inputValue, operator);

        setDisplayValue(String(result));
        setFirstValue(null);
        setOperator(null);
        setWaitingForSecondValue(true);
    };

    const handleConfirm = () => {
        // Evaluate any pending operation before confirming
        let finalValue = displayValue;
        if (operator && firstValue !== null) {
            const inputValue = parseFloat(displayValue);
            const result = calculate(firstValue, inputValue, operator);
            finalValue = String(result);
        }

        onConfirm(finalValue);
        onClose();
    };

    const Button = ({ text, onPress, type = 'number', icon }) => {
        const isOperator = type === 'operator';
        const isAction = type === 'action';
        const isActiveOperator = isOperator && operator === text;

        let bg = '#F8FAFC';
        let color = '#1E293B';

        if (isAction) {
            bg = '#E2E8F0';
            color = '#0F172A';
        } else if (isOperator) {
            bg = isActiveOperator ? '#0EA5E9' : '#E0F2FE';
            color = isActiveOperator ? '#FFF' : '#0284C7';
        }

        return (
            <TouchableOpacity
                style={[styles.button, { backgroundColor: bg }]}
                onPress={onPress}
            >
                {icon ? icon : <Text style={[styles.buttonText, { color }]}>{text}</Text>}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Calculator</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    {/* Display */}
                    <View style={styles.displayContainer}>
                        <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
                            {displayValue}
                        </Text>
                    </View>

                    {/* Keypad */}
                    <View style={styles.keypad}>
                        <View style={styles.row}>
                            <Button text="C" type="action" onPress={handleClear} />
                            <Button icon={<Delete size={24} color="#0F172A" />} type="action" onPress={handleBackspace} />
                            <Button text="%" type="action" onPress={() => performOperation('%')} />
                            <Button text="/" type="operator" onPress={() => performOperation('/')} />
                        </View>
                        <View style={styles.row}>
                            <Button text="7" onPress={() => handleDigitPress(7)} />
                            <Button text="8" onPress={() => handleDigitPress(8)} />
                            <Button text="9" onPress={() => handleDigitPress(9)} />
                            <Button text="*" type="operator" onPress={() => performOperation('*')} />
                        </View>
                        <View style={styles.row}>
                            <Button text="4" onPress={() => handleDigitPress(4)} />
                            <Button text="5" onPress={() => handleDigitPress(5)} />
                            <Button text="6" onPress={() => handleDigitPress(6)} />
                            <Button text="-" type="operator" onPress={() => performOperation('-')} />
                        </View>
                        <View style={styles.row}>
                            <Button text="1" onPress={() => handleDigitPress(1)} />
                            <Button text="2" onPress={() => handleDigitPress(2)} />
                            <Button text="3" onPress={() => handleDigitPress(3)} />
                            <Button text="+" type="operator" onPress={() => performOperation('+')} />
                        </View>
                        <View style={styles.row}>
                            <Button text="0" onPress={() => handleDigitPress(0)} style={{ flex: 2 }} />
                            <Button text="." onPress={handleDecimalPress} />
                            <Button text="=" type="operator" onPress={handleEqual} bg="#0EA5E9" color="#FFF" />
                        </View>
                    </View>

                    {/* Confirm Button */}
                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                        <Text style={styles.confirmButtonText}>Use this Amount</Text>
                        <Check size={20} color="#FFF" />
                    </TouchableOpacity>

                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    closeButton: {
        padding: 4,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
    },
    displayContainer: {
        backgroundColor: '#F8FAFC',
        padding: 24,
        borderRadius: 16,
        marginBottom: 24,
        alignItems: 'flex-end',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    displayText: {
        fontSize: 40,
        fontWeight: '600',
        color: '#0F172A',
    },
    keypad: {
        gap: 12,
        marginBottom: 24,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        height: 64,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    buttonText: {
        fontSize: 24,
        fontWeight: '500',
        color: '#1E293B',
    },
    confirmButton: {
        backgroundColor: '#0EA5E9',
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    confirmButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
});

export default CalculatorModal;
