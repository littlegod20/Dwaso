import { create } from 'zustand';
import type { BusinessSetup, RequestOtpResponse, Session } from '@dwaso/shared-types';
import { apiRequest, setUnauthenticatedHandler } from '@/lib/api/client';
import { clearTokens, getDeviceId, readTokens, saveTokens } from '@/lib/auth/tokens';
import { META_KEYS, clearDatabase, getMeta, setMeta } from '@/lib/db';
import { unregisterPushNotifications } from '@/lib/notifications';
import { Platform } from 'react-native';

/**
 * Where the user is in the account lifecycle.
 *
 * `needsShop` is a distinct state rather than a flag on `ready` because a trader
 * who has verified her phone but not named her business can do nothing useful in
 * the app — every screen reads shop-scoped data — so the router has to send her
 * somewhere different, not render a degraded home screen.
 */
export type SessionStatus = 'loading' | 'signedOut' | 'needsShop' | 'ready';

type SessionUser = Session['user'];
type SessionShop = NonNullable<Session['shop']>;

type SessionState = {
  status: SessionStatus;
  user: SessionUser | null;
  shop: SessionShop | null;
  hydrate: () => Promise<void>;
  requestOtp: (phone: string) => Promise<RequestOtpResponse>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  completeSetup: (setup: BusinessSetup) => Promise<void>;
  signOut: () => Promise<void>;
};

async function adopt(session: Session): Promise<Partial<SessionState>> {
  await saveTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });

  // A handset that previously held another trader's shop is wiped rather than
  // merged. Two ledgers sharing one local database would be unrecoverable.
  const previousShopId = await getMeta(META_KEYS.shopId);
  if (session.shop && previousShopId && previousShopId !== session.shop.id) {
    await clearDatabase();
  }
  if (session.shop) {
    await setMeta(META_KEYS.shopId, session.shop.id);
  }

  return {
    status: session.shop && session.onboarded ? 'ready' : 'needsShop',
    user: session.user,
    shop: session.shop,
  };
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  shop: null,

  /**
   * Restores the session at launch.
   *
   * Deliberately optimistic: if there are tokens on disk but the network is
   * unreachable, the trader stays signed in and works offline. Only an explicit
   * rejection from the server signs her out.
   */
  async hydrate() {
    const tokens = await readTokens();

    if (!tokens) {
      set({ status: 'signedOut', user: null, shop: null });
      return;
    }

    try {
      const session = await apiRequest<Session>('/auth/refresh', {
        method: 'POST',
        anonymous: true,
        body: { refreshToken: tokens.refreshToken, deviceId: await getDeviceId() },
      });

      set(await adopt(session));
    } catch {
      const shopId = await getMeta(META_KEYS.shopId);
      set({ status: shopId ? 'ready' : 'signedOut' });
    }
  },

  async requestOtp(phone) {
    return apiRequest<RequestOtpResponse>('/auth/otp/request', {
      method: 'POST',
      anonymous: true,
      body: { phone },
    });
  },

  async verifyOtp(phone, code) {
    const session = await apiRequest<Session>('/auth/otp/verify', {
      method: 'POST',
      anonymous: true,
      body: {
        phone,
        code,
        device: {
          id: await getDeviceId(),
          label: Platform.OS === 'ios' ? 'iPhone' : 'Android phone',
          platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
        },
      },
    });

    set(await adopt(session));
  },

  async completeSetup(setup) {
    const shop = await apiRequest<SessionShop & { currency: string }>('/shops', {
      method: 'POST',
      body: setup,
    });

    await setMeta(META_KEYS.shopId, shop.id);
    set({ status: 'ready', shop: { id: shop.id, name: shop.name, currency: shop.currency } });
  },

  async signOut() {
    // Retiring the push token first, while the access token is still valid.
    // Skipping it would leave the server sending this shop's stock alerts to a
    // handset that now belongs to someone else.
    await unregisterPushNotifications();

    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Signing out locally has to work even with no signal, otherwise a trader
      // cannot hand her phone to someone else while offline.
    }

    await clearTokens();
    await clearDatabase();
    set({ status: 'signedOut', user: null, shop: null });
  },
}));

/** A 401 the client could not refresh past means the session is genuinely over. */
setUnauthenticatedHandler(() => {
  if (useSessionStore.getState().status !== 'signedOut') {
    void useSessionStore.getState().signOut();
  }
});

export function useCurrency(): string {
  return useSessionStore((state) => state.shop?.currency ?? 'GHS');
}
