import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateCreditorSchema,
  CreditLedgerEntrySchema,
  CreditorViewSchema,
  ImportContactsSchema,
  RecordPaymentSchema,
  UpdateCreditorSchema,
} from '@dwaso/shared-types';
import { requireTenant } from '../../lib/tenant.js';
import { CreditService } from './service.js';

const CreditorParams = z.object({ id: z.uuid() });

export async function creditRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new CreditService(app.db);

  routes.addHook('onRequest', app.authenticate);

  routes.get(
    '/',
    {
      schema: {
        querystring: z.object({
          status: z.enum(['all', 'overdue', 'upcoming', 'clear']).default('all'),
        }),
        response: { 200: z.array(CreditorViewSchema) },
      },
    },
    async (request) => service.list(requireTenant(request.tenant), request.query.status),
  );

  routes.post(
    '/',
    { schema: { body: CreateCreditorSchema, response: { 201: CreditorViewSchema } } },
    async (request, reply) => {
      const creditor = await service.create(requireTenant(request.tenant), request.body);
      return reply.status(201).send(creditor);
    },
  );

  routes.post(
    '/import',
    { schema: { body: ImportContactsSchema, response: { 201: z.array(CreditorViewSchema) } } },
    async (request, reply) => {
      const created = await service.importContacts(requireTenant(request.tenant), request.body);
      return reply.status(201).send(created);
    },
  );

  routes.get(
    '/:id',
    { schema: { params: CreditorParams, response: { 200: CreditorViewSchema } } },
    async (request) => service.get(requireTenant(request.tenant), request.params.id),
  );

  routes.patch(
    '/:id',
    {
      schema: {
        params: CreditorParams,
        body: UpdateCreditorSchema,
        response: { 200: CreditorViewSchema },
      },
    },
    async (request) =>
      service.update(requireTenant(request.tenant), request.params.id, request.body),
  );

  routes.post(
    '/:id/payments',
    {
      schema: {
        params: CreditorParams,
        body: RecordPaymentSchema,
        response: { 201: CreditorViewSchema },
      },
    },
    async (request, reply) => {
      const creditor = await service.recordPayment(
        requireTenant(request.tenant),
        request.params.id,
        request.body,
      );
      return reply.status(201).send(creditor);
    },
  );

  routes.get(
    '/:id/history',
    {
      schema: { params: CreditorParams, response: { 200: z.array(CreditLedgerEntrySchema) } },
    },
    async (request) => {
      const rows = await service.history(requireTenant(request.tenant), request.params.id);
      return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
    },
  );

  routes.delete(
    '/:id',
    { schema: { params: CreditorParams, response: { 204: z.null() } } },
    async (request, reply) => {
      await service.remove(requireTenant(request.tenant), request.params.id);
      return reply.status(204).send(null);
    },
  );
}
