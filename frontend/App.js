import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LayoutDashboard, Receipt, List, BarChart3, Building2 } from 'lucide-react-native';

// Screens - Restoring all
import Dashboard from './src/screens/Dashboard';
import Bills from './src/screens/Bills';
import Budget from './src/screens/Budget';
import Accounts from './src/screens/Accounts';
import AccountDetails from './src/screens/AccountDetails';
import Transactions from './src/screens/Transactions';
import EditTransaction from './src/screens/EditTransaction';
import TransactionDetails from './src/screens/TransactionDetails';
import CashFlow from './src/screens/CashFlow';
import MerchantRules from './src/screens/MerchantRules';
import AccountTransactions from './src/screens/AccountTransactions';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const RootStack = createNativeStackNavigator();

const AccountsStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AccountsList" component={Accounts} />
            <Stack.Screen name="AccountDetails" component={AccountDetails} />
        </Stack.Navigator>
    );
};

const MainTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: '#2563EB',
                tabBarInactiveTintColor: '#6B7280',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 1,
                    borderTopColor: '#E5E7EB',
                },
                headerShown: false,
            }}
        >
            <Tab.Screen
                name="Home"
                component={Dashboard}
                options={{
                    tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Bills"
                component={Bills}
                options={{
                    tabBarIcon: ({ color, size }) => <Receipt size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Transactions"
                component={Transactions}
                options={{
                    tabBarIcon: ({ color, size }) => <List size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Budget"
                component={Budget}
                options={{
                    tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Accounts"
                component={AccountsStack}
                options={{
                    tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} />,
                }}
            />
        </Tab.Navigator>
    );
};

const DrawerNavigator = () => {
    return (
        <Drawer.Navigator
            screenOptions={{
                headerShown: false,
                drawerActiveTintColor: '#2563EB',
                drawerInactiveTintColor: '#374151',
                drawerLabelStyle: { fontSize: 16, fontWeight: '500' }
            }}
        >
            <Drawer.Screen
                name="MainTabs"
                component={MainTabs}
                options={{ title: 'Home' }}
            />
            <Drawer.Screen
                name="MerchantRules"
                component={MerchantRules}
                options={{ title: 'Merchant Rules' }}
            />
        </Drawer.Navigator>
    );
};

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <NavigationContainer>
                    <RootStack.Navigator screenOptions={{ headerShown: false }}>
                        <RootStack.Screen name="AppDrawer" component={DrawerNavigator} />
                        <RootStack.Screen
                            name="EditTransaction"
                            component={EditTransaction}
                            options={{ presentation: 'modal' }}
                        />
                        <RootStack.Screen name="TransactionDetails" component={TransactionDetails} />
                        <RootStack.Screen name="CashFlow" component={CashFlow} />
                        <RootStack.Screen name="AccountTransactions" component={AccountTransactions} />
                    </RootStack.Navigator>
                </NavigationContainer>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
