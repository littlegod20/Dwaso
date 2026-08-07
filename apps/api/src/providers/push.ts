import type { Env } from '../config/env.js';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  /** Carries the product so the notification deep-links straight into supplier
   * search filtered for it, rather than dropping the trader on a home screen. */
  data?: Record<string, unknown>;
};

export type PushTicket = {
  token: string;
  ok: boolean;
  /** Set when Expo reports the token as permanently dead, so a retired handset
   * stops consuming send attempts forever. */
  unregistered: boolean;
};

export interface PushSender {
  send(messages: PushMessage[]): Promise<PushTicket[]>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

class ExpoPushSender implements PushSender {
  constructor(private readonly accessToken?: string) {}

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    const tickets: PushTicket[] = [];

    for (let index = 0; index < messages.length; index += BATCH_SIZE) {
      const batch = messages.slice(index, index + BATCH_SIZE);

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        tickets.push(
          ...batch.map((message) => ({ token: message.to, ok: false, unregistered: false })),
        );
        continue;
      }

      const payload = (await response.json()) as {
        data?: { status: string; details?: { error?: string } }[];
      };

      batch.forEach((message, position) => {
        const ticket = payload.data?.[position];
        tickets.push({
          token: message.to,
          ok: ticket?.status === 'ok',
          unregistered: ticket?.details?.error === 'DeviceNotRegistered',
        });
      });
    }

    return tickets;
  }
}

class NoopPushSender implements PushSender {
  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    return messages.map((message) => ({ token: message.to, ok: true, unregistered: false }));
  }
}

export function createPushSender(env: Env): PushSender {
  if (env.NODE_ENV === 'test') return new NoopPushSender();
  return new ExpoPushSender(env.EXPO_ACCESS_TOKEN);
}
