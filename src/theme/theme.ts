import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#F1F5F9', // Cool, slightly technical light gray
    surface: '#FFFFFF', // Crisp white for elevated cards
    surfaceLight: '#F8FAFC', // Slightly darker surface for nested elements
    primary: '#0F172A', // Midnight Slate (Brand/Tactical feel)
    primaryHover: '#1E293B', // Lighter Slate
    accent: '#3B82F6', // Vibrant Blue for primary actions
    success: '#10B981', // Emerald Green
    warning: '#F59E0B', // Amber
    danger: '#EF4444', // Crisp Red
    text: '#1E293B', // Very dark slate for high readability
    textMuted: '#64748B', // Soft slate for secondary info (darker than dark mode)
    border: '#E2E8F0', // Light border
    overlay: 'rgba(15, 23, 42, 0.4)', // Dark slate overlay
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  elevation: {
    sm: Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 2 },
      web: { boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.05)' }
    }),
    md: Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)' }
    }),
    lg: Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15 },
      android: { elevation: 8 },
      web: { boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.05)' }
    }),
  }
};

