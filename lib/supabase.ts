import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = 'https://nnimfruuvkgyzlayfoxe.supabase.co';
const supabaseAnonKey = 'sb_publishable_HF3eWEBMI-57u345bqhEtw_uImAB2_X';

// ── Storage adapters ──────────────────────────────────────────────────────────

/**
 * SecureStore keys must be ≤248 chars and alphanumeric + . - _
 * Supabase sometimes uses longer keys, so we hash/encode them.
 */
function toSecureKey(key: string): string {
    // Replace characters not allowed by SecureStore
    return key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 248);
}

const secureStoreAdapter = {
    getItem: (key: string): Promise<string | null> => {
        return SecureStore.getItemAsync(toSecureKey(key));
    },
    setItem: (key: string, value: string): Promise<void> => {
        return SecureStore.setItemAsync(toSecureKey(key), value);
    },
    removeItem: (key: string): Promise<void> => {
        return SecureStore.deleteItemAsync(toSecureKey(key));
    },
};

const webStorageAdapter = {
    getItem: (key: string): string | null => {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(key);
    },
    setItem: (key: string, value: string): void => {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    },
    removeItem: (key: string): void => {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    },
};

const storage = Platform.OS === 'web' ? webStorageAdapter : secureStoreAdapter;

// ── Supabase client ───────────────────────────────────────────────────────────

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: storage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
    },
});

// Pause / resume auto-refresh based on app foreground state (native only)
if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}
