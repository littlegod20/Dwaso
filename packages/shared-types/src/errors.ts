import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'bad_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'quota_exceeded',
  'resync_required',
  'upstream_unavailable',
  'internal_error',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Errors worth retrying on a market connection. The sync engine uses this to
 * decide whether to keep a mutation in the outbox or drop it: retrying a
 * validation failure forever would wedge the queue behind one bad row.
 */
export const RETRYABLE_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  'rate_limited',
  'upstream_unavailable',
  'internal_error',
]);

export function isRetryableError(code: ErrorCode): boolean {
  return RETRYABLE_ERROR_CODES.has(code);
}
