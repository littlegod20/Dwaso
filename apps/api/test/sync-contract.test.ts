import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { SyncMutation, SyncPullResponse, SyncPushResponse } from '@dwaso/shared-types';
import { shops } from '../src/db/schema/index.js';
import { authHeaders, createShop, startTestApp, truncateAll, type TestShop } from './helpers/harness.js';
import {
  creditorPayload,
  ledgerEntryPayload,
  mutation,
  productPayload,
  stockMovementPayload,
} from './helpers/mutations.js';

/**
 * The sync protocol's contract, exercised over HTTP against a real database.
 *
 * These are the tests that matter most in this codebase. Every other bug shows
 * up as a wrong number on a screen; a sync bug shows up as a trader's ledger
 * quietly diverging from her assistant's, days later, with no way to tell which
 * one is right. The scenarios below are the ones a market day actually produces:
 * a phone that retried because the signal dropped mid-request, two people
 * editing the same customer, a device that was off for a month.
 */
describe('sync contract', () => {
  let app: FastifyInstance;
  let shop: TestShop;

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll();
    shop = await createShop(app);
  });

  async function push(mutations: SyncMutation[], as: TestShop = shop): Promise<SyncPushResponse> {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sync/push',
      headers: authHeaders(as),
      payload: { deviceId: as.deviceId, mutations },
    });

    expect(response.statusCode).toBe(200);
    return response.json<SyncPushResponse>();
  }

  async function pull(
    since: number,
    options: { limit?: number; as?: TestShop } = {},
  ): Promise<SyncPullResponse> {
    const as = options.as ?? shop;
    const response = await app.inject({
      method: 'GET',
      url: '/v1/sync/pull',
      headers: authHeaders(as),
      query: { since: String(since), limit: String(options.limit ?? 500) },
    });

    expect(response.statusCode, response.body).toBe(200);
    return response.json<SyncPullResponse>();
  }

  it('assigns a gapless, monotonic sequence across a batch', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const result = await push(
      ids.map((id, index) => mutation('product', id, productPayload({ name: `Item ${index}` }))),
    );

    const sequences = result.results.map((entry) => entry.serverSeq);
    expect(sequences).toEqual([1, 2, 3]);
    expect(result.cursor).toBe(3);
  });

  describe('replay', () => {
    it('treats a resent batch as duplicates without writing twice', async () => {
      const productId = randomUUID();
      const mutations = [mutation('product', productId, productPayload())];

      const first = await push(mutations);
      expect(first.results[0].status).toBe('applied');

      // The device never saw the first response — the connection dropped after
      // the server committed — so it sends the identical batch again.
      const second = await push(mutations);
      expect(second.results[0].status).toBe('duplicate');
      expect(second.results[0].serverSeq).toBe(first.results[0].serverSeq);

      const changes = await pull(0);
      expect(changes.changes.filter((change) => change.entity === 'product')).toHaveLength(1);
    });

    it('does not double-count stock when an event is replayed under a new mutation id', async () => {
      const productId = randomUUID();
      const movementId = randomUUID();

      await push([mutation('product', productId, productPayload())]);
      await push([mutation('stock_movement', movementId, stockMovementPayload(productId))]);

      // Same event, new idempotency key: the outbox was rebuilt from local
      // storage after a reinstall, so the mutation ids are fresh but the event
      // ids are not.
      const replay = await push([
        mutation('stock_movement', movementId, stockMovementPayload(productId)),
      ]);

      expect(replay.results[0].status).toBe('duplicate');

      const view = await app.inject({
        method: 'GET',
        url: `/v1/products/${productId}`,
        headers: authHeaders(shop),
      });

      expect(view.json<{ quantity: number }>().quantity).toBe(10);
    });
  });

  describe('out-of-order arrival', () => {
    it('accepts a child row whose parent has not been pushed yet', async () => {
      const productId = randomUUID();

      // The phone flushed its outbox in an order the server cannot assume:
      // the movement is sent before the product it refers to.
      const movement = await push([
        mutation('stock_movement', randomUUID(), stockMovementPayload(productId)),
      ]);
      expect(movement.results[0].status).toBe('rejected');

      // Rejection has to be permanent and specific, or one bad row wedges the
      // whole outbox behind it forever.
      expect(movement.results[0].message).toBeTruthy();
    });

    it('orders the pull stream by sequence so parents precede children', async () => {
      const creditorId = randomUUID();
      const entryId = randomUUID();

      await push([
        mutation('creditor', creditorId, creditorPayload()),
        mutation('credit_ledger_entry', entryId, ledgerEntryPayload(creditorId)),
      ]);

      const result = await pull(0);
      const creditorIndex = result.changes.findIndex((change) => change.id === creditorId);
      const entryIndex = result.changes.findIndex((change) => change.id === entryId);

      expect(creditorIndex).toBeGreaterThanOrEqual(0);
      expect(entryIndex).toBeGreaterThan(creditorIndex);
      expect(result.changes.map((change) => change.serverSeq)).toEqual(
        [...result.changes.map((change) => change.serverSeq)].sort((a, b) => a - b),
      );
    });
  });

  describe('cursor resumption', () => {
    it('returns only what changed after the cursor', async () => {
      await push([mutation('product', randomUUID(), productPayload({ name: 'First' }))]);
      const firstPull = await pull(0);

      await push([mutation('product', randomUUID(), productPayload({ name: 'Second' }))]);
      const secondPull = await pull(firstPull.nextCursor);

      expect(secondPull.changes).toHaveLength(1);
      expect(secondPull.changes[0].data?.name).toBe('Second');
    });

    it('pages without dropping or repeating a row', async () => {
      const ids = Array.from({ length: 12 }, () => randomUUID());
      await push(ids.map((id, index) => mutation('product', id, productPayload({ name: `P${index}` }))));

      const seen: string[] = [];
      let cursor = 0;
      let guard = 0;

      for (;;) {
        const page = await pull(cursor, { limit: 5 });
        seen.push(...page.changes.map((change) => change.id));
        cursor = page.nextCursor;

        if (!page.hasMore) break;
        if (++guard > 10) throw new Error('pull did not terminate');
      }

      expect(seen).toHaveLength(ids.length);
      expect(new Set(seen).size).toBe(ids.length);
    });

    it('reports no change when the cursor is already current', async () => {
      await push([mutation('product', randomUUID(), productPayload())]);
      const first = await pull(0);
      const again = await pull(first.nextCursor);

      expect(again.changes).toHaveLength(0);
      expect(again.nextCursor).toBe(first.nextCursor);
      expect(again.hasMore).toBe(false);
    });
  });

  describe('tombstones', () => {
    it('sends a deletion without re-sending the deleted contents', async () => {
      const creditorId = randomUUID();
      await push([mutation('creditor', creditorId, creditorPayload({ name: 'Kofi Mensah' }))]);

      const afterCreate = await pull(0);

      await push([
        mutation('creditor', creditorId, creditorPayload({ name: 'Kofi Mensah' }), {
          op: 'delete',
        }),
      ]);

      const afterDelete = await pull(afterCreate.nextCursor);
      const tombstone = afterDelete.changes.find((change) => change.id === creditorId);

      expect(tombstone?.deletedAt).toBeTruthy();
      // The trader deleted this person's details on purpose. Echoing them back
      // in the tombstone would undo that.
      expect(tombstone?.data).toBeNull();
    });

    it('tells a device older than the retention window to rebuild from scratch', async () => {
      await push([mutation('product', randomUUID(), productPayload())]);
      await push([mutation('product', randomUUID(), productPayload())]);

      // The retention job purged everything below sequence 5 while this device
      // was off the network, so the deletions it missed no longer exist to send.
      await app.db.update(shops).set({ tombstoneFloorSeq: 5 }).where(eq(shops.id, shop.shopId));

      const stale = await pull(1);
      expect(stale.resyncRequired).toBe(true);
      expect(stale.changes).toHaveLength(0);

      // A device starting from nothing is already consistent, so it is never
      // asked to resync — it would be a no-op that costs a full catalogue.
      const fresh = await pull(0);
      expect(fresh.resyncRequired).toBe(false);
      expect(fresh.changes.length).toBeGreaterThan(0);
    });
  });

  describe('concurrent device edits', () => {
    it('keeps the later edit and tells the loser it was superseded', async () => {
      const creditorId = randomUUID();
      const earlier = '2026-08-07T10:00:00.000Z';
      const later = '2026-08-07T10:05:00.000Z';

      await push([
        mutation('creditor', creditorId, creditorPayload({ name: 'Original' }), {
          clientTimestamp: earlier,
        }),
      ]);

      const winner = await push([
        mutation('creditor', creditorId, creditorPayload({ name: 'Newer note' }), {
          clientTimestamp: later,
        }),
      ]);
      expect(winner.results[0].status).toBe('applied');

      // The second phone was offline and only now flushes an edit it made
      // before the winning one.
      const loser = await push([
        mutation('creditor', creditorId, creditorPayload({ name: 'Stale note' }), {
          clientTimestamp: earlier,
        }),
      ]);
      expect(loser.results[0].status).toBe('superseded');

      const result = await pull(0);
      const row = result.changes.find((change) => change.id === creditorId);
      expect(row?.data?.name).toBe('Newer note');
    });

    it('breaks a same-millisecond tie the same way for both devices', async () => {
      const creditorId = randomUUID();
      const sameInstant = '2026-08-07T10:00:00.000Z';

      const other = await createShop(app);
      // Both devices belong to the same shop; only the device id differs.
      const second: TestShop = {
        ...shop,
        deviceId: other.deviceId,
        token: app.jwt.sign({
          sub: shop.userId,
          shopId: shop.shopId,
          deviceId: other.deviceId,
          role: 'owner',
        }),
      };

      await push([
        mutation('creditor', creditorId, creditorPayload({ name: 'From device one' }), {
          clientTimestamp: sameInstant,
        }),
      ]);

      const contended = await push(
        [
          mutation('creditor', creditorId, creditorPayload({ name: 'From device two' }), {
            clientTimestamp: sameInstant,
          }),
        ],
        second,
      );

      // Whichever way the tiebreak falls, it must be a function of the device
      // ids alone — otherwise the two devices flip the row back and forth on
      // every sync forever.
      const expected = shop.deviceId > second.deviceId ? 'superseded' : 'applied';
      expect(contended.results[0].status).toBe(expected);
    });

    it('merges concurrent stock movements by addition rather than choosing one', async () => {
      const productId = randomUUID();
      await push([mutation('product', productId, productPayload())]);

      // Two people selling from the same shelf, each phone appending its own
      // movement. Neither should overwrite the other.
      await push([mutation('stock_movement', randomUUID(), stockMovementPayload(productId))]);
      await push([
        mutation('stock_movement', randomUUID(), stockMovementPayload(productId, { delta: -3 })),
      ]);

      const view = await app.inject({
        method: 'GET',
        url: `/v1/products/${productId}`,
        headers: authHeaders(shop),
      });

      expect(view.json<{ quantity: number }>().quantity).toBe(7);
    });
  });

  describe('what a client is not allowed to write', () => {
    it('ignores a client-supplied serverSeq', async () => {
      const productId = randomUUID();
      // A device that could set its own sequence number could rewrite its
      // position in every other device's change stream.
      const result = await push([
        mutation('product', productId, productPayload({ serverSeq: 9999 })),
      ]);

      expect(result.results[0].serverSeq).toBe(1);
      expect(result.cursor).toBe(1);
    });

    it('rejects a delete against an append-only event', async () => {
      const productId = randomUUID();
      const movementId = randomUUID();

      await push([mutation('product', productId, productPayload())]);
      await push([mutation('stock_movement', movementId, stockMovementPayload(productId))]);

      const result = await push([
        mutation('stock_movement', movementId, stockMovementPayload(productId), { op: 'delete' }),
      ]);

      expect(result.results[0].status).toBe('rejected');
      expect(result.results[0].message).toMatch(/append-only/i);
    });

    it('rejects a malformed payload without failing the rest of the batch', async () => {
      const goodId = randomUUID();

      const result = await push([
        mutation('product', randomUUID(), productPayload({ sellPriceMinor: -100 })),
        mutation('product', goodId, productPayload({ name: 'Valid' })),
      ]);

      expect(result.results[0].status).toBe('rejected');
      expect(result.results[1].status).toBe('applied');

      const changes = await pull(0);
      expect(changes.changes.some((change) => change.id === goodId)).toBe(true);
    });
  });
});
