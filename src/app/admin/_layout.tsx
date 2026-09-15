import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerTitleAlign: 'center', headerBackTitle: 'חזור' }}>
      <Stack.Screen name="dashboard" options={{ title: 'לוח בקרה - מנהל' }} />
    </Stack>
  );
}
