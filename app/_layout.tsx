import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

import { ThemeProvider } from '@/hooks/theme-context';
import { TodoProvider } from '@/hooks/todo-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/hooks/auth-context';

// ── Route guard ───────────────────────────────────────────────────────────────

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Don't do anything while auth state is still being resolved
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      // Not authenticated — send to login screen
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      // Already authenticated — send to app tabs
      router.replace('/(tabs)');
    }
    // All other cases (session + in tabs, no session + in auth) are correct — do nothing
  }, [session, isLoading, segments]);
  // ↑ segments is included so the guard re-runs if the user navigates
  //   while the session check is still in-flight (prevents race conditions)

  // Block rendering until auth is resolved to prevent flash of wrong screen
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a1a' }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true, title: 'Modal' }} />
        <Stack.Screen
          name="story-viewer"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="room-session"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TodoProvider>
          <RootLayoutInner />
        </TodoProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
