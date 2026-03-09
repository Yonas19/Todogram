import { useTheme } from './theme-context';

/**
 * Web version — imports directly from theme-context to avoid circular
 * imports (Metro resolves './use-color-scheme' back to this .web.ts file).
 */
export function useColorScheme(): 'light' | 'dark' {
    const { colorScheme } = useTheme();
    return colorScheme;
}
