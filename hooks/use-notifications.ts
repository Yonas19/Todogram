import { useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TodoItem } from './todo-context';

// ── Configure how notifications appear when app is foregrounded ────────────────
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

// ── Constants ─────────────────────────────────────────────────────────────────
const DAILY_REMINDER_ID = 'screeno-daily-reminder';
const DUE_NOTIF_PREFIX = 'screeno-due-';

// ── Permission request ────────────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Screeno Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8B5CF6',
        });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

// ── Schedule a daily reminder ──────────────────────────────────────────────────
export async function scheduleDailyReminder(hour = 9, minute = 0): Promise<void> {
    // Cancel existing daily reminder first to avoid duplicates
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => { });

    await Notifications.scheduleNotificationAsync({
        identifier: DAILY_REMINDER_ID,
        content: {
            title: '📋 Time to check your todos!',
            body: "Don't forget to review your tasks for today. Let's stay on track 💪",
            sound: true,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
        },
    });
}

// ── Cancel daily reminder ─────────────────────────────────────────────────────
export async function cancelDailyReminder(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => { });
}

// ── Schedule due-date notifications for todos ─────────────────────────────────
export async function scheduleDueNotifications(todos: TodoItem[]): Promise<void> {
    // Cancel all existing due notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
        if (n.identifier.startsWith(DUE_NOTIF_PREFIX)) {
            await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
    }

    const now = new Date();

    for (const todo of todos) {
        if (!todo.dueDate || todo.completed) continue;

        const dueDate = new Date(todo.dueDate);
        const oneDayBefore = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);

        // Notify 1 day before if in the future
        if (oneDayBefore > now) {
            await Notifications.scheduleNotificationAsync({
                identifier: `${DUE_NOTIF_PREFIX}${todo.id}-1d`,
                content: {
                    title: '⏰ Task due tomorrow!',
                    body: `"${todo.title}" is due tomorrow. Get it done!`,
                    sound: true,
                    data: { todoId: todo.id },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: oneDayBefore,
                },
            });
        }

        // Notify at due time if still in the future
        if (dueDate > now) {
            await Notifications.scheduleNotificationAsync({
                identifier: `${DUE_NOTIF_PREFIX}${todo.id}-due`,
                content: {
                    title: '🔴 Task is due now!',
                    body: `"${todo.title}" is due right now!`,
                    sound: true,
                    data: { todoId: todo.id },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: dueDate,
                },
            });
        }
    }
}

// ── React hook ────────────────────────────────────────────────────────────────

interface UseNotificationsOptions {
    todos: TodoItem[];
    enabled: boolean;         // master toggle from settings
    dailyEnabled: boolean;    // daily reminder toggle
    dailyHour?: number;       // default 9am
    dailyMinute?: number;
}

export function useNotifications({
    todos,
    enabled,
    dailyEnabled,
    dailyHour = 9,
    dailyMinute = 0,
}: UseNotificationsOptions) {
    const permGranted = useRef(false);

    // Request permission once on mount if enabled
    useEffect(() => {
        if (!enabled) return;
        requestNotificationPermission().then((granted) => {
            permGranted.current = granted;
        });
    }, [enabled]);

    // Re-schedule due notifications whenever todos change
    useEffect(() => {
        if (!enabled || !permGranted.current) return;
        scheduleDueNotifications(todos);
    }, [todos, enabled]);

    // Toggle daily reminder
    useEffect(() => {
        if (!enabled) {
            cancelDailyReminder();
            return;
        }
        if (dailyEnabled) {
            requestNotificationPermission().then((granted) => {
                if (granted) scheduleDailyReminder(dailyHour, dailyMinute);
            });
        } else {
            cancelDailyReminder();
        }
    }, [enabled, dailyEnabled, dailyHour, dailyMinute]);

    const scheduleNow = useCallback(() => {
        if (enabled && permGranted.current) scheduleDueNotifications(todos);
    }, [enabled, todos]);

    return { scheduleNow };
}
