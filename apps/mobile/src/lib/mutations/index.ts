import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saleTotals } from '@dwaso/domain';
import { commitLocal, newId, type LocalWrite } from '../sync/outbox';
import { getProduct } from '../queries/products';
import { runSync } from '../sync/engine';

/**
 * Local writes.
 *
 * Every one of these builds a list of rows, commits them to SQLite and the
 * outbox atomically, and then *tries* to sync. The try is deliberately
 * fire-and-forget: the trader's write is already durable and already on screen,
 * so whether the network happens to be up is not her problem and must never be
 * presented as one.
 */
async function commitAndSync(writes: LocalWrite[]): Promise<void> {
  await commitLocal(writes);
  void runSync().catch(() => {
    // Failing here means the outbox still holds the mutation, which is exactly
    // where it should be. The sync loop will pick it up.
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

export type CreateProductInput = {
  name: string;
  category?: string | null;
  sku?: string | null;
  unit?: string;
  costPriceMinor: number;
  sellPriceMinor: number;
  lowStockThreshold?: number;
  isLooseGood?: boolean;
  openingQuantity?: number;
  barcode?: string | null;
};

export async function createProduct(input: CreateProductInput): Promise<string> {
  const productId = newId();
  const occurredAt = nowIso();

  const writes: LocalWrite[] = [
    {
      entity: 'product',
      op: 'upsert',
      entityId: productId,
      payload: {
        id: productId,
        name: input.name,
        category: input.category ?? null,
        sku: input.sku ?? null,
        unit: input.unit ?? 'unit',
        costPriceMinor: input.costPriceMinor,
        sellPriceMinor: input.sellPriceMinor,
        lowStockThreshold: input.lowStockThreshold ?? 5,
        isLooseGood: input.isLooseGood ?? false,
        defaultSupplierId: null,
        imageUrl: null,
        createdAt: occurredAt,
      },
    },
  ];

  // Opening stock is an `opening_balance` movement rather than a quantity field,
  // so the very first number in a product's life is already an auditable event.
  if (input.openingQuantity && input.openingQuantity > 0) {
    const movementId = newId();
    writes.push({
      entity: 'stock_movement',
      op: 'upsert',
      entityId: movementId,
      payload: {
        id: movementId,
        productId,
        delta: input.openingQuantity,
        reason: 'opening_balance',
        unitCostMinor: input.costPriceMinor,
        supplierId: null,
        saleId: null,
        note: null,
        occurredAt,
      },
    });
  }

  if (input.barcode) {
    const barcodeId = newId();
    writes.push({
      entity: 'product_barcode',
      op: 'upsert',
      entityId: barcodeId,
      payload: {
        id: barcodeId,
        productId,
        barcode: input.barcode,
        format: 'other',
        createdAt: occurredAt,
      },
    });
  }

  await commitAndSync(writes);
  return productId;
}

export type UpdatePriceInput = {
  productId: string;
  costPriceMinor: number;
  sellPriceMinor: number;
};

/**
 * Changes a price and records the change as an event.
 *
 * The event is what keeps historical margin honest: sale lines captured the old
 * cost at the time they were made, and the price-history sparkline reads from
 * here rather than inferring anything from the product's current values.
 */
export async function updatePrice(input: UpdatePriceInput): Promise<void> {
  const product = await getProduct(input.productId);
  if (!product) throw new Error('Product not found');

  const changeId = newId();
  const occurredAt = nowIso();

  await commitAndSync([
    {
      entity: 'product',
      op: 'upsert',
      entityId: product.id,
      payload: {
        id: product.id,
        name: product.name,
        category: product.category,
        sku: product.sku,
        unit: product.unit,
        costPriceMinor: input.costPriceMinor,
        sellPriceMinor: input.sellPriceMinor,
        lowStockThreshold: product.lowStockThreshold,
        isLooseGood: product.isLooseGood,
        defaultSupplierId: product.defaultSupplierId,
      },
    },
    {
      entity: 'price_change',
      op: 'upsert',
      entityId: changeId,
      payload: {
        id: changeId,
        productId: product.id,
        fromCostMinor: product.costPriceMinor,
        toCostMinor: input.costPriceMinor,
        fromSellMinor: product.sellPriceMinor,
        toSellMinor: input.sellPriceMinor,
        occurredAt,
      },
    },
  ]);
}

export type RestockInput = {
  productId: string;
  quantity: number;
  unitCostMinor: number;
  supplierId?: string | null;
};

export async function restock(input: RestockInput): Promise<void> {
  const movementId = newId();

  await commitAndSync([
    {
      entity: 'stock_movement',
      op: 'upsert',
      entityId: movementId,
      payload: {
        id: movementId,
        productId: input.productId,
        delta: input.quantity,
        reason: 'restock',
        unitCostMinor: input.unitCostMinor,
        supplierId: input.supplierId ?? null,
        saleId: null,
        note: null,
        occurredAt: nowIso(),
      },
    },
  ]);
}

export type ReconcileInput = {
  productId: string;
  countedQuantity: number;
  note?: string;
};

/**
 * Records a physical count.
 *
 * The trader reports what is on the shelf; the delta against the expected total
 * is derived here so nobody has to do the subtraction. That delta is the
 * shrinkage figure the reports tab shows.
 */
export async function reconcile(input: ReconcileInput): Promise<number> {
  const product = await getProduct(input.productId);
  if (!product) throw new Error('Product not found');

  const delta = input.countedQuantity - product.quantity;
  if (delta === 0) return 0;

  const movementId = newId();

  await commitAndSync([
    {
      entity: 'stock_movement',
      op: 'upsert',
      entityId: movementId,
      payload: {
        id: movementId,
        productId: input.productId,
        delta,
        reason: 'reconciliation',
        unitCostMinor: product.costPriceMinor,
        supplierId: null,
        saleId: null,
        note: input.note ?? null,
        occurredAt: nowIso(),
      },
    },
  ]);

  return delta;
}

export type SaleLineInput = {
  productId: string | null;
  description?: string | null;
  quantity: number;
  unitPriceMinor?: number;
};

export type RecordSaleInput = {
  lines: SaleLineInput[];
  paymentMethod?: 'cash' | 'credit' | 'mobile_money' | 'bank';
  creditorId?: string | null;
  note?: string | null;
};

/**
 * Records a sale and everything it implies, in one local transaction.
 *
 * A sale is not one row. It is the sale, its lines, a negative stock movement
 * per identified product, and — if it was on credit — a ledger entry. Writing
 * them together is what stops a device that dies mid-save from producing a sale
 * whose stock was never deducted, which is precisely the class of bug that makes
 * a trader stop trusting the app.
 */
export async function recordSale(input: RecordSaleInput): Promise<string> {
  const saleId = newId();
  const occurredAt = nowIso();

  const priced = await Promise.all(
    input.lines.map(async (line) => {
      const product = line.productId ? await getProduct(line.productId) : null;

      return {
        id: newId(),
        productId: line.productId,
        description: line.description ?? null,
        quantity: line.quantity,
        // Falls back to the product's current sell price, so the fast path —
        // scan, confirm, done — never asks for a price at all.
        unitPriceMinor: line.unitPriceMinor ?? product?.sellPriceMinor ?? 0,
        unitCostMinor: product?.costPriceMinor ?? 0,
      };
    }),
  );

  const totals = saleTotals(priced);
  const paymentMethod = input.paymentMethod ?? 'cash';

  if (paymentMethod === 'credit' && !input.creditorId) {
    throw new Error('A credit sale needs a customer');
  }

  const writes: LocalWrite[] = [
    {
      entity: 'sale',
      op: 'upsert',
      entityId: saleId,
      payload: {
        id: saleId,
        paymentMethod,
        creditorId: input.creditorId ?? null,
        totalMinor: totals.totalMinor,
        costTotalMinor: totals.costTotalMinor,
        note: input.note ?? null,
        occurredAt,
      },
    },
  ];

  for (const line of priced) {
    writes.push({
      entity: 'sale_item',
      op: 'upsert',
      entityId: line.id,
      payload: { ...line, saleId },
    });

    if (line.productId) {
      const movementId = newId();
      writes.push({
        entity: 'stock_movement',
        op: 'upsert',
        entityId: movementId,
        payload: {
          id: movementId,
          productId: line.productId,
          delta: -line.quantity,
          reason: 'sale',
          unitCostMinor: line.unitCostMinor,
          supplierId: null,
          saleId,
          note: null,
          occurredAt,
        },
      });
    }
  }

  if (paymentMethod === 'credit' && input.creditorId) {
    const entryId = newId();
    writes.push({
      entity: 'credit_ledger_entry',
      op: 'upsert',
      entityId: entryId,
      payload: {
        id: entryId,
        creditorId: input.creditorId,
        kind: 'credit_sale',
        amountMinor: totals.totalMinor,
        saleId,
        note: null,
        occurredAt,
      },
    });
  }

  await commitAndSync(writes);
  return saleId;
}

export function quickSale(productId: string, quantity = 1): Promise<string> {
  return recordSale({ lines: [{ productId, quantity }] });
}

export type CreateCreditorInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  dueDate?: string | null;
  note?: string | null;
  openingBalanceMinor?: number;
  source?: 'manual' | 'contact_import';
};

export async function createCreditor(input: CreateCreditorInput): Promise<string> {
  const creditorId = newId();
  const occurredAt = nowIso();

  const writes: LocalWrite[] = [
    {
      entity: 'creditor',
      op: 'upsert',
      entityId: creditorId,
      payload: {
        id: creditorId,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        dueDate: input.dueDate ?? null,
        note: input.note ?? null,
        remindersOptedOut: false,
        source: input.source ?? 'manual',
        createdAt: occurredAt,
      },
    },
  ];

  // An opening balance is an adjustment entry, never a stored balance field —
  // the same reason stock has no quantity column.
  if (input.openingBalanceMinor && input.openingBalanceMinor > 0) {
    const entryId = newId();
    writes.push({
      entity: 'credit_ledger_entry',
      op: 'upsert',
      entityId: entryId,
      payload: {
        id: entryId,
        creditorId,
        kind: 'adjustment',
        amountMinor: input.openingBalanceMinor,
        saleId: null,
        note: 'Opening balance',
        occurredAt,
      },
    });
  }

  await commitAndSync(writes);
  return creditorId;
}

export async function recordPayment(
  creditorId: string,
  amountMinor: number,
  note?: string,
): Promise<void> {
  const entryId = newId();

  await commitAndSync([
    {
      entity: 'credit_ledger_entry',
      op: 'upsert',
      entityId: entryId,
      payload: {
        id: entryId,
        creditorId,
        kind: 'payment',
        // Negative: a payment reduces what is owed, and keeping the sign in the
        // amount means a balance stays a plain sum.
        amountMinor: -Math.abs(amountMinor),
        saleId: null,
        note: note ?? null,
        occurredAt: nowIso(),
      },
    },
  ]);
}

/** Wraps a local write so screens get pending state and automatic refetching. */
export function useLocalMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
