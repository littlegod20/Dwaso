import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';
import { AppError, type ErrorResponse } from '../lib/errors.js';

function respond(reply: FastifyReply, status: number, body: ErrorResponse) {
  return reply.status(status).send(body);
}

/**
 * Single exit point for every failure. Known failures are translated to a stable
 * `{ error: { code, message } }` envelope the mobile client can branch on;
 * anything unrecognised is logged in full and reported as a bare 500, so an
 * unexpected exception can never leak internals to a client.
 */
export const errorHandlerPlugin = fp(async function errorHandlerPlugin(app: FastifyInstance) {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    return respond(reply, 404, {
      error: {
        code: 'not_found',
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    // Read these up front. Fastify hands the handler an `unknown`, and the type
    // guards below narrow it to their own shapes, so the fallback branches at
    // the bottom would otherwise have nothing left to read from.
    const thrown = error as Partial<FastifyError>;
    const statusCode = typeof thrown.statusCode === 'number' ? thrown.statusCode : 500;
    const message = thrown.message || 'Internal server error';

    if (error instanceof AppError) {
      // Client mistakes are noise at error level; they are expected traffic.
      const level = error.statusCode >= 500 ? 'error' : 'info';
      request.log[level]({ err: error, code: error.code }, error.message);

      return respond(reply, error.statusCode, {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      request.log.info({ issues: error.validation }, 'Request failed schema validation');

      return respond(reply, 422, {
        error: {
          code: 'validation_failed',
          message: 'Request did not match the expected schema',
          details: error.validation.map((issue) => ({
            path: issue.instancePath,
            message: issue.message,
          })),
          requestId: request.id,
        },
      });
    }

    // A response that fails serialisation means the handler returned something
    // the contract does not allow. That is a server bug, and surfacing it as 500
    // is what stops an unvalidated field from reaching a client.
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, route: error.method }, 'Response failed serialisation');

      return respond(reply, 500, {
        error: {
          code: 'internal_error',
          message: 'Internal server error',
          requestId: request.id,
        },
      });
    }

    if (statusCode === 429) {
      return respond(reply, 429, {
        error: {
          code: 'rate_limited',
          message: 'Too many requests, please slow down',
          requestId: request.id,
        },
      });
    }

    if (statusCode < 500) {
      request.log.info({ err: error }, message);

      return respond(reply, statusCode, {
        error: {
          code: 'bad_request',
          message,
          requestId: request.id,
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled error');

    return respond(reply, 500, {
      error: {
        code: 'internal_error',
        message: 'Internal server error',
        requestId: request.id,
      },
    });
  });
});
