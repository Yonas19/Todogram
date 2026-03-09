import { useTheme } from './theme-context';

/**
 * Returns the current color scheme ('light' | 'dark').
 * Reads from our ThemeContext so the Settings toggle works.
 */
export function useColorScheme(): 'light' | 'dark' {
    const { colorScheme } = useTheme();
    return colorScheme;
}
