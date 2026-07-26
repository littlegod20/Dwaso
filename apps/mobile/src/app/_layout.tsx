import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PaperDarkTheme, PaperLightTheme } from '@/constants/paper-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <PaperProvider theme={isDark ? PaperDarkTheme : PaperLightTheme}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen
            name="scan"
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="product/[id]" />
          <Stack.Screen name="add-stock" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-price" options={{ presentation: 'modal' }} />
          <Stack.Screen name="creditor/[id]" />
          <Stack.Screen name="add-creditor" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reminder-schedule" options={{ presentation: 'modal' }} />
          <Stack.Screen name="suppliers" />
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
}
