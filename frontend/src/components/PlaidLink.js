import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, NativeModules, Platform } from 'react-native';
import { create, open } from 'react-native-plaid-link-sdk';
import { Landmark } from 'lucide-react-native';
import api from '../config/api';

const PlaidLink = ({ onSuccess }) => {
    const [linkToken, setLinkToken] = useState(null);
    const [loading, setLoading] = useState(false);

    const createLinkToken = useCallback(async () => {
        setLoading(true);
        try {
            console.log('Fetching link token from:', api.defaults.baseURL);
            const response = await api.post('/create_link_token');
            console.log('Link token received successfully');
            setLinkToken(response.data.link_token);
        } catch (error) {
            console.error('Error creating link token:', error);
            const msg = error.response ? JSON.stringify(error.response.data) : error.message;
            Alert.alert('Connection Error', `Failed to reach backend.\n\nError: ${msg}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        createLinkToken();
    }, [createLinkToken]);

    const handlePress = () => {
        // Check if the native module is available
        const isNativeModuleAvailable = Platform.OS === 'android'
            ? !!NativeModules.PlaidAndroid
            : !!NativeModules.RNLinksdkiOS;

        if (!isNativeModuleAvailable) {
            Alert.alert(
                'Development Build Required',
                'Plaid cannot run in Expo Go. You must create a "Development Build" to use banking features.\n\nRun "npx expo run:android" in your terminal.'
            );
            return;
        }

        if (!linkToken) {
            createLinkToken();
            return;
        }

        try {
            // Updated for Plaid SDK v11+
            create({ token: linkToken });
            open({
                onSuccess: async (linkSuccess) => {
                    console.log('Plaid Link Success Metadata:', linkSuccess);
                    try {
                        const response = await api.post('/exchange_public_token', {
                            public_token: linkSuccess.publicToken,
                            metadata: linkSuccess.metadata // Pass metadata for backend to save Institution Name
                        });
                        console.log('Token exchange successful');
                        if (onSuccess) {
                            onSuccess(response.data.access_token);
                        }
                    } catch (error) {
                        console.error('Error exchanging public token:', error);
                        Alert.alert('Exchange Failed', 'Could not exchange public token.');
                    }
                },
                onExit: (exit) => {
                    console.log('User exited Plaid Link:', exit);
                },
            });
        } catch (error) {
            console.error('Error opening Plaid Link:', error);
            Alert.alert('Plaid Error', 'Failed to open the Plaid screen.');
        }
    };

    if (!linkToken && loading) {
        return (
            <View style={styles.buttonContainer}>
                <ActivityIndicator color="#6200EE" size="large" />
                <Text style={styles.loadingText}>Initializing Secure Connection...</Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={styles.button}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            <Landmark size={20} color="#FFF" style={styles.icon} />
            <Text style={styles.buttonText}>
                {!linkToken ? 'Retry Connecting Bank' : 'Connect Bank Account'}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    buttonContainer: {
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    loadingText: {
        marginTop: 10,
        color: '#6200EE',
        fontSize: 12,
        fontWeight: '600',
    },
    button: {
        backgroundColor: '#6200EE',
        height: 56,
        borderRadius: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
        shadowColor: '#6200EE',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    icon: {
        marginRight: 10,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default PlaidLink;
