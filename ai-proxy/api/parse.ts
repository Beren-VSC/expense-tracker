import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, ApiError } from '@google/genai';

// ต้อง sync ด้วยมือกับ src/data/index.ts ฝั่ง expense-tracker-app (คนละ deploy target กัน)
const EXPENSE_CATEGORIES = [
  { id: 'food', th: 'อาหาร' },
  { id: 'drinks', th: 'เครื่องดื่ม' },
  { id: 'transport', th: 'เดินทาง' },
  { id: 'fuel', th: 'น้ำมัน' },
  { id: 'housing', th: 'ที่พัก' },
  { id: 'electricity', th: 'ค่าไฟ' },
  { id: 'water', th: 'น้ำประปา' },
  { id: 'health', th: 'สุขภาพ' },
  { id: 'entertain', th: 'บันเทิง' },
  { id: 'credit', th: 'บัตรเครดิต' },
  { id: 'other', th: 'อื่นๆ' },
] as const;

const INCOME_CATEGORIES = [
  { id: 'salary', th: 'เงินเดือน' },
  { id: 'family', th: 'ครอบครัว' },
  { id: 'parttime', th: 'พาร์ทไทม์' },
] as const;

const ALL_CATEGORY_IDS = [
  ...EXPENSE_CATEGORIES.map(c => c.id),
  ...INCOME_CATEGORIES.map(c => c.id),
];

// gemini-3.5-flash-lite อยู่ใน free tier ของ Google AI Studio (ไม่ต้องผูกบัตรเครดิต) — เพียงพอสำหรับงาน extract ข้อมูลแบบมีโครงสร้างนี้
// (gemini-2.5-flash-lite ถูกปิดสำหรับผู้ใช้ใหม่แล้ว ณ วันที่เขียนโค้ดนี้ — เช็ค https://ai.google.dev/gemini-api/docs/models ถ้า error 404 "no longer available")
const MODEL = 'gemini-3.5-flash-lite';

const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['expense', 'income'] },
    // ถ้า isNewCategory=false ต้องเป็นหนึ่งใน ALL_CATEGORY_IDS, ถ้า true คือ slug ใหม่ (a-z0-9_ เท่านั้น) ที่ AI คิดขึ้นเอง
    categoryId: { type: 'string' },
    isNewCategory: { type: 'boolean' },
    // ชื่อหมวดหมู่ภาษาไทยที่จะแสดงผล — ถ้าใช้หมวดเดิมให้ตอบชื่อไทยของหมวดนั้นตรงๆ, ถ้าสร้างใหม่ให้ตั้งชื่อสั้นๆ ที่สื่อความหมาย
    categoryLabel: { type: 'string' },
    // อีโมจิ 1 ตัวแทนหมวดหมู่ (ใช้เฉพาะตอนสร้างหมวดใหม่ แต่ให้ตอบมาเสมอเผื่อใช้)
    categoryIcon: { type: 'string' },
    desc: { type: 'string' },
    amount: { type: 'number' },
    date: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['kind', 'categoryId', 'isNewCategory', 'categoryLabel', 'categoryIcon', 'desc', 'amount', 'date', 'confidence'],
};

// ตอบกลับเป็น "อาเรย์ของรายการ" เสมอ — รองรับทั้งกรณีรายการเดียวและหลายรายการในคำสั่ง/สลิปเดียวกัน
const RESPONSE_SCHEMA = {
  type: 'array',
  items: ITEM_SCHEMA,
  minItems: 1,
};

interface AiExtraction {
  kind: 'expense' | 'income';
  categoryId: string;
  isNewCategory: boolean;
  categoryLabel: string;
  categoryIcon: string;
  desc: string;
  amount: number;
  date: string;
  confidence: 'high' | 'medium' | 'low';
}

// slug ที่ AI สร้างเองต้องปลอดภัยพอจะใช้เป็น id หมวดหมู่ใน state ฝั่งแอป
const NEW_CATEGORY_ID_RE = /^[a-z0-9_]{2,40}$/;

function isValidExtraction(v: unknown): v is AiExtraction {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (
    !(o.kind === 'expense' || o.kind === 'income') ||
    typeof o.categoryId !== 'string' ||
    typeof o.isNewCategory !== 'boolean' ||
    typeof o.categoryLabel !== 'string' || !o.categoryLabel.trim() ||
    typeof o.categoryIcon !== 'string' || !o.categoryIcon.trim() ||
    typeof o.desc !== 'string' ||
    typeof o.amount !== 'number' || o.amount <= 0 ||
    typeof o.date !== 'string' ||
    !(o.confidence === 'high' || o.confidence === 'medium' || o.confidence === 'low')
  ) return false;

  if (o.isNewCategory) {
    // หมวดใหม่ต้องเป็น slug ที่ปลอดภัย และห้ามชนกับหมวดเดิมที่มีอยู่แล้ว
    return NEW_CATEGORY_ID_RE.test(o.categoryId) && !ALL_CATEGORY_IDS.includes(o.categoryId as any);
  }
  return ALL_CATEGORY_IDS.includes(o.categoryId as any);
}

function isValidExtractionArray(v: unknown): v is AiExtraction[] {
  return Array.isArray(v) && v.length > 0 && v.every(isValidExtraction);
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

interface ParseRequestBody {
  mode?: 'image' | 'text';
  imageBase64?: string;
  mimeType?: string;
  text?: string;
}

function buildSystemInstruction(): string {
  const categoryList = [
    ...EXPENSE_CATEGORIES.map(c => `${c.id} (รายจ่าย: ${c.th})`),
    ...INCOME_CATEGORIES.map(c => `${c.id} (รายรับ: ${c.th})`),
  ].join(', ');
  const today = new Date().toISOString().slice(0, 10);
  return [
    'คุณเป็นผู้ช่วยบันทึกรายรับ-รายจ่ายส่วนตัว',
    `หมวดหมู่ที่มีอยู่แล้วในระบบ: ${categoryList}`,
    'ถ้ามีหมวดหมู่ที่มีอยู่แล้วเหมาะสมกับรายการนั้นพอสมควร ให้ใช้หมวดเดิม (isNewCategory=false, categoryId=id ของหมวดนั้น, categoryLabel=ชื่อไทยของหมวดนั้นตรงๆ)',
    'ถ้าไม่มีหมวดเดิมไหนเหมาะสมเลย (เช่น ผู้ใช้ระบุหัวข้อ/ประเภทเฉพาะเจาะจงเอง เช่น ชื่อธนาคาร, โปรเจกต์, บุคคล) ให้ "สร้างหมวดใหม่" แทน: isNewCategory=true, categoryId=slug ภาษาอังกฤษตัวเล็กสั้นๆ ไม่มีเว้นวรรค (a-z0-9_ เท่านั้น เช่น "bbl_transfer"), categoryLabel=ชื่อหมวดภาษาไทยสั้นๆ ที่สื่อความหมาย (เช่น "โอนเงิน BBL"), categoryIcon=อีโมจิ 1 ตัวที่เข้ากับหมวดนั้น',
    'ถ้าหลายรายการควรอยู่หมวดใหม่เดียวกัน ให้ใช้ categoryId เดียวกันทุกรายการนั้น (เพื่อไม่ให้สร้างหมวดซ้ำ)',
    'ตอบกลับเป็น "อาเรย์ของรายการ" เสมอ — 1 รายการต่อ 1 ธุรกรรมที่แยกจากกันได้จริง',
    'ถ้าข้อความ/สลิปมีหลายรายการ (เช่น ใบเสร็จมีหลายบรรทัด, สั่งบันทึกหลายบัญชี/หลายรายจ่ายพร้อมกัน) ให้แตกเป็นหลายรายการในอาเรย์ แต่ละรายการแม็ปหมวดหมู่ของตัวเองตามความเหมาะสม — ห้ามรวมยอดเป็นรายการเดียวถ้าผู้ใช้แจกแจงมาแยกกันชัดเจน',
    'ถ้ามีแค่ 1 ธุรกรรม ให้ตอบเป็นอาเรย์ที่มี 1 รายการ',
    `ตอบวันที่เป็นรูปแบบ "D MMM" แบบย่อภาษาไทย เช่น "27 พ.ค." ถ้าไม่ได้ระบุวันที่ให้ถือว่าเป็นวันนี้ (${today}) และแปลงคำวันที่แบบ relative เช่น "เมื่อวาน"/"วันนี้" ให้ถูกต้อง — ถ้าแต่ละรายการวันที่ต่างกันให้ระบุแยกตามจริง`,
    'ถ้าอ่านจำนวนเงินหรือหมวดหมู่ของรายการไหนไม่ชัดเจน ให้ตอบ confidence ของรายการนั้นเป็น "medium" หรือ "low" แทนที่จะเดามั่ว',
    'ตอบกลับเป็น JSON ตาม schema ที่กำหนดเท่านั้น',
  ].join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-secret');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  // กันคนแปลกหน้าเรียก endpoint นี้เล่น (ไม่ใช่ auth จริงจัง — แค่กันเรียกมั่วๆ ถ้า URL หลุด)
  const expectedSecret = process.env.APP_SHARED_SECRET;
  if (expectedSecret && req.headers['x-app-secret'] !== expectedSecret) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const body = req.body as ParseRequestBody | undefined;
  if (!body || (body.mode !== 'image' && body.mode !== 'text')) {
    res.status(400).json({ error: 'ต้องระบุ mode เป็น "image" หรือ "text"' });
    return;
  }

  let input: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mime_type: string }>;

  if (body.mode === 'image') {
    if (!body.imageBase64 || !body.mimeType) {
      res.status(400).json({ error: 'ต้องมี imageBase64 และ mimeType' });
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(body.mimeType as AllowedMimeType)) {
      res.status(400).json({ error: `mimeType ต้องเป็นหนึ่งใน: ${ALLOWED_MIME_TYPES.join(', ')}` });
      return;
    }
    input = [
      { type: 'text', text: 'นี่คือรูปสลิป/ใบเสร็จ อ่านแล้วแยกข้อมูลทุกรายการที่เห็นในรูป (ถ้ามีหลายรายการให้แยกเป็นหลายชิ้นในอาเรย์)' },
      { type: 'image', data: body.imageBase64, mime_type: body.mimeType },
    ];
  } else {
    if (!body.text || !body.text.trim()) {
      res.status(400).json({ error: 'ต้องมี text' });
      return;
    }
    input = [{ type: 'text', text: body.text }];
  }

  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.interactions.create({
      model: MODEL,
      system_instruction: buildSystemInstruction(),
      input,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: RESPONSE_SCHEMA,
      },
    });

    if (!response.output_text) {
      res.status(422).json({ error: 'AI ไม่ตอบข้อมูลกลับมา กรุณาลองใหม่' });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      res.status(422).json({ error: 'AI ตอบข้อมูลไม่ตรงรูปแบบ กรุณาลองใหม่' });
      return;
    }

    if (!isValidExtractionArray(parsed)) {
      res.status(422).json({ error: 'AI ไม่สามารถแยกข้อมูลจากรายการนี้ได้ กรุณาลองใหม่' });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof ApiError) {
      console.error(`Gemini API error (${err.status}):`, err.message);
      if (err.status === 401 || err.status === 403) {
        res.status(500).json({ error: 'server misconfigured' });
      } else if (err.status === 429) {
        res.status(429).json({ error: 'AI กำลังถูกใช้งานเยอะ (free tier เต็มโควต้า) ลองใหม่อีกครั้ง' });
      } else {
        res.status(502).json({ error: 'AI service error' });
      }
    } else {
      console.error('Unexpected error in /api/parse:', err);
      res.status(500).json({ error: 'internal error' });
    }
  }
}
