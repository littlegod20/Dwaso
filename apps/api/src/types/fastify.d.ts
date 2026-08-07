import type { Redis } from 'ioredis';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '../config/env.js';
import type { Database } from '../db/client.js';
import type { TenantContext } from '../lib/tenant.js';
import type { SmsProvider } from '../providers/sms.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    db: Database;
    redis: Redis;
    sms: SmsProvider;
    /** Verifies the access token and populates `request.auth` and `request.tenant`. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    auth?: {
      userId: string;
      /** Null between first login and business setup, when the trader has an
       * account but not yet a shop. */
      shopId: string | null;
      deviceId: string;
      role: 'owner' | 'staff';
    };
    /** Mirrors auth.shopId for the rate limiter's key generator. */
    shopId?: string;
    /**
     * Tenant-scoped handle every repository requires. Constructing one is the
     * only way to reach shop data, which makes scoping structural rather than a
     * convention someone has to remember.
     */
    tenant?: TenantContext;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      shopId: string | null;
      deviceId: string;
      role: 'owner' | 'staff';
    };
    user: {
      sub: string;
      shopId: string | null;
      deviceId: string;
      role: 'owner' | 'staff';
    };
  }
}
