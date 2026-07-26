import { z } from 'zod';

export const CurrencySchema = z.enum(['GHS', 'USD', 'NGN', 'EUR']);
export type Currency = z.infer<typeof CurrencySchema>;

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  currency: CurrencySchema,
  quantity: z.number().int(),
});
export type Product = z.infer<typeof ProductSchema>;

export const CreditorSchema = z.object({
  id: z.string(),
  name: z.string(),
  amountOwed: z.number(),
  currency: CurrencySchema,
  dueDate: z.string().optional(),
});
export type Creditor = z.infer<typeof CreditorSchema>;

export const ScanResultSchema = z.object({
  matchedProductId: z.string().nullable(),
  confidence: z.number(),
  rawLabel: z.string(),
});
export type ScanResult = z.infer<typeof ScanResultSchema>;