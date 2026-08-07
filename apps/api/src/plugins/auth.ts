import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { AppError } from '../lib/errors.js';
import { TenantContext } from '../lib/tenant.js';
import { createSmsProvider } from '../providers/sms.js';

export const authPlugin = fp(async function authPlugin(app: FastifyInstance) {
  const secret = app.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured; sessions cannot be signed');
  }

  await app.register(jwt, {
    secret,
    sign: { expiresIn: app.env.ACCESS_TOKEN_TTL_SECONDS },
  });

  app.decorate('sms', createSmsProvider(app.env, app.log));

  app.decorate('authenticate', async function authenticate(request: FastifyRequest) {
    try {
      await request.jwtVerify();
    } catch {
      // Deliberately opaque: distinguishing "expired" from "malformed" from
      // "wrong signature" tells an attacker which knob to turn.
      throw AppError.unauthorized('Invalid or expired session');
    }

    const payload = request.user;

    request.auth = {
      userId: payload.sub,
      shopId: payload.shopId,
      deviceId: payload.deviceId,
      role: payload.role,
    };

    if (payload.shopId) {
      request.shopId = payload.shopId;
      request.tenant = new TenantContext(
        {
          shopId: payload.shopId,
          userId: payload.sub,
          deviceId: payload.deviceId,
          role: payload.role,
        },
        app.db,
      );
    }
  });
});
