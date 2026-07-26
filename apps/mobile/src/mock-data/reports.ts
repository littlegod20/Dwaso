export const weeklyReport = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  revenue: [160, 175, 165, 195, 185, 200, 185],
  cost: [99, 108, 102, 121, 114, 124, 115],
};

export const totalRevenue = weeklyReport.revenue.reduce((sum, value) => sum + value, 0);
export const totalCost = weeklyReport.cost.reduce((sum, value) => sum + value, 0);

export type StockReconciliationEntry = {
  id: string;
  productName: string;
  expected: number;
  counted: number;
};

export const stockReconciliation: StockReconciliationEntry[] = [
  { id: 'rice-50kg-bag', productName: 'Rice 50kg', expected: 18, counted: 15 },
  { id: 'peak-milk-tin-400g', productName: 'Peak Milk Tin', expected: 12, counted: 13 },
];
