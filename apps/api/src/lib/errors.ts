/**
 * Every error the API returns deliberately is an AppError. Anything else that
 * reaches the error handler is treated as a bug and reported as a generic 500,
 * so an accidental exception can never leak a stack trace or a driver message
 * to a client.
 */
export type ErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'resync_required'
  | 'upstream_unavailable'
  | 'internal_error';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  quota_exceeded: 429,
  resync_required: 409,
  upstream_unavailable: 503,
  internal_error: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError('bad_request', message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError('unauthorized', message);
  }

  static forbidden(message = 'Not permitted') {
    return new AppError('forbidden', message);
  }

  static notFound(resource: string) {
    return new AppError('not_found', `${resource} not found`);
  }

  static conflict(message: string, details?: unknown) {
    return new AppError('conflict', message, details);
  }

  static quotaExceeded(message: string, details?: unknown) {
    return new AppError('quota_exceeded', message, details);
  }

  static upstreamUnavailable(service: string) {
    return new AppError('upstream_unavailable', `${service} is unavailable`);
  }
}

export type ErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};
