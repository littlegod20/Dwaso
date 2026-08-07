import { useQuery } from '@tanstack/react-query';
import type { ProductStatus } from '@dwaso/shared-types';
import { marginMinor, marginPercent, productStatus } from '@dwaso/domain';
import { getDatabase } from '../db';
import { queryKeys } from './keys';

export type ProductListItem = {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  unit: string;
  costPriceMinor: number;
  sellPriceMinor: number;
  lowStockThreshold: number;
  isLooseGood: boolean;
  defaultSupplierId: string | null;
  quantity: number;
  status: ProductStatus;
  marginMinor: number;
  marginPercent: number;
};

type ProductRow = Omit<
  ProductListItem,
  'status' | 'marginMinor' | 'marginPercent' | 'isLooseGood'
> & { isLooseGood: number };

/**
 * Quantity comes from a `SUM` over the movement log rather than a stored
 * counter, exactly as the server derives it. That is what lets a sale recorded
 * with no signal move the stock level on screen immediately: the number the
 * trader sees is computed from events she just wrote locally, not fetched.
 */
const PRODUCT_SELECT = `
  SELECT
    p.id,
    p.name,
    p.category,
    p.sku,
    p.unit,
    p.costPriceMinor,
    p.sellPriceMinor,
    p.lowStockThreshold,
    p.isLooseGood,
    p.defaultSupplierId,
    COALESCE((
      SELECT SUM(m.delta) FROM stock_movements m
      WHERE m.productId = p.id AND m.deletedAt IS NULL
    ), 0) AS quantity
  FROM products p
  WHERE p.deletedAt IS NULL
`;

function decorate(row: ProductRow): ProductListItem {
  return {
    ...row,
    isLooseGood: row.isLooseGood === 1,
    quantity: Number(row.quantity),
    status: productStatus(Number(row.quantity), row.lowStockThreshold),
    marginMinor: marginMinor(row.sellPriceMinor, row.costPriceMinor),
    marginPercent: marginPercent(row.sellPriceMinor, row.costPriceMinor),
  };
}

export async function listProducts(search?: string): Promise<ProductListItem[]> {
  const db = await getDatabase();

  const rows = search
    ? await db.getAllAsync<ProductRow>(
        `${PRODUCT_SELECT} AND (p.name LIKE ? OR p.sku LIKE ?) ORDER BY p.name COLLATE NOCASE`,
        `%${search}%`,
        `%${search}%`,
      )
    : await db.getAllAsync<ProductRow>(`${PRODUCT_SELECT} ORDER BY p.name COLLATE NOCASE`);

  return rows.map(decorate);
}

export async function getProduct(id: string): Promise<ProductListItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ProductRow>(`${PRODUCT_SELECT} AND p.id = ?`, id);
  return row ? decorate(row) : null;
}

export function useProducts(search?: string) {
  return useQuery({
    queryKey: [...queryKeys.products, search ?? ''],
    queryFn: () => listProducts(search),
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(id ?? ''),
    queryFn: () => getProduct(id!),
    enabled: Boolean(id),
  });
}

export type RestockEntry = {
  id: string;
  delta: number;
  unitCostMinor: number | null;
  supplierName: string | null;
  occurredAt: string;
  totalCostMinor: number;
};

export function useRestockHistory(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.productMovements(productId ?? ''),
    enabled: Boolean(productId),
    queryFn: async (): Promise<RestockEntry[]> => {
      const db = await getDatabase();

      const rows = await db.getAllAsync<{
        id: string;
        delta: number;
        unitCostMinor: number | null;
        supplierName: string | null;
        occurredAt: string;
      }>(
        `SELECT m.id, m.delta, m.unitCostMinor, s.name AS supplierName, m.occurredAt
         FROM stock_movements m
         LEFT JOIN suppliers s ON s.id = m.supplierId
         WHERE m.productId = ? AND m.reason = 'restock' AND m.deletedAt IS NULL
         ORDER BY m.occurredAt DESC
         LIMIT 20`,
        productId!,
      );

      return rows.map((row) => ({
        ...row,
        totalCostMinor: row.delta * (row.unitCostMinor ?? 0),
      }));
    },
  });
}

export type PriceHistoryPoint = {
  id: string;
  occurredAt: string;
  fromSellMinor: number | null;
  toSellMinor: number | null;
  fromCostMinor: number | null;
  toCostMinor: number | null;
};

export function usePriceHistory(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.productPriceHistory(productId ?? ''),
    enabled: Boolean(productId),
    queryFn: async (): Promise<PriceHistoryPoint[]> => {
      const db = await getDatabase();

      return db.getAllAsync<PriceHistoryPoint>(
        `SELECT id, occurredAt, fromSellMinor, toSellMinor, fromCostMinor, toCostMinor
         FROM price_changes
         WHERE productId = ? AND deletedAt IS NULL
         ORDER BY occurredAt ASC
         LIMIT 30`,
        productId!,
      );
    },
  });
}

/** Resolves a scanned barcode against the local catalog, with no network call. */
export async function findProductByBarcode(barcode: string): Promise<ProductListItem | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ productId: string }>(
    'SELECT productId FROM product_barcodes WHERE barcode = ? AND deletedAt IS NULL LIMIT 1',
    barcode,
  );

  return row ? getProduct(row.productId) : null;
}
