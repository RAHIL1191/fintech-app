import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, NativeModules, Platform, Modal, SafeAreaView } from 'react-native';
import { create, open } from 'react-native-plaid-link-sdk';
import { WebView } from 'react-native-webview';
import { Landmark, X } from 'lucide-react-native';
import api from '../config/api';

const PlaidLink = ({ onSuccess }) => {
    const [linkToken, setLinkToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showWebView, setShowWebView] = useState(false);

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
        // Check availability of Native SDK
        // On Android: NativeModules.PlaidAndroid
        // On iOS (Custom Build): NativeModules.RNLinksdkiOS
        const isNativeModuleAvailable = Platform.OS === 'android'
            ? !!NativeModules.PlaidAndroid
            : !!NativeModules.RNLinksdkiOS;

        if (!linkToken) {
            createLinkToken();
            return;
        }

        if (isNativeModuleAvailable) {
            // Use Native SDK (Android or Custom iOS Build)
            openNativeLink();
        } else {
            // Fallback for Expo Go on iOS (WebView)
            console.log('Native Plaid SDK not found, falling back to WebView.');
            setShowWebView(true);
        }
    };

    const openNativeLink = () => {
        try {
            create({ token: linkToken });
            open({
                onSuccess: async (linkSuccess) => {
                    console.log('Plaid Link Success Metadata (Native):', linkSuccess);
                    await exchangeToken(linkSuccess.publicToken, linkSuccess.metadata);
                },
                onExit: (exit) => {
                    console.log('User exited Plaid Link (Native):', exit);
                },
            });
        } catch (error) {
            console.error('Error opening Plaid Link (Native):', error);
            Alert.alert('Plaid Error', 'Failed to open the Plaid screen.');
        }
    };

    const exchangeToken = async (publicToken, metadata) => {
        try {
            const response = await api.post('/exchange_public_token', {
                public_token: publicToken,
                metadata: metadata // Pass metadata for backend to save Institution Name
            });
            console.log('Token exchange successful');
            if (onSuccess) {
                onSuccess(response.data.access_token);
            }
            setShowWebView(false); // Close WebView if open
        } catch (error) {
            console.error('Error exchanging public token:', error);
            Alert.alert('Exchange Failed', 'Could not exchange public token.');
        }
    };

    const handleWebViewNavigation = (event) => {
        const { url } = event;
        // Plaid redirects to plaidlink://connected or similar schemes on success
        if (url.startsWith('plaidlink://connected')) {
            // Extract public_token and metadata from URL params
            // URL format might vary, but typically params are query strings
            const params = new URLSearchParams(url.split('?')[1]);
            const public_token = params.get('public_token');
            // Metadata parsing from URL is limited, better to rely on server or defaults
            // Construct basic metadata
            const metadata = {
                institution: { name: 'Bank Connection' }, // Simplified for WebView fallback
                link_session_id: params.get('link_session_id')
            };

            if (public_token) {
                setShowWebView(false);
                exchangeToken(public_token, metadata);
            }
            return false; // Stop loading
        }

        // Handle Exit
        if (url.startsWith('plaidlink://exit')) {
            setShowWebView(false);
            return false;
        }

        return true;
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
        <>
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

            {/* WebView Modal for iOS Expo Go Fallback */}
            <Modal
                visible={showWebView}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowWebView(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Connect Verification</Text>
                        <TouchableOpacity onPress={() => setShowWebView(false)} style={styles.closeBtn}>
                            <X size={24} color="#000" />
                        </TouchableOpacity>
                    </View>
                    {linkToken && (
                        <WebView
                            source={{ uri: `https://cdn.plaid.com/link/v2/stable/link.html?isWebview=true&token=${linkToken}` }}
                            onShouldStartLoadWithRequest={handleWebViewNavigation}
                            originWhitelist={['https://*', 'plaidlink://*']}
                            style={{ flex: 1 }}
                        />
                    )}
                </SafeAreaView>
            </Modal>
        </>
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
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFF'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE'
    },
    modalTitle: {
        fontWeight: '600',
        fontSize: 16
    },
    closeBtn: {
        padding: 4
    }
});

export default PlaidLink;
