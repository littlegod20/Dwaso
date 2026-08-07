import { z } from 'zod';
import {
  DateOnlySchema,
  IdSchema,
  MoneyMinorSchema,
  PositiveMoneyMinorSchema,
  SyncMetaSchema,
  TimestampSchema,
} from './common.js';

export const CreditorStatusSchema = z.enum(['clear', 'upcoming', 'overdue']);
export type CreditorStatus = z.infer<typeof CreditorStatusSchema>;

/**
 * A creditor is a third party who never installed the app and never agreed to be
 * in it. Everything stored here is the minimum needed to chase a debt, and the
 * record carries its own consent and contact-preference state so reminders can
 * be suppressed per person.
 */
export const CreditorSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(120),
  phone: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  dueDate: DateOnlySchema.nullable().default(null),
  note: z.string().max(500).nullable().default(null),
  /** Set when the person asks not to be contacted; suppresses all reminders. */
  remindersOptedOut: z.boolean().default(false),
  source: z.enum(['manual', 'contact_import']).default('manual'),
  createdAt: TimestampSchema,
});
export type Creditor = z.infer<typeof CreditorSchema>;

export const CreditorViewSchema = CreditorSchema.extend({
  ...SyncMetaSchema.shape,
  balanceMinor: MoneyMinorSchema,
  status: CreditorStatusSchema,
  daysOverdue: z.number().int().nullable(),
  daysUntilDue: z.number().int().nullable(),
  lastPaymentAt: TimestampSchema.nullable(),
});
export type CreditorView = z.infer<typeof CreditorViewSchema>;

export const CreateCreditorSchema = CreditorSchema.omit({ createdAt: true })
  .partial({
    id: true,
    phone: true,
    email: true,
    dueDate: true,
    note: true,
    remindersOptedOut: true,
    source: true,
  })
  .extend({
    /** Recorded as an `adjustment` ledger entry, not as a mutable balance. */
    openingBalanceMinor: PositiveMoneyMinorSchema.optional(),
  });
export type CreateCreditor = z.infer<typeof CreateCreditorSchema>;

export const UpdateCreditorSchema = CreateCreditorSchema.omit({
  id: true,
  openingBalanceMinor: true,
}).partial();
export type UpdateCreditor = z.infer<typeof UpdateCreditorSchema>;

export const LedgerEntryKindSchema = z.enum(['credit_sale', 'payment', 'adjustment', 'write_off']);
export type LedgerEntryKind = z.infer<typeof LedgerEntryKindSchema>;

/**
 * Append-only. Positive increases what is owed, negative reduces it, so a
 * balance is a sum and never a value two devices could disagree about.
 */
export const CreditLedgerEntrySchema = z.object({
  id: IdSchema,
  creditorId: IdSchema,
  kind: LedgerEntryKindSchema,
  amountMinor: MoneyMinorSchema,
  saleId: IdSchema.nullable().default(null),
  note: z.string().max(500).nullable().default(null),
  occurredAt: TimestampSchema,
});
export type CreditLedgerEntry = z.infer<typeof CreditLedgerEntrySchema>;

export const CreditLedgerEntryViewSchema = CreditLedgerEntrySchema.extend(SyncMetaSchema.shape);
export type CreditLedgerEntryView = z.infer<typeof CreditLedgerEntryViewSchema>;

export const RecordPaymentSchema = z.object({
  id: IdSchema.optional(),
  amountMinor: PositiveMoneyMinorSchema.refine((value) => value > 0, 'Payment must be positive'),
  note: z.string().max(500).optional(),
  occurredAt: TimestampSchema.optional(),
});
export type RecordPayment = z.infer<typeof RecordPaymentSchema>;

/**
 * Contact import is bulk third-party personal data, so the client sends only the
 * entries the trader explicitly picked. The API has no endpoint that accepts a
 * whole address book.
 */
export const ImportContactsSchema = z.object({
  contacts: z
    .array(
      z.object({
        id: IdSchema.optional(),
        name: z.string().min(1).max(120),
        phone: z.string().min(3).max(32),
      }),
    )
    .min(1)
    .max(50),
});
export type ImportContacts = z.infer<typeof ImportContactsSchema>;
