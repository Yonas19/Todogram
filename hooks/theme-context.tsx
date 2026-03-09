import React, { createContext, useContext, useState, useCallback } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    colorScheme: ThemeMode;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
    isSystemDefault: boolean;
    useSystemTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useSystemColorScheme();
    const [override, setOverride] = useState<ThemeMode | null>(null);

    const colorScheme: ThemeMode = override ?? (systemScheme === 'dark' ? 'dark' : 'light');

    const toggleTheme = useCallback(() => {
        setOverride((prev) => {
            const current = prev ?? (systemScheme === 'dark' ? 'dark' : 'light');
            return current === 'dark' ? 'light' : 'dark';
        });
    }, [systemScheme]);

    const setTheme = useCallback((mode: ThemeMode) => {
        setOverride(mode);
    }, []);

    const useSystemTheme = useCallback(() => {
        setOverride(null);
    }, []);

    return (
        <ThemeContext.Provider
            value={{
                colorScheme,
                toggleTheme,
                setTheme,
                isSystemDefault: override === null,
                useSystemTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
