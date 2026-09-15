import { Stack } from 'expo-router';

export default function ReportLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="kashpal/index" />
      <Stack.Screen name="kashrag/index" />
    </Stack>
  );
}
