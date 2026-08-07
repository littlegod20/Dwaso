import type { LoggerOptions } from 'pino';
import { trace } from '@opentelemetry/api';
import type { Env } from './env.js';

/**
 * Phone numbers are the primary identifier in this product and belong to third
 * parties (creditors) who never consented to being in it, so they are redacted
 * everywhere rather than case by case. Redaction is configured once, here, so a
 * new route cannot forget to do it.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.phone',
  'req.body.phoneNumber',
  'req.body.code',
  'req.body.refreshToken',
  'req.body.creditors[*].phone',
  'res.headers["set-cookie"]',
  '*.phone',
  '*.phoneNumber',
  '*.refreshToken',
  '*.accessToken',
  '*.otp',
  '*.apiKey',
  '*.secret',
];

export function loggerOptions(env: Env): LoggerOptions {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    // Stamps every line with the trace it belongs to. Without this the traces
    // tell you which request was slow and the logs tell you what went wrong,
    // and there is no way to line the two up.
    ...(env.OTEL_ENABLED
      ? {
          mixin() {
            const context = trace.getActiveSpan()?.spanContext();
            if (!context) return {};
            return { trace_id: context.traceId, span_id: context.spanId };
          },
        }
      : {}),
    ...(env.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
    serializers: {
      req(request: { id: string; method: string; url: string; ip: string }) {
        return {
          id: request.id,
          method: request.method,
          url: request.url,
          ip: request.ip,
        };
      },
    },
  };
}
