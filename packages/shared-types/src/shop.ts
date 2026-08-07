import { z } from 'zod';
import { CurrencySchema, IdSchema, SyncMetaSchema, TimestampSchema } from './common.js';

export const ShopRoleSchema = z.enum(['owner', 'staff']);
export type ShopRole = z.infer<typeof ShopRoleSchema>;

/**
 * Currency is set once per business account and applies to every figure in the
 * app. It is deliberately not per-transaction: mixing currencies inside one
 * shop's ledger would make every total and margin meaningless.
 */
export const ShopSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(120),
  currency: CurrencySchema,
  timezone: z.string().default('Africa/Accra'),
  countryCode: z.string().length(2).default('GH'),
  lowStockThresholdDefault: z.number().int().nonnegative().default(5),
  createdAt: TimestampSchema,
});
export type Shop = z.infer<typeof ShopSchema>;

export const ShopViewSchema = ShopSchema.extend(SyncMetaSchema.shape);
export type ShopView = z.infer<typeof ShopViewSchema>;

export const UpdateShopSchema = ShopSchema.pick({
  name: true,
  currency: true,
  timezone: true,
  lowStockThresholdDefault: true,
}).partial();
export type UpdateShop = z.infer<typeof UpdateShopSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  phone: z.string(),
  displayName: z.string().nullable(),
  createdAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

export const DeviceSchema = z.object({
  id: IdSchema,
  label: z.string().nullable(),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  lastSeenAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});
export type Device = z.infer<typeof DeviceSchema>;

/** Shape returned by onboarding once business setup completes. */
export const BusinessSetupSchema = z.object({
  name: z.string().min(1).max(120),
  currency: CurrencySchema,
  timezone: z.string().optional(),
});
export type BusinessSetup = z.infer<typeof BusinessSetupSchema>;
