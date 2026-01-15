import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const CustomDatePicker = ({ selectedDate, onDateSelect, onClose }) => {
    // Parse initial date or default to today
    const initialDate = selectedDate ? new Date(selectedDate) : new Date();
    // Handle invalid date strings
    const validInitialDate = isNaN(initialDate.getTime()) ? new Date() : initialDate;

    const [currentMonth, setCurrentMonth] = useState(validInitialDate);

    useEffect(() => {
        if (selectedDate) {
            const d = new Date(selectedDate);
            if (!isNaN(d.getTime())) {
                setCurrentMonth(d);
            }
        }
    }, [selectedDate]);

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const changeMonth = (increment) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentMonth(newDate);
    };

    const handleDayPress = (day) => {
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        onDateSelect(`${year}-${month}-${dayStr}`);
    };

    const renderCalendarDays = () => {
        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = getFirstDayOfMonth(currentMonth);
        const days = [];

        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
        }

        // Days of current month
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === new Date().toISOString().split('T')[0];

            days.push(
                <TouchableOpacity
                    key={i}
                    style={[
                        styles.dayCell,
                        isSelected && styles.selectedDayCell,
                        !isSelected && isToday && styles.todayCell
                    ]}
                    onPress={() => handleDayPress(i)}
                >
                    <Text style={[
                        styles.dayText,
                        isSelected && styles.selectedDayText,
                        !isSelected && isToday && styles.todayText
                    ]}>
                        {i}
                    </Text>
                </TouchableOpacity>
            );
        }

        return days;
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrowButton}>
                    <ChevronLeft size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                    {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrowButton}>
                    <ChevronRight size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Weekdays */}
            <View style={styles.weekRow}>
                {DAYS.map(day => (
                    <Text key={day} style={styles.weekDayText}>{day}</Text>
                ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
                {renderCalendarDays()}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 16,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    monthTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    arrowButton: {
        padding: 8,
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    weekDayText: {
        flex: 1,
        textAlign: 'center',
        color: '#64748B',
        fontSize: 13,
        fontWeight: '600',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%', // 100% / 7
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    selectedDayCell: {
        backgroundColor: '#0EA5E9',
        borderRadius: 20,
    },
    todayCell: {
        backgroundColor: '#334155',
        borderRadius: 20,
    },
    dayText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '500',
    },
    selectedDayText: {
        color: '#FFF',
        fontWeight: '700',
    },
    todayText: {
        color: '#0EA5E9',
        fontWeight: '600',
    },
});

export default CustomDatePicker;
