import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import api from '../config/api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const NotificationService = {
    registerForPushNotificationsAsync: async () => {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return;
            }
        }
    },

    // Check budgets and trigger alerts
    checkBudgetAlerts: async (budgets) => {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`; // Context for deduping

        for (const budget of budgets) {
            if (!budget.is_active) continue;

            const spent = budget.spent || 0;
            const limit = budget.amount || 0; // standard amount
            // Adjust limit for rollover if needed? Usually alerts are based on "Available" for the month.
            // Let's use logic from Details: totalAvailable = limit + rollover.
            const rollover = budget.rollover_amount || 0;
            const totalAvailable = limit + rollover;
            const effectiveLimit = totalAvailable > 0 ? totalAvailable : limit;

            if (effectiveLimit <= 0) continue;

            const percent = (spent / effectiveLimit) * 100;
            const alertThreshold = budget.alert_percent || 70; // User defined or default 70%

            // Defines keys
            const warningKey = `alert_${budget.id}_${monthKey}_warning`;
            const dangerKey = `alert_${budget.id}_${monthKey}_danger`;

            // Check Danger (Over Budget)
            if (spent >= effectiveLimit) {
                const alreadySent = await AsyncStorage.getItem(dangerKey);
                if (!alreadySent) {
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "🚨 Over Budget Alert",
                            body: `You've exceeded your budget for ${budget.name} ($${spent.toFixed(0)} of $${effectiveLimit.toFixed(0)})`,
                            data: { budgetId: budget.id },
                        },
                        trigger: null, // Send immediately
                    });

                    // Persist to backend
                    try {
                        await api.post('/notifications', {
                            title: "🚨 Over Budget Alert",
                            body: `You've exceeded your budget for ${budget.name} ($${spent.toFixed(0)} of $${effectiveLimit.toFixed(0)})`,
                            type: 'danger',
                            data: { budgetId: budget.id }
                        });
                    } catch (e) { console.error('Error saving notification:', e); }

                    await AsyncStorage.setItem(dangerKey, 'true');
                    // Also mark warning as sent so we don't downgrade
                    await AsyncStorage.setItem(warningKey, 'true');
                }
            }
            // Check Warning (Approaching Limit)
            else if (percent >= alertThreshold) {
                const alreadySent = await AsyncStorage.getItem(warningKey);
                if (!alreadySent) {
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "⚠️ Spending Alert",
                            body: `You've reached ${percent.toFixed(0)}% of your budget for ${budget.name} ($${spent.toFixed(0)} of $${effectiveLimit.toFixed(0)})`,
                            data: { budgetId: budget.id },
                        },
                        trigger: null,
                    });

                    // Persist to backend
                    try {
                        await api.post('/notifications', {
                            title: "⚠️ Spending Alert",
                            body: `You've reached ${percent.toFixed(0)}% of your budget for ${budget.name} ($${spent.toFixed(0)} of $${effectiveLimit.toFixed(0)})`,
                            type: 'warning',
                            data: { budgetId: budget.id }
                        });
                    } catch (e) { console.error('Error saving notification:', e); }

                    await AsyncStorage.setItem(warningKey, 'true');
                }
            }
        }
    },

    // Optional: Reset alerts when limits change? 
    // Usually handled by key rotation (MonthKey), or manually clearing keys.
    // For MVP, if user increases budget, they might want a new alert?
    // We could add a 'lastAlertedLimit' to the value to detect limit bumps, but simple boolean is fine for now.
    clearAllAlerts: async () => {
        // Could assume keys start with alert_
        const keys = await AsyncStorage.getAllKeys();
        const alertKeys = keys.filter(k => k.startsWith('alert_'));
        await AsyncStorage.multiRemove(alertKeys);
    },

    // Check upcoming bills and trigger reminders
    checkBillReminders: async (upcomingBills) => {
        let allBills = [];
        if (Array.isArray(upcomingBills)) {
            if (upcomingBills.length > 0 && upcomingBills[0].bills) {
                allBills = upcomingBills.flatMap(g => g.bills);
            } else {
                allBills = upcomingBills;
            }
        }

        const now = new Date();

        // Fetch all currently scheduled notifications to prevent duplicates
        const scheduledList = await Notifications.getAllScheduledNotificationsAsync();
        const scheduledIds = new Set(scheduledList.map(n => n.content.data?.uniqueId));

        for (const bill of allBills) {
            if (!bill.reminder || bill.reminder === 'No reminder') continue;

            let remindDays = 0;
            if (bill.reminder !== 'Remind same day') {
                const match = bill.reminder.match(/Remind (\d+) days? before/);
                if (match && match[1]) {
                    remindDays = parseInt(match[1]);
                }
            }

            // Calculate exact Trigger Date
            // Bill Due Date is YYYY-MM-DD
            // We assume Due Date is Noon local time to avoid timezone issues
            const dueDateObj = new Date(bill.dueDate + 'T12:00:00');
            const triggerDate = new Date(dueDateObj);
            triggerDate.setDate(triggerDate.getDate() - remindDays);

            // Set trigger time to 9:00 AM local time? Or keep 12:00 PM?
            // Let's set it to 9:00 AM for better utility
            triggerDate.setHours(9, 0, 0, 0);

            // If trigger date is in the past, skip (unless it's today and we haven't alerted yet?)
            // If it's today (past 9am) but still same day, we might want to alert immediately?
            // Logic: If triggerDate < now, don't schedule standard future notification.
            // Check for "Missed" reminder if user just opened app?
            // For "Background" request: we primarily care about FUTURE.

            if (triggerDate <= now) {
                // Determine if we should show an "immediate" alert because we missed the schedule
                // Only if it's actually STILL relevant (e.g. today is the reminder day)
                const isSameDay = triggerDate.toDateString() === now.toDateString();
                if (!isSameDay) continue;
                // If it IS today, we fall through to schedule it (which might fire immediately or fail? Expo handles past triggers by firing immediately usually)
            }

            const uniqueId = `bill_${bill.billId}_${bill.dueDate}_${remindDays}`;

            if (scheduledIds.has(uniqueId)) {
                continue; // Already scheduled
            }

            let title = "📅 Bill Reminder";
            let body = `Upcoming: ${bill.description || bill.category} ($${bill.amount.toFixed(2)}) is due`;

            if (remindDays === 0) {
                body += " today!";
                title = "🚨 Bill Due Today";
            } else if (remindDays === 1) {
                body += " tomorrow.";
            } else {
                body += ` in ${remindDays} days.`;
            }

            // Schedule it
            // Note: Trigger must be in future for 'date' trigger. 
            // If we are "today" and time passed, we use 'seconds: 1' to fire essentially now.
            let triggerInput = { date: triggerDate };
            if (triggerDate <= now) {
                triggerInput = null; // Immediate
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: { billId: bill.billId, dueDate: bill.dueDate, uniqueId },
                },
                trigger: triggerInput,
            });

            // Persist to backend
            try {
                await api.post('/notifications', {
                    title,
                    body,
                    type: remindDays === 0 ? 'danger' : 'info',
                    data: { billId: bill.billId, dueDate: bill.dueDate, uniqueId }
                });
            } catch (e) { console.error('Error saving notification:', e); }

            // We don't strictly need AsyncStorage anymore because we check getAllScheduledNotificationsAsync
            // But checking that is async and might be slow if many. 
            // For now, relying on Expo's list is cleaner than manual DB management.
        }
    }
};
