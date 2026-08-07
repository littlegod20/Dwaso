import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { DashboardSchema, ReportQuerySchema, ReportSummarySchema } from '@dwaso/shared-types';
import { requireTenant } from '../../lib/tenant.js';
import { ReportsService } from './service.js';

export async function reportRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = new ReportsService(app.db);

  routes.addHook('onRequest', app.authenticate);

  routes.get(
    '/summary',
    { schema: { querystring: ReportQuerySchema, response: { 200: ReportSummarySchema } } },
    async (request) => service.summary(requireTenant(request.tenant), request.query),
  );

  routes.get('/dashboard', { schema: { response: { 200: DashboardSchema } } }, async (request) =>
    service.dashboard(requireTenant(request.tenant)),
  );
}
