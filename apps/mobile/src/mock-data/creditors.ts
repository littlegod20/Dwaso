export type CreditorStatus = 'overdue' | 'upcoming' | 'paid';

export type PaymentHistoryEntry = {
  id: string;
  type: 'sale' | 'payment';
  label: string;
  date: string;
  amount: number;
};

export type Creditor = {
  id: string;
  name: string;
  phone: string;
  balance: number;
  status: CreditorStatus;
  dueDate: string;
  daysOverdue?: number;
  daysUntilDue?: number;
  history: PaymentHistoryEntry[];
};

export const creditors: Creditor[] = [
  {
    id: 'mama-ngozi',
    name: 'Mama Ngozi',
    phone: '0803 442 1187',
    balance: 156.0,
    status: 'overdue',
    dueDate: 'Jul 3',
    daysOverdue: 5,
    history: [
      { id: 'h1', type: 'sale', label: 'Sale on credit · Rice, Milo', date: 'Jul 3', amount: 156.0 },
      { id: 'h2', type: 'payment', label: 'Payment received', date: 'Jun 20', amount: -80.0 },
      { id: 'h3', type: 'sale', label: 'Sale on credit · Sugar', date: 'Jun 18', amount: 80.0 },
    ],
  },
  {
    id: 'fatima-sani',
    name: 'Fatima Sani',
    phone: '0805 221 9034',
    balance: 410.0,
    status: 'overdue',
    dueDate: 'Jul 6',
    daysOverdue: 2,
    history: [
      { id: 'h1', type: 'sale', label: 'Sale on credit · Rice, Oil', date: 'Jul 6', amount: 410.0 },
    ],
  },
  {
    id: 'chukwuemeka-e',
    name: 'Chukwuemeka E.',
    phone: '0701 556 8820',
    balance: 258.0,
    status: 'overdue',
    dueDate: 'Jul 7',
    daysOverdue: 1,
    history: [
      { id: 'h1', type: 'sale', label: 'Sale on credit · Indomie carton', date: 'Jul 7', amount: 258.0 },
    ],
  },
  {
    id: 'kwabena-asante',
    name: 'Kwabena Asante',
    phone: '0244 771 3302',
    balance: 90.0,
    status: 'upcoming',
    dueDate: 'Jul 12',
    daysUntilDue: 4,
    history: [
      { id: 'h1', type: 'sale', label: 'Sale on credit · Sugar, Milk', date: 'Jul 5', amount: 90.0 },
    ],
  },
  {
    id: 'yaa-boateng',
    name: 'Yaa Boateng',
    phone: '0209 884 4471',
    balance: 0,
    status: 'paid',
    dueDate: 'Jun 28',
    history: [
      { id: 'h1', type: 'payment', label: 'Payment received', date: 'Jun 28', amount: -120.0 },
      { id: 'h2', type: 'sale', label: 'Sale on credit · Rice', date: 'Jun 15', amount: 120.0 },
    ],
  },
  {
    id: 'efua-mensah',
    name: 'Efua Mensah',
    phone: '0554 210 6689',
    balance: 120.0,
    status: 'upcoming',
    dueDate: 'Jul 15',
    daysUntilDue: 7,
    history: [
      { id: 'h1', type: 'sale', label: 'Sale on credit · Cooking oil', date: 'Jul 8', amount: 120.0 },
    ],
  },
  {
    id: 'ibrahim-musa',
    name: 'Ibrahim Musa',
    phone: '0277 903 4415',
    balance: 0,
    status: 'paid',
    dueDate: 'Jun 20',
    history: [
      { id: 'h1', type: 'payment', label: 'Payment received', date: 'Jun 20', amount: -65.0 },
    ],
  },
  {
    id: 'adaeze-okafor',
    name: 'Adaeze Okafor',
    phone: '0812 336 7754',
    balance: 65.0,
    status: 'upcoming',
    dueDate: 'Jul 10',
    daysUntilDue: 2,
    history: [
      { id: 'h1', type: 'sale', label: 'Sale on credit · Milo', date: 'Jul 3', amount: 65.0 },
    ],
  },
  {
    id: 'kojo-antwi',
    name: 'Kojo Antwi',
    phone: '0501 662 9938',
    balance: 200.0,
    status: 'upcoming',
    dueDate: 'Jul 18',
    daysUntilDue: 10,
    history: [
      { id: 'h1', type: 'sale', label: 'Sale on credit · Rice, Sugar', date: 'Jul 8', amount: 200.0 },
    ],
  },
];

export function getCreditorById(id: string): Creditor | undefined {
  return creditors.find((creditor) => creditor.id === id);
}
