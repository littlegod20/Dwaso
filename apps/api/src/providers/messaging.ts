import type { FastifyBaseLogger } from 'fastify';
import type { MessageChannel } from '@dwaso/shared-types';
import type { Env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { maskPhone } from '../lib/phone.js';
import { createSmsProvider } from './sms.js';

export type OutboundMessage = {
  to: string;
  body: string;
};

export type DeliveryResult = {
  providerMessageId: string | null;
};

/**
 * One interface over WhatsApp, SMS and email so the spec's open question — the
 * WhatsApp Business API versus a cheaper SMS gateway — stays a configuration
 * decision. It can even be made per shop or per message on cost grounds without
 * touching the reminder logic.
 */
export interface MessageSender {
  readonly channel: MessageChannel;
  send(message: OutboundMessage): Promise<DeliveryResult>;
}

const SEND_TIMEOUT_MS = 15_000;

class WhatsAppSender implements MessageSender {
  readonly channel = 'whatsapp' as const;

  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: message.to.replace('+', ''),
          type: 'text',
          text: { body: message.body },
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw AppError.upstreamUnavailable(`WhatsApp (${response.status})`);
    }

    const payload = (await response.json()) as { messages?: { id: string }[] };
    return { providerMessageId: payload.messages?.[0]?.id ?? null };
  }
}

class SmsSender implements MessageSender {
  readonly channel = 'sms' as const;

  constructor(
    private readonly env: Env,
    private readonly log: FastifyBaseLogger,
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    const provider = createSmsProvider(this.env, this.log);
    return provider.send({ to: message.to, body: message.body });
  }
}

/** Placeholder until an email provider is chosen; recorded rather than sent, so
 * the outbox still shows what would have gone out. */
class LoggingSender implements MessageSender {
  constructor(
    readonly channel: MessageChannel,
    private readonly log: FastifyBaseLogger,
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    this.log.warn(
      { channel: this.channel, to: maskPhone(message.to) },
      'Message not delivered: no provider configured for this channel',
    );
    return { providerMessageId: null };
  }
}

export function createMessageSenders(
  env: Env,
  log: FastifyBaseLogger,
): Record<MessageChannel, MessageSender> {
  const whatsapp =
    env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN
      ? new WhatsAppSender(env.WHATSAPP_PHONE_NUMBER_ID, env.WHATSAPP_ACCESS_TOKEN)
      : new LoggingSender('whatsapp', log);

  return {
    whatsapp,
    sms: new SmsSender(env, log),
    email: new LoggingSender('email', log),
  };
}

/**
 * Reminder text is composed here rather than at each call site because two parts
 * of it are legal requirements, not copy choices: the message must identify the
 * business sending it, and it must carry a way to opt out. The recipient is a
 * third party who never installed the app.
 */
export function composeReminder(input: {
  businessName: string;
  creditorName: string;
  amountFormatted: string;
  dueDate: string | null;
  daysOverdue: number | null;
}): string {
  const timing =
    input.daysOverdue && input.daysOverdue > 0
      ? `, which was due ${input.daysOverdue} ${input.daysOverdue === 1 ? 'day' : 'days'} ago`
      : input.dueDate
        ? `, due on ${input.dueDate}`
        : '';

  return [
    `Hello ${input.creditorName}, this is a reminder from ${input.businessName}.`,
    `Your outstanding balance is ${input.amountFormatted}${timing}.`,
    `Please get in touch if you have already paid or need more time.`,
    `Reply STOP to stop receiving these reminders.`,
  ].join(' ');
}
