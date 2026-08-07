import { z } from 'zod';

export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

/** ISO-8601 with an explicit offset, so a device in a different timezone cannot
 * produce an ambiguous instant when it syncs. */
export const TimestampSchema = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;

/** Calendar day in the shop's timezone, used for report bucketing. */
export const DateOnlySchema = z.iso.date();
export type DateOnly = z.infer<typeof DateOnlySchema>;

export const CurrencySchema = z.enum(['GHS', 'NGN', 'USD', 'EUR']);
export type Currency = z.infer<typeof CurrencySchema>;

/**
 * All money is an integer count of minor units (pesewas, kobo, cents) — never a
 * float, because these values are summed into balances a trader is owed.
 * A JS number is exact to 2^53, which is far beyond any realistic shop total, so
 * this stays JSON-safe without BigInt serialisation.
 */
export const MoneyMinorSchema = z.number().int();
export type MoneyMinor = z.infer<typeof MoneyMinorSchema>;

/** Signed: ledger entries and stock deltas move in both directions. */
export const SignedMoneyMinorSchema = z.number().int();

export const PositiveMoneyMinorSchema = z.number().int().nonnegative();

/**
 * Metadata the sync engine attaches to every replicated row. `serverSeq` is the
 * shop-scoped cursor position; `deletedAt` is a tombstone rather than a real
 * delete, so an offline device learns about removals it never saw happen.
 */
export const SyncMetaSchema = z.object({
  serverSeq: z.number().int().nonnegative(),
  updatedAt: TimestampSchema,
  deletedAt: TimestampSchema.nullable().default(null),
  updatedByDeviceId: IdSchema.nullable().default(null),
});
export type SyncMeta = z.infer<typeof SyncMetaSchema>;

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
export type Pagination = z.infer<typeof PaginationSchema>;
