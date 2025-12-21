import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Bills = () => (
    <SafeAreaView style={styles.container}>
        <View style={styles.content}>
            <Text style={styles.title}>Bills</Text>
            <Text style={styles.subtitle}>Coming Soon: Track your monthly payments.</Text>
        </View>
    </SafeAreaView>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FE' },
    content: { padding: 20 },
    title: { fontSize: 28, fontWeight: '800', color: '#1A1A1A', marginBottom: 10 },
    subtitle: { fontSize: 16, color: '#666' }
});

export default Bills;
