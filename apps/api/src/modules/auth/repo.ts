import { and, eq, isNull, desc } from 'drizzle-orm';
import type { Database, Executor } from '../../db/client.js';
import { devices, refreshTokens, users } from '../../db/schema/identity.js';
import { shopMembers, shops } from '../../db/schema/shops.js';

/**
 * Identity is deliberately not tenant-scoped: a user exists before any shop
 * does, and one day may belong to more than one. These functions take the raw
 * executor rather than a TenantContext for that reason — they are the only
 * repository in the codebase that does.
 */

export async function findUserByPhone(db: Executor, phone: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.phone, phone), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function findUserById(db: Executor, id: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function createUser(db: Executor, phone: string) {
  const [user] = await db.insert(users).values({ phone }).returning();
  return user;
}

export async function upsertDevice(
  db: Executor,
  input: { id: string; userId: string; label?: string; platform: 'ios' | 'android' | 'web' | 'unknown' },
) {
  const [device] = await db
    .insert(devices)
    .values({
      id: input.id,
      userId: input.userId,
      label: input.label ?? null,
      platform: input.platform,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: devices.id,
      set: { lastSeenAt: new Date(), label: input.label ?? null, platform: input.platform },
    })
    .returning();
  return device;
}

export async function findPrimaryMembership(db: Executor, userId: string) {
  const [membership] = await db
    .select({
      shopId: shopMembers.shopId,
      role: shopMembers.role,
      shopName: shops.name,
      currency: shops.currency,
    })
    .from(shopMembers)
    .innerJoin(shops, eq(shops.id, shopMembers.shopId))
    .where(and(eq(shopMembers.userId, userId), isNull(shops.deletedAt)))
    .orderBy(desc(shopMembers.createdAt))
    .limit(1);
  return membership ?? null;
}

export async function createRefreshToken(
  db: Executor,
  input: { userId: string; deviceId: string; tokenHash: string; expiresAt: Date },
) {
  const [token] = await db.insert(refreshTokens).values(input).returning();
  return token;
}

export async function findRefreshTokenByHash(db: Executor, tokenHash: string) {
  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);
  return token ?? null;
}

export async function markRefreshTokenRotated(db: Executor, id: string, replacedBy: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), replacedBy })
    .where(eq(refreshTokens.id, id));
}

/**
 * Revokes every token issued to a device.
 *
 * Called when an already-rotated token is presented, which means the token was
 * captured: the legitimate device and the attacker now both hold credentials, and
 * there is no way to tell which is which, so both are cut off.
 */
export async function revokeDeviceTokens(db: Executor, deviceId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.deviceId, deviceId), isNull(refreshTokens.revokedAt)));
}

export async function listUserDevices(db: Database, userId: string) {
  return db
    .select({
      id: devices.id,
      label: devices.label,
      platform: devices.platform,
      lastSeenAt: devices.lastSeenAt,
      createdAt: devices.createdAt,
    })
    .from(devices)
    .where(eq(devices.userId, userId))
    .orderBy(desc(devices.lastSeenAt));
}

export async function deleteDevice(db: Database, userId: string, deviceId: string) {
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
    .limit(1);

  if (!device) return false;

  await revokeDeviceTokens(db, deviceId);
  await db.delete(devices).where(eq(devices.id, deviceId));
  return true;
}
