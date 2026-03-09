import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    Alert,
    Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/theme-context';
import { useAuth } from '@/hooks/auth-context';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { requestNotificationPermission, scheduleDailyReminder, cancelDailyReminder, scheduleDueNotifications } from '@/hooks/use-notifications';
import { useTodos } from '@/hooks/todo-context';

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingsSection({
    title,
    children,
    theme,
}: {
    title: string;
    children: React.ReactNode;
    theme: typeof Colors.dark;
}) {
    return (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                {title.toUpperCase()}
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                {children}
            </View>
        </View>
    );
}

function SettingToggle({
    icon,
    iconColor,
    label,
    description,
    value,
    onToggle,
    theme,
    isLast = false,
}: {
    icon: string;
    iconColor: string;
    label: string;
    description?: string;
    value: boolean;
    onToggle: (val: boolean) => void;
    theme: typeof Colors.dark;
    isLast?: boolean;
}) {
    return (
        <View style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}>
            <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
                <MaterialIcons name={icon as any} size={20} color={iconColor} />
            </View>
            <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
                {description && (
                    <Text style={[styles.rowDesc, { color: theme.textSecondary }]}>{description}</Text>
                )}
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: theme.surfaceElevated, true: theme.accent + '60' }}
                thumbColor={value ? theme.accent : theme.textSecondary}
            />
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const NOTIF_DAILY_KEY = 'screeno_notif_daily';
const NOTIF_DUE_KEY = 'screeno_notif_due';

export default function SettingsScreen() {
    const colorScheme = useColorScheme();
    const { setTheme } = useTheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user, signOut } = useAuth();
    const { todos } = useTodos();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [dailyReminder, setDailyReminder] = useState(false);
    const [dueAlerts, setDueAlerts] = useState(false);

    // Load persisted notification preferences
    useEffect(() => {
        AsyncStorage.multiGet([NOTIF_DAILY_KEY, NOTIF_DUE_KEY]).then((pairs) => {
            setDailyReminder(pairs[0][1] === 'true');
            setDueAlerts(pairs[1][1] === 'true');
        });
    }, []);

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    // ── Derived user info ──────────────────────────────────────────────────────
    const email = user?.email ?? 'Not signed in';
    const displayName = email.split('@')[0];
    const avatarLetter = displayName[0]?.toUpperCase() ?? '?';

    const isDark = colorScheme === 'dark';

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleDarkModeToggle = (val: boolean) => {
        setTheme(val ? 'dark' : 'light');
    };

    const handleDailyReminderToggle = async (val: boolean) => {
        if (val) {
            const granted = await requestNotificationPermission();
            if (!granted) {
                Alert.alert('Permission Required', 'Please enable notifications in your device settings to use reminders.');
                return;
            }
            await scheduleDailyReminder(9, 0);
        } else {
            await cancelDailyReminder();
        }
        setDailyReminder(val);
        await AsyncStorage.setItem(NOTIF_DAILY_KEY, String(val));
    };

    const handleDueAlertsToggle = async (val: boolean) => {
        if (val) {
            const granted = await requestNotificationPermission();
            if (!granted) {
                Alert.alert('Permission Required', 'Please enable notifications in your device settings to use reminders.');
                return;
            }
            await scheduleDueNotifications(todos);
        }
        setDueAlerts(val);
        await AsyncStorage.setItem(NOTIF_DUE_KEY, String(val));
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: () => signOut(),
                },
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={{ opacity: fadeAnim }}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
                    </View>

                    {/* Profile Card */}
                    <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                            <Text style={styles.avatarText}>{avatarLetter}</Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: theme.text }]}>{displayName}</Text>
                            <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{email}</Text>
                        </View>
                    </View>

                    {/* Appearance */}
                    <SettingsSection title="Appearance" theme={theme}>
                        <SettingToggle
                            icon="dark-mode"
                            iconColor="#A78BFA"
                            label="Dark Mode"
                            description="Switch between light and dark theme"
                            value={isDark}
                            onToggle={handleDarkModeToggle}
                            theme={theme}
                            isLast
                        />
                    </SettingsSection>

                    {/* Notifications */}
                    <SettingsSection title="Notifications" theme={theme}>
                        <SettingToggle
                            icon="notifications"
                            iconColor="#F59E0B"
                            label="Daily Reminder"
                            description="Remind me to check my todos at 9:00 AM"
                            value={dailyReminder}
                            onToggle={handleDailyReminderToggle}
                            theme={theme}
                        />
                        <SettingToggle
                            icon="alarm"
                            iconColor="#EF4444"
                            label="Due-Date Alerts"
                            description="Notify me when a task deadline is near"
                            value={dueAlerts}
                            onToggle={handleDueAlertsToggle}
                            theme={theme}
                            isLast
                        />
                    </SettingsSection>

                    <SettingsSection title="Account" theme={theme}>
                        <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}>
                            <View style={[styles.iconWrap, { backgroundColor: theme.accent + '18' }]}>
                                <MaterialIcons name="alternate-email" size={20} color={theme.accent} />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={[styles.rowLabel, { color: theme.text }]}>Email</Text>
                                <Text style={[styles.rowDesc, { color: theme.textSecondary }]}>{email}</Text>
                            </View>
                        </View>
                        <View style={[styles.row]}>
                            <View style={[styles.iconWrap, { backgroundColor: '#10B98118' }]}>
                                <MaterialIcons name="verified-user" size={20} color="#10B981" />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={[styles.rowLabel, { color: theme.text }]}>Account Status</Text>
                                <Text style={[styles.rowDesc, { color: '#10B981' }]}>Active</Text>
                            </View>
                        </View>
                    </SettingsSection>

                    {/* App Info */}
                    <SettingsSection title="App" theme={theme}>
                        <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}>
                            <View style={[styles.iconWrap, { backgroundColor: theme.accent + '18' }]}>
                                <MaterialIcons name="info-outline" size={20} color={theme.accent} />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={[styles.rowLabel, { color: theme.text }]}>Version</Text>
                            </View>
                            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>1.0.0</Text>
                        </View>
                        <View style={styles.row}>
                            <View style={[styles.iconWrap, { backgroundColor: '#F59E0B18' }]}>
                                <MaterialIcons name="bolt" size={20} color="#F59E0B" />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={[styles.rowLabel, { color: theme.text }]}>Powered by</Text>
                                <Text style={[styles.rowDesc, { color: theme.textSecondary }]}>Supabase · Expo · React Native</Text>
                            </View>
                        </View>
                    </SettingsSection>

                    {/* Sign Out */}
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={[styles.signOutBtn, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}
                            activeOpacity={0.7}
                            onPress={handleSignOut}
                        >
                            <MaterialIcons name="logout" size={20} color="#EF4444" />
                            <Text style={[styles.signOutText, { color: '#EF4444' }]}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                            Todogram v1.0.0
                        </Text>
                        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                            Made with ❤️ for focused productivity
                        </Text>
                    </View>

                    <View style={{ height: Spacing.xl }} />
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

    header: { marginBottom: Spacing.lg },
    headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },

    // Profile
    profileCard: {
        flexDirection: 'row', alignItems: 'center',
        padding: Spacing.md + 4, borderRadius: BorderRadius.xl,
        borderWidth: 1, marginBottom: Spacing.lg,
    },
    avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
    profileInfo: { flex: 1, marginLeft: Spacing.md },
    profileName: { fontSize: 17, fontWeight: '700' },
    profileEmail: { fontSize: 13, fontWeight: '500', marginTop: 2 },

    // Section
    section: { marginBottom: Spacing.lg },
    sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: Spacing.sm, paddingLeft: 4 },
    sectionCard: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },

    // Row
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
    iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
    rowContent: { flex: 1 },
    rowLabel: { fontSize: 15, fontWeight: '600' },
    rowDesc: { fontSize: 12, fontWeight: '400', marginTop: 2 },
    rowValue: { fontSize: 14, fontWeight: '500' },

    // Sign Out
    signOutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: Spacing.md, borderRadius: BorderRadius.lg,
        borderWidth: 1, gap: 8,
    },
    signOutText: { fontSize: 16, fontWeight: '700' },

    // Footer
    footer: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 4 },
    footerText: { fontSize: 13, fontWeight: '500' },
});
