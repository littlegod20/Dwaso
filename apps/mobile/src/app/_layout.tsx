import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PaperDarkTheme, PaperLightTheme } from '@/constants/paper-theme';
import {
  addNotificationResponseListener,
  registerForPushNotifications,
} from '@/lib/notifications';
import { SyncProvider } from '@/lib/sync/provider';
import { useSessionStore } from '@/stores/session';

SplashScreen.preventAutoHideAsync();

/**
 * Reads never touch the network — they run against local SQLite, and the sync
 * engine invalidates them when it writes. So the usual staleness machinery is
 * turned off: there is nothing to go stale, and refetching on every window focus
 * would just re-run SQL for identical results.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  },
});

/**
 * Routes by session state.
 *
 * Three states, three destinations: signed out goes to the welcome flow, verified
 * but without a shop goes to business setup, and everything else goes to the app.
 * Doing this in one place means no individual screen has to defend itself against
 * being rendered without a shop.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useSessionStore((state) => state.status);
  const hydrate = useSessionStore((state) => state.hydrate);
  const [hydrated, setHydrated] = useState(false);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void hydrate().finally(() => {
      setHydrated(true);
      void SplashScreen.hideAsync();
    });
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || status === 'loading') return;

    const group = segments[0];
    const inOnboarding = group === 'onboarding';

    if (status === 'signedOut' && !inOnboarding) {
      router.replace('/onboarding');
    } else if (status === 'needsShop' && segments[1] !== 'business-setup') {
      router.replace('/onboarding/business-setup');
    } else if (status === 'ready' && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [hydrated, status, segments, router]);

  // Push registration waits for a shop, because a token with no shop behind it
  // is a token nothing can ever send to.
  useEffect(() => {
    if (status !== 'ready') return;

    void registerForPushNotifications().catch(() => {
      // Declining alerts is a legitimate choice, not an error worth surfacing.
    });

    const subscription = addNotificationResponseListener();
    return () => subscription.remove();
  }, [status]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={isDark ? PaperDarkTheme : PaperLightTheme}>
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <AuthGate>
            <SyncProvider>
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
                <Stack.Screen name="add-product" options={{ presentation: 'modal' }} />
                <Stack.Screen name="record-payment" options={{ presentation: 'modal' }} />
                <Stack.Screen name="reminder-schedule" options={{ presentation: 'modal' }} />
                <Stack.Screen name="suppliers" />
              </Stack>
            </SyncProvider>
          </AuthGate>
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
