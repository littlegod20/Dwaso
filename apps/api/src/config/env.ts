import { existsSync } from 'node:fs';
import { z } from 'zod';

let dotEnvLoaded = false;

/**
 * Loads a local .env for development and tests. Real deployments inject
 * configuration through the platform, so this is skipped in production rather
 * than allowing a stray file in an image to override it.
 *
 * Node's loader does not overwrite variables that are already set, so an
 * explicit CI or shell value always wins over the file.
 */
function loadDotEnvFile() {
  if (dotEnvLoaded || process.env.NODE_ENV === 'production') return;
  dotEnvLoaded = true;

  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

/**
 * Secrets that are optional in development (so `pnpm dev` works with nothing
 * configured) but mandatory in production. Listed once here and enforced by the
 * superRefine below, so a missing secret fails at boot rather than at the first
 * request that happens to need it.
 */
const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'CORS_ORIGINS',
] as const;

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

    REDIS_URL: z.string().optional(),

    // Signing key for access tokens. Refresh tokens are opaque and hashed in the
    // database, so this key only protects the 15-minute access window.
    JWT_SECRET: z.string().min(32).optional(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
    // Deliberately long: an offline-first device may be off the network for weeks
    // and must still sync on reconnect without forcing a re-login.
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 24 * 60 * 60),

    CORS_ORIGINS: z.string().optional(),

    OTP_TTL_SECONDS: z.coerce.number().int().positive().default(5 * 60),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),

    SMS_PROVIDER: z.enum(['console', 'hubtel', 'termii']).default('console'),
    HUBTEL_CLIENT_ID: z.string().optional(),
    HUBTEL_CLIENT_SECRET: z.string().optional(),
    HUBTEL_SENDER_ID: z.string().optional(),
    TERMII_API_KEY: z.string().optional(),
    TERMII_SENDER_ID: z.string().optional(),

    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),

    ANTHROPIC_API_KEY: z.string().optional(),
    VISION_MODEL: z.string().default('claude-sonnet-4-6'),
    SCAN_DAILY_QUOTA_PER_SHOP: z.coerce.number().int().positive().default(200),

    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    GOOGLE_PLACES_API_KEY: z.string().optional(),
    PLACES_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(24 * 60 * 60),

    EXPO_ACCESS_TOKEN: z.string().optional(),

    OTEL_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    OTEL_SERVICE_NAME: z.string().default('dwaso-api'),

    // Tombstones older than this are purged; a device whose cursor predates the
    // window is told to resync from scratch.
    TOMBSTONE_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    SCAN_IMAGE_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
    MESSAGE_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    for (const key of PRODUCTION_REQUIRED) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }

    if (env.SMS_PROVIDER === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message: 'SMS_PROVIDER cannot be "console" in production; OTPs would never be delivered',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  loadDotEnvFile();

  const parsed = EnvSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed.data;
}

export function corsOrigins(env: Env): string[] | boolean {
  if (!env.CORS_ORIGINS) return env.NODE_ENV !== 'production';
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
