import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'PLAID_ACCESS_TOKEN';
let cachedToken = null;

export const saveToken = async (token) => {
    try {
        cachedToken = token;
        await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
        console.error('Failed to save token', e);
    }
};

export const loadToken = async () => {
    try {
        if (cachedToken) return cachedToken;
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        cachedToken = token;
        return token;
    } catch (e) {
        console.error('Failed to load token', e);
        return null;
    }
};

export const getToken = () => cachedToken; // Still useful for sync access if already loaded

