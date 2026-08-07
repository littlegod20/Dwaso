# Multi-stage build for the API.
#
# The final image contains only the compiled output and production dependencies.
# Migrations ship alongside so Fly's release command can run them before the new
# version takes traffic — without that, a schema-dependent deploy would start
# serving requests against tables that do not yet exist.

FROM node:22.23.2-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.toml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter api...

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN pnpm turbo run build --filter=api...

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/packages/domain/dist ./packages/domain/dist
COPY --from=build /app/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=build /app/package.json ./package.json

WORKDIR /app/apps/api
EXPOSE 3000

# Migrations are the release command in fly.toml. The process here is only the
# server, so a failed migration never leaves a half-migrated instance taking
# traffic.
CMD ["node", "--import", "./dist/telemetry.js", "dist/server.js"]
