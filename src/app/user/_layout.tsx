import { Stack } from 'expo-router';

export default function UserLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="platoon" 
        options={{ 
          title: 'אזור קשפ"ל',
          headerTitleAlign: 'center',
          headerBackVisible: false,
        }} 
      />
    </Stack>
  );
}
