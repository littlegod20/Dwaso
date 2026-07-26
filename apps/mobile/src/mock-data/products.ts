export type ProductStatus = 'in-stock' | 'low' | 'out-of-stock';

export type RestockEntry = {
  id: string;
  unitsAdded: number;
  supplier: string;
  date: string;
  totalCost: number;
};

export type PriceChange = {
  date: string;
  from: number;
  to: number;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  sku: string;
  quantity: number;
  costPrice: number;
  sellPrice: number;
  status: ProductStatus;
  supplier: string;
  lastPriceChange?: PriceChange;
  restockLog: RestockEntry[];
};

export const products: Product[] = [
  {
    id: 'peak-milk-tin-400g',
    name: 'Peak Milk Tin 400g',
    category: 'Dairy',
    sku: 'PM-400',
    quantity: 12,
    costPrice: 8.5,
    sellPrice: 10.0,
    status: 'low',
    supplier: 'Kwame Wholesale Foods',
    lastPriceChange: { date: 'Jul 12', from: 9.5, to: 10.0 },
    restockLog: [
      { id: 'r1', unitsAdded: 30, supplier: 'Kwame Wholesale', date: 'Jul 10', totalCost: 255.0 },
      { id: 'r2', unitsAdded: 24, supplier: 'Kwame Wholesale', date: 'Jun 28', totalCost: 204.0 },
    ],
  },
  {
    id: 'golden-morn-900g',
    name: 'Golden Morn 900g',
    category: 'Cereal',
    sku: 'GM-900',
    quantity: 38,
    costPrice: 14.2,
    sellPrice: 17.0,
    status: 'in-stock',
    supplier: "Osei & Sons Trading",
    restockLog: [
      { id: 'r1', unitsAdded: 40, supplier: 'Osei & Sons', date: 'Jul 8', totalCost: 568.0 },
    ],
  },
  {
    id: 'rice-50kg-bag',
    name: 'Rice 50kg Bag',
    category: 'Grains',
    sku: 'RC-50K',
    quantity: 0,
    costPrice: 62.0,
    sellPrice: 75.0,
    status: 'out-of-stock',
    supplier: 'Makola Bulk Market',
    restockLog: [
      { id: 'r1', unitsAdded: 15, supplier: 'Makola Bulk Market', date: 'Jun 30', totalCost: 930.0 },
    ],
  },
  {
    id: 'indomie-carton-40pk',
    name: 'Indomie Carton (40pk)',
    category: 'Noodles',
    sku: 'IN-40',
    quantity: 21,
    costPrice: 48.0,
    sellPrice: 58.0,
    status: 'in-stock',
    supplier: 'Kwame Wholesale Foods',
    restockLog: [
      { id: 'r1', unitsAdded: 20, supplier: 'Kwame Wholesale', date: 'Jul 5', totalCost: 960.0 },
    ],
  },
  {
    id: 'milo-tin-400g',
    name: 'Milo Tin 400g',
    category: 'Beverages',
    sku: 'ML-400',
    quantity: 5,
    costPrice: 12.8,
    sellPrice: 16.0,
    status: 'low',
    supplier: 'Kwame Wholesale Foods',
    restockLog: [
      { id: 'r1', unitsAdded: 18, supplier: 'Kwame Wholesale', date: 'Jun 22', totalCost: 230.4 },
    ],
  },
  {
    id: 'sugar-1kg',
    name: 'Sugar 1kg Bag',
    category: 'Baking',
    sku: 'SG-1K',
    quantity: 9,
    costPrice: 6.4,
    sellPrice: 8.0,
    status: 'low',
    supplier: 'Osei & Sons Trading',
    restockLog: [],
  },
  {
    id: 'cooking-oil-5l',
    name: 'Cooking Oil 5L',
    category: 'Oils',
    sku: 'CO-5L',
    quantity: 26,
    costPrice: 42.0,
    sellPrice: 50.0,
    status: 'in-stock',
    supplier: 'Makola Bulk Market',
    restockLog: [],
  },
  {
    id: 'tomato-paste-carton',
    name: 'Tomato Paste Carton',
    category: 'Canned Goods',
    sku: 'TP-CT',
    quantity: 14,
    costPrice: 36.0,
    sellPrice: 44.0,
    status: 'in-stock',
    supplier: 'Osei & Sons Trading',
    restockLog: [],
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}
