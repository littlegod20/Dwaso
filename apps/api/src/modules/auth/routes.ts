import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  DeviceSchema,
  RefreshSessionSchema,
  RequestOtpResponseSchema,
  RequestOtpSchema,
  SessionSchema,
  VerifyOtpSchema,
} from '@dwaso/shared-types';
import { AuthService } from './service.js';
import * as repo from './repo.js';
import { AppError } from '../../lib/errors.js';

export async function authRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new AuthService(app);

  routes.post(
    '/otp/request',
    {
      schema: {
        body: RequestOtpSchema,
        response: { 200: RequestOtpResponseSchema },
      },
      config: {
        // Tighter than the global limit: this route spends money on every call.
        // The per-phone caps live in OtpStore; this one is per IP.
        rateLimit: { max: 10, timeWindow: '10 minutes' },
      },
    },
    async (request) => service.requestOtp(request.body),
  );

  routes.post(
    '/otp/verify',
    {
      schema: {
        body: VerifyOtpSchema,
        response: { 200: SessionSchema },
      },
      config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
    },
    async (request) => service.verifyOtp(request.body),
  );

  routes.post(
    '/refresh',
    {
      schema: {
        body: RefreshSessionSchema,
        response: { 200: SessionSchema },
      },
      config: { rateLimit: { max: 60, timeWindow: '10 minutes' } },
    },
    async (request) => service.refresh(request.body.refreshToken, request.body.deviceId),
  );

  routes.post(
    '/logout',
    {
      onRequest: [app.authenticate],
      schema: { response: { 204: z.null() } },
    },
    async (request, reply) => {
      await service.logout(request.auth!.deviceId);
      return reply.status(204).send(null);
    },
  );

  /**
   * Device management doubles as the account-security screen: a trader whose
   * phone was stolen needs a way to cut that handset off without changing
   * anything else.
   */
  routes.get(
    '/devices',
    {
      onRequest: [app.authenticate],
      schema: { response: { 200: z.array(DeviceSchema) } },
    },
    async (request) => {
      const rows = await repo.listUserDevices(app.db, request.auth!.userId);
      return rows.map((device) => ({
        ...device,
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        createdAt: device.createdAt.toISOString(),
      }));
    },
  );

  routes.delete(
    '/devices/:deviceId',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ deviceId: z.uuid() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const removed = await repo.deleteDevice(
        app.db,
        request.auth!.userId,
        request.params.deviceId,
      );
      if (!removed) throw AppError.notFound('Device');
      return reply.status(204).send(null);
    },
  );
}
