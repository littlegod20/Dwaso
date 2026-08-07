import Constants from 'expo-constants';
import type { ErrorCode } from '@dwaso/shared-types';
import { clearTokens, getDeviceId, readTokens, saveTokens } from '../auth/tokens';

/**
 * Points at the API. `EXPO_PUBLIC_API_URL` is inlined at build time; the
 * `extra` fallback lets a build be repointed without a rebuild.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'network_error',
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Whether retrying the same request later could plausibly succeed.
   *
   * The sync engine leans on this: a retryable failure means "we are offline or
   * the server is busy, keep the mutation and try again", while a
   * non-retryable one means "this will never work, stop burning battery on it".
   */
  get retryable(): boolean {
    return (
      this.code === 'network_error' ||
      this.code === 'rate_limited' ||
      this.code === 'upstream_unavailable' ||
      this.status >= 500
    );
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Skips the Authorization header and refresh handling, for the login flow. */
  anonymous?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

let refreshInFlight: Promise<string | null> | null = null;
let onUnauthenticated: (() => void) | null = null;

/** Lets the session store react to a refresh token that no longer works. */
export function setUnauthenticatedHandler(handler: (() => void) | null) {
  onUnauthenticated = handler;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`/v1${path}`, API_BASE_URL);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as {
      error?: { code?: ErrorCode; message?: string; details?: unknown };
    };

    return new ApiError(
      payload.error?.code ?? 'internal_error',
      payload.error?.message ?? 'Something went wrong',
      response.status,
      payload.error?.details,
    );
  } catch {
    return new ApiError('internal_error', `Request failed (${response.status})`, response.status);
  }
}

/**
 * Exchanges the refresh token for a new pair.
 *
 * Deduplicated by a module-level promise: a screen load can fire several
 * requests at once, and letting each one refresh independently would rotate the
 * token repeatedly and trip the server's reuse detection, logging the trader out
 * for doing nothing wrong.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const tokens = await readTokens();
      if (!tokens) return null;

      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken, deviceId: await getDeviceId() }),
      });

      if (!response.ok) {
        await clearTokens();
        onUnauthenticated?.();
        return null;
      }

      const session = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
      };

      await saveTokens(session);
      return session.accessToken;
    } catch {
      // A network failure is not a credential failure. Keep the tokens so the
      // trader is still logged in when signal comes back.
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, anonymous = false, timeoutMs = 20_000 } = options;

  const send = async (accessToken: string | null): Promise<Response> => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    return fetch(buildUrl(path, query), {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  };

  let response: Response;

  try {
    const tokens = anonymous ? null : await readTokens();
    response = await send(tokens?.accessToken ?? null);

    // One retry after a refresh, and only one. Access tokens are short-lived by
    // design, so a 401 on a request the trader just made is expected traffic
    // rather than an error worth showing her.
    if (response.status === 401 && !anonymous) {
      const refreshed = await refreshAccessToken();
      if (refreshed) response = await send(refreshed);
    }
  } catch (error) {
    throw new ApiError(
      'network_error',
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The server took too long to respond'
        : 'No connection to the server',
      0,
    );
  }

  if (!response.ok) {
    const apiError = await parseError(response);
    if (apiError.status === 401) onUnauthenticated?.();
    throw apiError;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
