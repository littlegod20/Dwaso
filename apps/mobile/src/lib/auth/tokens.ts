import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const ACCESS_TOKEN_KEY = 'dwaso.accessToken';
const REFRESH_TOKEN_KEY = 'dwaso.refreshToken';
const DEVICE_ID_KEY = 'dwaso.deviceId';

/**
 * `AFTER_FIRST_UNLOCK` rather than `WHEN_UNLOCKED`.
 *
 * Sync runs in the background, and a token that becomes unreadable whenever the
 * phone is locked would mean a trader's sales only upload while she is looking
 * at the screen — the opposite of what an offline-first app needs.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken, OPTIONS),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken, OPTIONS),
  ]);
}

export async function readTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY, OPTIONS),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY, OPTIONS),
  ]);

  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, OPTIONS),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, OPTIONS),
  ]);
}

/**
 * A stable identifier for this installation.
 *
 * The server ties refresh-token rotation and reuse detection to it, so it has to
 * survive app restarts but must not survive a reinstall — a reinstalled app is a
 * genuinely new client and should get its own token lineage rather than inherit
 * a rotation chain it cannot continue.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY, OPTIONS);
  if (existing) return existing;

  const deviceId = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, OPTIONS);
  return deviceId;
}
