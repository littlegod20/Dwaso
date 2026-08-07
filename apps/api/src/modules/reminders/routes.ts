import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  MessageDeliverySchema,
  ReminderScheduleSchema,
  SendReminderSchema,
  UpsertReminderScheduleSchema,
} from '@dwaso/shared-types';
import { requireTenant } from '../../lib/tenant.js';
import { RemindersService } from './service.js';

export async function reminderRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new RemindersService(app.db);

  routes.addHook('onRequest', app.authenticate);

  routes.get(
    '/schedules',
    { schema: { response: { 200: z.array(ReminderScheduleSchema) } } },
    async (request) => {
      const rows = await service.listSchedules(requireTenant(request.tenant));
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
    },
  );

  routes.put(
    '/schedules',
    {
      schema: {
        body: UpsertReminderScheduleSchema,
        response: { 200: ReminderScheduleSchema },
      },
    },
    async (request) => {
      const row = await service.upsertSchedule(requireTenant(request.tenant), request.body);
      return { ...row, createdAt: row.createdAt.toISOString() };
    },
  );

  routes.delete(
    '/schedules/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      await service.deleteSchedule(requireTenant(request.tenant), request.params.id);
      return reply.status(204).send(null);
    },
  );

  routes.post(
    '/send',
    {
      schema: {
        body: SendReminderSchema,
        response: {
          202: z.object({
            queued: z.boolean(),
            messageId: z.uuid().nullable(),
            reason: z.string().nullable(),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await service.queueReminder(requireTenant(request.tenant), request.body);
      return reply.status(202).send(result);
    },
  );

  routes.get(
    '/deliveries',
    {
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
        response: { 200: z.array(MessageDeliverySchema) },
      },
    },
    async (request) => {
      const rows = await service.listDeliveries(requireTenant(request.tenant), request.query.limit);
      return rows.map((row) => ({
        id: row.id,
        creditorId: row.creditorId,
        channel: row.channel,
        status: row.status,
        body: row.body,
        error: row.lastError,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      }));
    },
  );
}
