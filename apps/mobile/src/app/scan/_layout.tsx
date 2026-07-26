import { Stack } from 'expo-router';

export default function ScanLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="recognized" />
      <Stack.Screen name="confirm" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}
