import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="value-2" />
      <Stack.Screen name="value-3" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="verify" />
      {/* Reached only after the phone number is verified, and guarded by the
          auth gate rather than by navigation, so it cannot be deep-linked into
          by someone without a session. */}
      <Stack.Screen name="business-setup" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
