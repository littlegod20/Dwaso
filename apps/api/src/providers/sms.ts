import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.js';
import { maskPhone } from '../lib/phone.js';
import { AppError } from '../lib/errors.js';

export type SmsMessage = {
  to: string;
  body: string;
};

export type SmsSendResult = {
  providerMessageId: string | null;
};

/**
 * Kept behind an interface because the provider decision is genuinely open and
 * cost-driven: Hubtel and Termii are materially cheaper than Twilio for Ghana
 * and Nigeria and avoid A2P registration friction, but that may change per
 * market. Switching is a config change, not a code change.
 */
export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

const SEND_TIMEOUT_MS = 10_000;

/**
 * Development provider. Logs the code instead of sending it, so local work costs
 * nothing. The env schema rejects this provider when NODE_ENV=production, because
 * silently not delivering OTPs would lock every trader out.
 */
class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';

  constructor(private readonly log: FastifyBaseLogger) {}

  async send(message: SmsMessage): Promise<SmsSendResult> {
    this.log.warn(
      { to: maskPhone(message.to), body: message.body },
      'SMS not sent: console provider is active',
    );
    return { providerMessageId: null };
  }
}

class HubtelSmsProvider implements SmsProvider {
  readonly name = 'hubtel';

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly senderId: string,
  ) {}

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const url = new URL('https://smsc.hubtel.com/v1/messages/send');
    url.searchParams.set('from', this.senderId);
    url.searchParams.set('to', message.to);
    url.searchParams.set('content', message.body);

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw AppError.upstreamUnavailable(`Hubtel (${response.status})`);
    }

    const payload = (await response.json()) as { messageId?: string };
    return { providerMessageId: payload.messageId ?? null };
  }
}

class TermiiSmsProvider implements SmsProvider {
  readonly name = 'termii';

  constructor(
    private readonly apiKey: string,
    private readonly senderId: string,
  ) {}

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: message.to,
        from: this.senderId,
        sms: message.body,
        type: 'plain',
        channel: 'generic',
        api_key: this.apiKey,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw AppError.upstreamUnavailable(`Termii (${response.status})`);
    }

    const payload = (await response.json()) as { message_id?: string };
    return { providerMessageId: payload.message_id ?? null };
  }
}

export function createSmsProvider(env: Env, log: FastifyBaseLogger): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case 'hubtel': {
      if (!env.HUBTEL_CLIENT_ID || !env.HUBTEL_CLIENT_SECRET) {
        throw new Error('SMS_PROVIDER=hubtel requires HUBTEL_CLIENT_ID and HUBTEL_CLIENT_SECRET');
      }
      return new HubtelSmsProvider(
        env.HUBTEL_CLIENT_ID,
        env.HUBTEL_CLIENT_SECRET,
        env.HUBTEL_SENDER_ID ?? 'Dwaso',
      );
    }
    case 'termii': {
      if (!env.TERMII_API_KEY) {
        throw new Error('SMS_PROVIDER=termii requires TERMII_API_KEY');
      }
      return new TermiiSmsProvider(env.TERMII_API_KEY, env.TERMII_SENDER_ID ?? 'Dwaso');
    }
    default:
      return new ConsoleSmsProvider(log);
  }
}
