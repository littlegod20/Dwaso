import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';

export const RequestOtpSchema = z.object({
  phone: z.string().min(6).max(24),
  countryCode: z.string().length(2).default('GH'),
});
export type RequestOtp = z.infer<typeof RequestOtpSchema>;

/**
 * Always the same shape whether or not the number is known, so the response
 * cannot be used to enumerate which traders have accounts.
 */
export const RequestOtpResponseSchema = z.object({
  status: z.literal('sent'),
  expiresInSeconds: z.number().int().positive(),
  /** Returned only when SMS_PROVIDER is `console`, to make local development
   * possible without an SMS bill. Never populated in production. */
  devCode: z.string().optional(),
});
export type RequestOtpResponse = z.infer<typeof RequestOtpResponseSchema>;

export const VerifyOtpSchema = z.object({
  phone: z.string().min(6).max(24),
  countryCode: z.string().length(2).default('GH'),
  code: z.string().min(4).max(8),
  device: z.object({
    id: IdSchema,
    label: z.string().max(80).optional(),
    platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  }),
});
export type VerifyOtp = z.infer<typeof VerifyOtpSchema>;

export const SessionSchema = z.object({
  accessToken: z.string(),
  /** Opaque and rotating; hashed at rest. Only the device ever holds the plaintext. */
  refreshToken: z.string(),
  expiresAt: TimestampSchema,
  user: z.object({
    id: IdSchema,
    phone: z.string(),
    displayName: z.string().nullable(),
  }),
  shop: z
    .object({
      id: IdSchema,
      name: z.string(),
      currency: z.string(),
    })
    .nullable(),
  /** False until business setup completes, so the client knows to show onboarding. */
  onboarded: z.boolean(),
});
export type Session = z.infer<typeof SessionSchema>;

export const RefreshSessionSchema = z.object({
  refreshToken: z.string().min(16),
  deviceId: IdSchema,
});
export type RefreshSession = z.infer<typeof RefreshSessionSchema>;
