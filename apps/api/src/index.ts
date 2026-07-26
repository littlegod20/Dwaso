import Fastify from 'fastify';

// Bare-bones scaffolding only — no routes, models, or business logic yet.
// The system architecture (API structure, auth, persistence) hasn't been
// designed, so this just gets a server listening.
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({
  logger: true,
});

app
  .listen({ port: PORT, host: HOST })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
