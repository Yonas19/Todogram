import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Dimensions,
    Easing,
    ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

const { width, height } = Dimensions.get('window');

// Required for web browser auth session
WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri();

export default function AuthScreen() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    // Floating background blobs
    const blob1Y = useRef(new Animated.Value(0)).current;
    const blob2Y = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Entrance animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();

        // Infinite floating animation
        const floatAnim = (anim: Animated.Value, distance: number, duration: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: distance,
                        duration,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        };

        floatAnim(blob1Y, -30, 4000);
        floatAnim(blob2Y, 40, 5000);
    }, []);

    async function signInWithEmail() {
        if (!email || !password) {
            Alert.alert('Missing fields', 'Please fill in email and password.');
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) Alert.alert('Sign In Failed', error.message);
        // On success, onAuthStateChange in auth-context fires → _layout redirects to tabs
    }

    async function signUpWithEmail() {
        if (!email || !password) {
            Alert.alert('Missing fields', 'Please enter your email and password.');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Weak password', 'Password must be at least 6 characters.');
            return;
        }
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({ email, password });
        setLoading(false);

        if (error) {
            Alert.alert('Sign Up Failed', error.message);
            return;
        }

        // Supabase email confirmation is enabled — user must verify their email
        if (data.session === null) {
            Alert.alert(
                '✅ Check your email',
                `We sent a confirmation link to ${email}. Click it to activate your account, then sign in.`,
                [{ text: 'OK', onPress: () => setIsSignUp(false) }]
            );
        }
        // If email confirmation is disabled in Supabase Dashboard,
        // onAuthStateChange will fire automatically and route to tabs
    }

    async function signInWithOAuth(provider: 'google' | 'apple') {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                },
            });

            if (error) {
                Alert.alert('Sign In Failed', error.message);
                setLoading(false);
                return;
            }

            if (data?.url) {
                const res = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectTo
                );

                if (res.type === 'success') {
                    const { url } = res;
                    // Extract the tokens from the URL
                    const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1] || '');
                    const access_token = params.get('access_token');
                    const refresh_token = params.get('refresh_token');

                    if (access_token && refresh_token) {
                        await supabase.auth.setSession({
                            access_token,
                            refresh_token,
                        });
                    }
                }
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Something went wrong');
        }
        setLoading(false);
    }

    const toggleMode = () => {
        Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setIsSignUp(!isSignUp);
            Animated.timing(rotateAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        });
    };

    const formOpacity = rotateAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 0, 1],
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Decorative Background Blobs */}
            <Animated.View
                style={[
                    styles.blob1,
                    { transform: [{ translateY: blob1Y }] },
                    { backgroundColor: theme.accent + '20' },
                ]}
            />
            <Animated.View
                style={[
                    styles.blob2,
                    { transform: [{ translateY: blob2Y }] },
                    { backgroundColor: theme.tint + '15' },
                ]}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <Animated.View
                    style={[
                        styles.formContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={[theme.accent, theme.tint]}
                            style={styles.logoGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.logoIcon}>✨</Text>
                        </LinearGradient>
                        <Text style={[styles.title, { color: theme.text }]}>
                            {isSignUp ? 'Join Todogram' : 'Welcome Back'}
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                            {isSignUp
                                ? 'Create an account to track your focus'
                                : 'Sign in to continue tracking your progress'}
                        </Text>
                        {supabase.auth instanceof Object && (supabase as any).supabaseKey?.startsWith('sb_publishable_') && (
                            <View style={{ backgroundColor: theme.danger + '20', padding: 12, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: theme.danger }}>
                                <Text style={{ color: theme.danger, fontWeight: '700', textAlign: 'center', fontSize: 13 }}>
                                    ⚠️ Invalid Supabase Key detected in lib/supabase.ts
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Form */}
                    <Animated.View style={[styles.form, { opacity: formOpacity }]}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: theme.surfaceElevated,
                                        color: theme.text,
                                        borderColor: theme.cardBorder,
                                    },
                                ]}
                                onChangeText={setEmail}
                                value={email}
                                placeholder="email@address.com"
                                placeholderTextColor={theme.textSecondary + '70'}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: theme.surfaceElevated,
                                        color: theme.text,
                                        borderColor: theme.cardBorder,
                                    },
                                ]}
                                onChangeText={setPassword}
                                value={password}
                                secureTextEntry={true}
                                placeholder="Password"
                                placeholderTextColor={theme.textSecondary + '70'}
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Main Button */}
                        <TouchableOpacity
                            style={styles.mainButton}
                            onPress={isSignUp ? signUpWithEmail : signInWithEmail}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#8B5CF6', '#3B82F6']}
                                style={styles.gradientButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>
                                        {isSignUp ? 'Create Account' : 'Sign In'}
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                            <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
                            <Text style={[styles.dividerText, { color: theme.textSecondary }]}>or continue with</Text>
                            <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
                        </View>

                        {/* Social Buttons */}
                        <View style={styles.socialContainer}>
                            <TouchableOpacity
                                style={[styles.socialButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.cardBorder }]}
                                onPress={() => signInWithOAuth('google')}
                                disabled={loading}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.socialIcon, { color: '#4285F4' }]}>G</Text>
                                <Text style={[styles.socialText, { color: theme.text }]}>Google</Text>
                            </TouchableOpacity>

                            {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                    style={[styles.socialButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.cardBorder }]}
                                    onPress={() => signInWithOAuth('apple')}
                                    disabled={loading}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.socialIcon, { color: theme.text }]}>🍎</Text>
                                    <Text style={[styles.socialText, { color: theme.text }]}>Apple</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Toggle */}
                        <View style={styles.toggleContainer}>
                            <Text style={[styles.toggleText, { color: theme.textSecondary }]}>
                                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                            </Text>
                            <TouchableOpacity onPress={toggleMode} disabled={loading}>
                                <Text style={[styles.toggleAction, { color: theme.accent }]}>
                                    {isSignUp ? 'Sign In' : 'Sign Up'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Animated.View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    blob1: {
        position: 'absolute',
        top: -height * 0.1,
        right: -width * 0.2,
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width * 0.6,
        opacity: 0.8,
    },
    blob2: {
        position: 'absolute',
        bottom: -height * 0.1,
        left: -width * 0.3,
        width: width * 1.4,
        height: width * 1.4,
        borderRadius: width * 0.7,
        opacity: 0.6,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    formContainer: {
        padding: Spacing.xl,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    logoGradient: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    logoIcon: {
        fontSize: 28,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: Spacing.xs,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    form: {
        gap: Spacing.lg,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 4,
    },
    input: {
        height: 56,
        borderWidth: 1,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: 16,
        fontSize: 16,
        fontWeight: '500',
    },
    mainButton: {
        height: 56,
        marginTop: Spacing.sm,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    gradientButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.xs,
    },
    divider: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: 12,
        fontSize: 12,
        fontWeight: '600',
    },
    socialContainer: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    socialButton: {
        flex: 1,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: BorderRadius.lg,
        gap: 8,
    },
    socialIcon: {
        fontSize: 18,
        fontWeight: '800',
    },
    socialText: {
        fontSize: 14,
        fontWeight: '600',
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: Spacing.md,
    },
    toggleText: {
        fontSize: 14,
    },
    toggleAction: {
        fontSize: 14,
        fontWeight: '700',
    },
});
