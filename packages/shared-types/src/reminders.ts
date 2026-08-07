import { z } from 'zod';
import { IdSchema, SyncMetaSchema, TimestampSchema } from './common.js';

/**
 * Channels sit behind one interface so the spec's open question — WhatsApp
 * Business API versus a cheaper SMS gateway — stays a configuration decision
 * rather than a rewrite, and can even differ per shop.
 */
export const MessageChannelSchema = z.enum(['whatsapp', 'sms', 'email']);
export type MessageChannel = z.infer<typeof MessageChannelSchema>;

export const ReminderTriggerSchema = z.enum([
  'days_before_due',
  'on_due_date',
  'days_after_due',
  'weekly_until_paid',
]);
export type ReminderTrigger = z.infer<typeof ReminderTriggerSchema>;

export const ReminderRuleSchema = z.object({
  trigger: ReminderTriggerSchema,
  /** Days offset; ignored by `on_due_date` and `weekly_until_paid`. */
  offsetDays: z.number().int().min(0).max(90).default(0),
});
export type ReminderRule = z.infer<typeof ReminderRuleSchema>;

/**
 * A schedule with a null creditorId is the shop-wide default; one with a
 * creditorId overrides it for that person, matching the "This customer /
 * Global default" toggle in the UI.
 */
export const ReminderScheduleSchema = z.object({
  id: IdSchema,
  creditorId: IdSchema.nullable().default(null),
  channel: MessageChannelSchema,
  rules: z.array(ReminderRuleSchema).min(1).max(10),
  enabled: z.boolean().default(true),
  createdAt: TimestampSchema,
});
export type ReminderSchedule = z.infer<typeof ReminderScheduleSchema>;

export const ReminderScheduleViewSchema = ReminderScheduleSchema.extend(SyncMetaSchema.shape);
export type ReminderScheduleView = z.infer<typeof ReminderScheduleViewSchema>;

export const UpsertReminderScheduleSchema = ReminderScheduleSchema.omit({
  createdAt: true,
}).partial({ id: true, creditorId: true, enabled: true });
export type UpsertReminderSchedule = z.infer<typeof UpsertReminderScheduleSchema>;

export const MessageStatusSchema = z.enum([
  'pending',
  'sending',
  'sent',
  'delivered',
  'failed',
  'suppressed',
]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const MessageDeliverySchema = z.object({
  id: IdSchema,
  creditorId: IdSchema,
  channel: MessageChannelSchema,
  status: MessageStatusSchema,
  body: z.string(),
  error: z.string().nullable(),
  sentAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});
export type MessageDelivery = z.infer<typeof MessageDeliverySchema>;

export const SendReminderSchema = z.object({
  creditorId: IdSchema,
  channel: MessageChannelSchema,
  /** Overrides the generated text; still gets the sender identity and opt-out
   * appended, which is a legal requirement rather than a preference. */
  body: z.string().max(600).optional(),
});
export type SendReminder = z.infer<typeof SendReminderSchema>;
