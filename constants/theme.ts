import { Platform } from 'react-native';

// Modern premium color palette
const tintColorLight = '#6C63FF';
const tintColorDark = '#7B73FF';

export const Colors = {
  light: {
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    background: '#F8F9FE',
    surface: '#FFFFFF',
    surfaceElevated: '#F0F1F8',
    tint: tintColorLight,
    icon: '#6B7280',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    accent: '#6C63FF',
    accentLight: '#E8E6FF',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    cardBorder: '#E5E7EB',
    gradient1: '#6C63FF',
    gradient2: '#A78BFA',
  },
  dark: {
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    background: '#0F0F1A',
    surface: '#1A1A2E',
    surfaceElevated: '#232340',
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
    accent: '#7B73FF',
    accentLight: '#2D2B55',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    cardBorder: '#2D2B55',
    gradient1: '#7B73FF',
    gradient2: '#A78BFA',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
