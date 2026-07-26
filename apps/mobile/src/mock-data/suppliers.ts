export type Supplier = {
  id: string;
  name: string;
  distanceKm: number;
  type: string;
  category: string;
  phone: string;
  highlighted?: boolean;
};

export const suppliers: Supplier[] = [
  {
    id: 'kwame-wholesale',
    name: 'Kwame Wholesale Foods',
    distanceKm: 1.2,
    type: 'Wholesale',
    category: 'Grains',
    phone: '0244 118 8820',
    highlighted: true,
  },
  {
    id: 'osei-and-sons',
    name: 'Osei & Sons Trading',
    distanceKm: 2.6,
    type: 'Distributor',
    category: 'Staples',
    phone: '0209 552 3341',
  },
  {
    id: 'makola-bulk-market',
    name: 'Makola Bulk Market',
    distanceKm: 3.4,
    type: 'Market stall',
    category: 'Grains, oils',
    phone: '0501 774 2298',
  },
];
