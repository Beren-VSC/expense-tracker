export interface ExpenseItem {
  id: number;
  desc: string;
  date: string;
  amt: number;
  receipt: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  th: string;
  icon: string;
  color: string;
  budget: number;
  spent: number;
  count: number;
  items: ExpenseItem[];
}

export interface IncomeItem {
  id: number;
  desc: string;
  date: string;
  amt: number;
  receipt: boolean;
}

export interface IncomeCategory {
  id: string;
  name: string;
  th: string;
  icon: string;
  color: string;
  items: IncomeItem[];
}

export interface MonthHistory {
  label: string;
  spent: number;
  budget: number;
}

export interface IncomeHistory {
  label: string;
  income: number;
}

export const INIT_CATS: ExpenseCategory[] = [
  { id: 'food', name: 'Food & Dining', th: 'อาหาร', icon: '🍜', color: '#f4875a', budget: 6000, spent: 4800, count: 14, items: [
    { id: 1, desc: 'MK Suki',      date: 'May 24', amt: 680,  receipt: true  },
    { id: 2, desc: 'Tops Market',  date: 'May 22', amt: 430,  receipt: true  },
    { id: 3, desc: 'Grab Food',    date: 'May 21', amt: 215,  receipt: false },
    { id: 4, desc: 'After You',    date: 'May 18', amt: 290,  receipt: true  },
    { id: 5, desc: "Lotus's",      date: 'May 15', amt: 1120, receipt: true  },
  ]},
  { id: 'drinks', name: 'Drinks', th: 'เครื่องดื่ม', icon: '☕', color: '#3ecfcf', budget: 1000, spent: 640, count: 5, items: [
    { id: 20, desc: 'Starbucks',      date: 'May 23', amt: 180, receipt: true  },
    { id: 21, desc: 'Smoothie',       date: 'May 20', amt: 90,  receipt: false },
    { id: 22, desc: 'Iced Coffee ×3', date: 'May 18', amt: 135, receipt: false },
    { id: 23, desc: 'Chatime',        date: 'May 14', amt: 115, receipt: false },
    { id: 24, desc: 'Café de Coral',  date: 'May 11', amt: 120, receipt: true  },
  ]},
  { id: 'transport', name: 'Transport', th: 'เดินทาง', icon: '🚇', color: '#5b9cf6', budget: 2000, spent: 1850, count: 8, items: [
    { id: 6, desc: 'BTS/MRT',      date: 'May 23', amt: 120, receipt: false },
    { id: 7, desc: 'Grab ×5',      date: 'May 22', amt: 580, receipt: true  },
    { id: 8, desc: 'Taxi',         date: 'May 19', amt: 340, receipt: false },
    { id: 9, desc: 'Airport Link', date: 'May 10', amt: 45,  receipt: false },
  ]},
  { id: 'fuel', name: 'Fuel', th: 'น้ำมัน', icon: '⛽', color: '#f5a623', budget: 2000, spent: 1200, count: 3, items: [
    { id: 25, desc: 'PTT Station',   date: 'May 22', amt: 500, receipt: true  },
    { id: 26, desc: 'Shell Station', date: 'May 15', amt: 450, receipt: true  },
    { id: 27, desc: 'Bangchak',      date: 'May 8',  amt: 250, receipt: false },
  ]},
  { id: 'housing', name: 'Housing / Rent', th: 'ที่พัก', icon: '🏠', color: '#9b7de8', budget: 10000, spent: 9500, count: 1, items: [
    { id: 10, desc: 'Monthly Rent', date: 'May 1', amt: 9500, receipt: true },
  ]},
  { id: 'electricity', name: 'Electricity', th: 'ค่าไฟ', icon: '⚡', color: '#fbbf24', budget: 1500, spent: 1480, count: 1, items: [
    { id: 11, desc: 'Provincial EA', date: 'May 5', amt: 1480, receipt: true },
  ]},
  { id: 'water', name: 'Water', th: 'น้ำประปา', icon: '💧', color: '#38bdf8', budget: 500, spent: 320, count: 1, items: [
    { id: 12, desc: 'MWA Water Bill', date: 'May 5', amt: 320, receipt: true },
  ]},
  { id: 'health', name: 'Health', th: 'สุขภาพ', icon: '💊', color: '#4dcaa3', budget: 2000, spent: 1200, count: 3, items: [
    { id: 13, desc: 'Pharmacy',      date: 'May 20', amt: 380, receipt: true },
    { id: 14, desc: 'Fitness First', date: 'May 1',  amt: 820, receipt: true },
  ]},
  { id: 'entertain', name: 'Entertainment', th: 'บันเทิง', icon: '🎬', color: '#f4a9d0', budget: 1500, spent: 890, count: 4, items: [
    { id: 15, desc: 'SF Cinema', date: 'May 16', amt: 320, receipt: false },
    { id: 16, desc: 'Netflix',   date: 'May 1',  amt: 289, receipt: true  },
    { id: 17, desc: 'Concert',   date: 'May 12', amt: 280, receipt: false },
  ]},
  { id: 'credit', name: 'Credit Card', th: 'บัตรเครดิต', icon: '💳', color: '#f43f5e', budget: 3000, spent: 2200, count: 2, items: [
    { id: 28, desc: 'KBank Mastercard', date: 'May 10', amt: 1200, receipt: true },
    { id: 29, desc: 'SCB Visa',         date: 'May 10', amt: 1000, receipt: true },
  ]},
  { id: 'other', name: 'Others', th: 'อื่นๆ', icon: '📦', color: '#94a3b8', budget: 500, spent: 280, count: 3, items: [
    { id: 30, desc: 'Parcel',        date: 'May 21', amt: 120, receipt: false },
    { id: 31, desc: 'Stationery',    date: 'May 17', amt: 85,  receipt: false },
    { id: 32, desc: 'Miscellaneous', date: 'May 12', amt: 75,  receipt: false },
  ]},
];

export const INIT_INCOME_CATS: IncomeCategory[] = [
  { id: 'salary', name: 'Salary', th: 'เงินเดือน', icon: '💼', color: '#10b981', items: [
    { id: 101, desc: 'Monthly Salary', date: 'May 1', amt: 45000, receipt: true },
  ]},
  { id: 'family', name: 'Family', th: 'ครอบครัว', icon: '🏦', color: '#818cf8', items: [
    { id: 102, desc: 'From Parents', date: 'May 10', amt: 5000, receipt: false },
  ]},
  { id: 'parttime', name: 'Part-time', th: 'พาร์ทไทม์', icon: '🎯', color: '#f59e0b', items: [
    { id: 103, desc: 'Freelance Design', date: 'May 15', amt: 3500, receipt: false },
    { id: 104, desc: 'Online Tutoring',  date: 'May 20', amt: 2000, receipt: false },
  ]},
];

export const WEEKLY_EXPENSE = [3200, 5800, 4200, 4900, 2640, 0];
export const WEEKLY_INCOME  = [30000, 5000, 5500, 2000, 13000, 0];

export const HISTORY: MonthHistory[] = [
  { label: 'มกราคม',     spent: 18200, budget: 22000 },
  { label: 'กุมภาพันธ์', spent: 22100, budget: 22000 },
  { label: 'มีนาคม',     spent: 19500, budget: 22000 },
  { label: 'เมษายน',     spent: 21800, budget: 22500 },
];

export const INCOME_HISTORY: IncomeHistory[] = [
  { label: 'มกราคม',     income: 53000 },
  { label: 'กุมภาพันธ์', income: 50000 },
  { label: 'มีนาคม',     income: 55500 },
  { label: 'เมษายน',     income: 53000 },
];

export const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน'];

export const fmt = (n: number): string => '฿' + Number(n).toLocaleString('th-TH');
