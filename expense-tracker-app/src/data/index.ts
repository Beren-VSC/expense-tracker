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

// รายการเตือนจ่ายบิล/ค่าใช้จ่ายที่ต้องจ่าย — แยกต่างหากจาก ExpenseItem/IncomeItem ไม่ผูกกับรายการรายรับ-รายจ่ายจริง
export interface NoteItem {
  id: number;
  title: string;
  day: number;
  month: number; // 0-11
  year: number; // ค.ศ.
  paid: boolean;
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

// ล้างรายการตัวอย่าง (mock) ออกทั้งหมด — เหลือแค่โครงหมวดหมู่ไว้ รอข้อมูลจริงจาก AI capture
export const INIT_CATS: ExpenseCategory[] = [
  { id: 'food', name: 'Food & Dining', th: 'อาหาร', icon: '🍜', color: '#f4875a', budget: 6000, spent: 0, count: 0, items: [] },
  { id: 'drinks', name: 'Drinks', th: 'เครื่องดื่ม', icon: '☕', color: '#3ecfcf', budget: 1000, spent: 0, count: 0, items: [] },
  { id: 'transport', name: 'Transport', th: 'เดินทาง', icon: '🚇', color: '#5b9cf6', budget: 2000, spent: 0, count: 0, items: [] },
  { id: 'fuel', name: 'Fuel', th: 'น้ำมัน', icon: '⛽', color: '#f5a623', budget: 2000, spent: 0, count: 0, items: [] },
  { id: 'housing', name: 'Housing / Rent', th: 'ที่พัก', icon: '🏠', color: '#9b7de8', budget: 10000, spent: 0, count: 0, items: [] },
  { id: 'electricity', name: 'Electricity', th: 'ค่าไฟ', icon: '⚡', color: '#fbbf24', budget: 1500, spent: 0, count: 0, items: [] },
  { id: 'water', name: 'Water', th: 'น้ำประปา', icon: '💧', color: '#38bdf8', budget: 500, spent: 0, count: 0, items: [] },
  { id: 'health', name: 'Health', th: 'สุขภาพ', icon: '💊', color: '#4dcaa3', budget: 2000, spent: 0, count: 0, items: [] },
  { id: 'entertain', name: 'Entertainment', th: 'บันเทิง', icon: '🎬', color: '#f4a9d0', budget: 1500, spent: 0, count: 0, items: [] },
  { id: 'credit', name: 'Credit Card', th: 'บัตรเครดิต', icon: '💳', color: '#f43f5e', budget: 3000, spent: 0, count: 0, items: [] },
  { id: 'other', name: 'Others', th: 'อื่นๆ', icon: '📦', color: '#94a3b8', budget: 500, spent: 0, count: 0, items: [] },
];

export const INIT_INCOME_CATS: IncomeCategory[] = [
  { id: 'salary', name: 'Salary', th: 'เงินเดือน', icon: '💼', color: '#10b981', items: [] },
  { id: 'family', name: 'Family', th: 'ครอบครัว', icon: '🏦', color: '#818cf8', items: [] },
  { id: 'parttime', name: 'Part-time', th: 'พาร์ทไทม์', icon: '🎯', color: '#f59e0b', items: [] },
];

export const WEEKLY_EXPENSE = [0, 0, 0, 0, 0, 0];
export const WEEKLY_INCOME  = [0, 0, 0, 0, 0, 0];

export const HISTORY: MonthHistory[] = [];

export const INCOME_HISTORY: IncomeHistory[] = [];

export const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

// รูปแบบย่อ ต้องตรงกับที่ ai-proxy สั่งให้ AI ตอบวันที่กลับมา (ดู ai-proxy/api/parse.ts)
export const MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export const fmt = (n: number): string => '฿' + Number(n).toLocaleString('th-TH');

// หมวดหมู่ที่ AI capture สร้างขึ้นเองเมื่อไม่มีหมวดเดิมที่เหมาะสม (ดู AICaptureSheet.tsx + ai-proxy/api/parse.ts)
export const DEFAULT_NEW_CATEGORY_BUDGET = 1000;
const NEW_CATEGORY_COLOR_PALETTE = ['#ec4899', '#06b6d4', '#84cc16', '#a855f7', '#f97316', '#14b8a6', '#eab308', '#6366f1'];
export const pickNewCategoryColor = (existingCount: number): string =>
  NEW_CATEGORY_COLOR_PALETTE[existingCount % NEW_CATEGORY_COLOR_PALETTE.length];

// helper วันที่ปัจจุบัน — ให้หน้าจอต่างๆ คำนวณเดือน/ปี/ปฏิทินจากวันที่จริงเสมอ ไม่ hardcode
export const getCurrentBuddhistYear = (year: number = new Date().getFullYear()): number => year + 543;
export const getDaysInMonth = (year: number, monthIndex: number): number => new Date(year, monthIndex + 1, 0).getDate();
// จันทร์เป็นวันแรกของสัปดาห์ (0=จันทร์ ... 6=อาทิตย์) ให้ตรงกับ DAY_LABELS ใน HistoryScreen
export const getFirstWeekdayMonFirst = (year: number, monthIndex: number): number =>
  (new Date(year, monthIndex, 1).getDay() + 6) % 7;
