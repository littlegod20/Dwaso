import type { ProductStatus } from '@/mock-data/products';

export function getStatusMeta(status: ProductStatus): {
  label: string;
  variant: 'success' | 'warning' | 'danger';
} {
  switch (status) {
    case 'in-stock':
      return { label: 'In stock', variant: 'success' };
    case 'low':
      return { label: 'Low', variant: 'warning' };
    case 'out-of-stock':
      return { label: 'Out of stock', variant: 'danger' };
  }
}
