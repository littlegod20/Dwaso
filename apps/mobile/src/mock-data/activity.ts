export type ActivityDirection = 'in' | 'out';

export type ActivityEntry = {
  id: string;
  direction: ActivityDirection;
  title: string;
  time: string;
  amount: number;
};

export const recentActivity: ActivityEntry[] = [
  { id: 'a1', direction: 'in', title: 'Sold Peak Milk x3', time: '2:14pm', amount: 30.0 },
  { id: 'a2', direction: 'out', title: 'Restocked Rice 50kg', time: '11:02am', amount: -930.0 },
  { id: 'a3', direction: 'in', title: 'Sold Indomie carton', time: '10:41am', amount: 58.0 },
  { id: 'a4', direction: 'in', title: 'Sold Golden Morn x2', time: '9:57am', amount: 34.0 },
];
