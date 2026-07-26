import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="value-2" />
      <Stack.Screen name="value-3" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="business-setup" />
    </Stack>
  );
}
