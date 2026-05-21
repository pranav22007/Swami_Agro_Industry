import { Stack } from 'expo-router';

export default function UserLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="billing/index" options={{ headerShown: false }} />
      <Stack.Screen name="business-setup" options={{ headerShown: false }} />
      <Stack.Screen name="items/index" options={{ headerShown: false }} />
    </Stack>
  );
}
