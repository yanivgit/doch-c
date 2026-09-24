import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { I18nManager, View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useFonts, Heebo_400Regular, Heebo_500Medium, Heebo_700Bold, Heebo_800ExtraBold } from '@expo-google-fonts/heebo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../context/AppContext';
import { theme } from '../theme/theme';

import '../global.css';

// Force RTL support for Hebrew
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

function InitialLayout() {
  const { userRole, selectedDohId, isLoading } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;


    
    // For now we assume root '/' is role selection and '/cycle-selection' is cycle selection.
    // The main report view will be under '/report'
    
    if (!userRole) {
      // No role selected -> go to Role Selection (index.tsx)
      if ((segments[0] as any) !== 'index' && (segments[0] as any) !== '') {
        router.replace('/');
      }
    } else if (!selectedDohId) {
      // Role selected but no Doh selected -> go to Cycle Selection
      if (segments[0] !== 'cycle-selection') {
        router.replace('/cycle-selection');
      }
    } else {
      // Role and Doh selected -> go to report view based on role
      // Allow navigation to 'settings' as well
      // Do NOT auto-redirect if we are in 'cycle-selection', let cycle-selection handle its own explicit navigation
      if (segments[0] !== 'report' && segments[0] !== 'cycle-selection') {
        const rolePath = userRole.toLowerCase();
        router.replace(`/report/${rolePath}` as any);
      }
    }
  }, [userRole, selectedDohId, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const VibrantLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.danger,
  },
};

import { Feather } from '@expo/vector-icons';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
    Heebo_800ExtraBold,
    ...Feather.font,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={VibrantLightTheme}>
          <AppProvider>
            <InitialLayout />
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
