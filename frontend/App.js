import 'react-native-gesture-handler';
console.log("!!! APP LAUNCHED !!!");
import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LayoutDashboard, Receipt, BarChart3, Building2, PieChart } from 'lucide-react-native';
import api from './src/config/api';

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
import Insights from './src/screens/Insights';
import BillDetails from './src/screens/BillDetails';
import CreateBudget from './src/screens/CreateBudget';
import BudgetDetails from './src/screens/BudgetDetails';
import MoveBudgetAmount from './src/screens/MoveBudgetAmount';
import SearchScreen from './src/screens/SearchScreen';
import CategoryNormalizations from './src/screens/CategoryNormalizations';
import { loadNormalizations } from './src/constants/CategoryTaxonomy';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
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
    const [hasBudgetAlert, setHasBudgetAlert] = React.useState(false);

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                // Get current month/year
                const now = new Date();
                const month = now.getMonth() + 1;
                const year = now.getFullYear();

                const response = await api.get(`/budgets/summary?month=${month}&year=${year}`);
                const budgets = response.data || [];

                // Check if any budget is strictly over limit
                const hasOverspending = budgets.some(b => b.spent > (b.limit || b.amount || 0));
                setHasBudgetAlert(hasOverspending);
            } catch (e) {
                // silently fail
            }
        };

        checkStatus();
        checkStatus();
        // Removed polling to prevent excessive API calls
        // const interval = setInterval(checkStatus, 60000); 
        // return () => clearInterval(interval);
    }, []);

    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: '#2DD4BF',
                tabBarInactiveTintColor: '#94A3B8',
                tabBarStyle: {
                    backgroundColor: '#0F172A',
                    borderTopWidth: 1,
                    borderTopColor: '#1E293B',
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 6,
                    shadowColor: '#000',
                    shadowOpacity: 0.3,
                    shadowOffset: { width: 0, height: -4 },
                    shadowRadius: 12,
                    elevation: 10,
                    position: 'absolute',
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
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
                name="Insights"
                component={Insights}
                options={{
                    tabBarIcon: ({ color, size }) => <PieChart size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Budget"
                component={Budget}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <View>
                            <BarChart3 size={size} color={color} />
                            {hasBudgetAlert && (
                                <View style={{
                                    position: 'absolute',
                                    right: -2,
                                    top: -2,
                                    backgroundColor: '#EF4444',
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    borderWidth: 1,
                                    borderColor: '#FFF'
                                }} />
                            )}
                        </View>
                    ),
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

export default function App() {
    // Load category normalizations on app start
    React.useEffect(() => {
        loadNormalizations(api);
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <NavigationContainer>
                    <RootStack.Navigator screenOptions={{ headerShown: false }}>
                        <RootStack.Screen name="MainTabs" component={MainTabs} />
                        <RootStack.Screen name="CreateBudget" component={CreateBudget} />
                        <RootStack.Screen name="BudgetDetails" component={BudgetDetails} />
                        <RootStack.Screen name="MoveBudgetAmount" component={MoveBudgetAmount} />
                        <RootStack.Screen name="MerchantRules" component={MerchantRules} />
                        <RootStack.Screen name="Transactions" component={Transactions} />
                        <RootStack.Screen name="BillDetails" component={BillDetails} />
                        <RootStack.Screen
                            name="EditTransaction"
                            component={EditTransaction}
                            options={{ presentation: 'modal' }}
                        />
                        <RootStack.Screen name="TransactionDetails" component={TransactionDetails} />
                        <RootStack.Screen name="CashFlow" component={CashFlow} />
                        <RootStack.Screen name="AccountTransactions" component={AccountTransactions} />
                        <RootStack.Screen name="SearchScreen" component={SearchScreen} />
                        <RootStack.Screen name="CategoryNormalizations" component={CategoryNormalizations} />
                    </RootStack.Navigator>
                </NavigationContainer>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
