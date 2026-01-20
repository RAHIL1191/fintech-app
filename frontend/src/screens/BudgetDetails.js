import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BudgetDetails = ({ navigation, route }) => {
    console.log('BudgetDetails Minimal Render', route.params);
    return (
        <SafeAreaView style={styles.container}>
            <Text>Budget Details Debug</Text>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF'
    }
});

export default BudgetDetails;
