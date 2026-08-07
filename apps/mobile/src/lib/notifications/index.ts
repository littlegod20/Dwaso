import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { apiRequest } from '../api/client';
import { getDeviceId } from '../auth/tokens';

/**
 * Push registration and handling.
 *
 * There is exactly one notification this app sends unprompted: a product has
 * fallen below its reorder point. That restraint is deliberate — a shopkeeper
 * who learns to ignore this app's notifications will also ignore the one that
 * would have saved her a stockout.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Simulators have no push token to give, and asking produces a confusing
  // failure rather than a useful one.
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('low-stock', {
      name: 'Low stock alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted
    ? existing
    : await Notifications.requestPermissionsAsync();

  if (!status.granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) return null;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  await apiRequest('/notifications/token', {
    method: 'PUT',
    body: {
      token: token.data,
      platform: Platform.OS,
      deviceId: await getDeviceId(),
    },
  });

  return token.data;
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    await apiRequest('/notifications/token', {
      method: 'DELETE',
      body: { deviceId: await getDeviceId() },
    });
  } catch {
    // Signing out matters more than tidying the token registry; the server
    // prunes tokens that stop accepting deliveries anyway.
  }
}

/**
 * Sends a tapped low-stock alert to the supplier search already filtered for the
 * product that ran out, so the notification ends in a phone call rather than in
 * the user hunting for what it was about.
 */
export function addNotificationResponseListener() {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { productId?: string };

    if (data.productId) {
      router.push({ pathname: '/suppliers', params: { productId: data.productId } });
    }
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
