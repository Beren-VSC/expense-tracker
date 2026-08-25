import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// เก็บข้อมูลแอปทั้งก้อน (cats/incomeCats/notes) เป็น JSON เดียว บน Upstash Redis
// แอปเป็นแบบส่วนตัวคนเดียวใช้ ไม่มีระบบ multi-user จึงใช้ key คงที่ตัวเดียวพอ
const DATA_KEY = 'expense_tracker:data';

interface BackupData {
  cats: unknown[];
  incomeCats: unknown[];
  notes: unknown[];
}

const isValidBackup = (v: any): v is BackupData =>
  v && Array.isArray(v.cats) && Array.isArray(v.incomeCats) && Array.isArray(v.notes);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-secret');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // กันคนแปลกหน้าเรียก endpoint นี้เล่น (ไม่ใช่ auth จริงจัง — แค่กันเรียกมั่วๆ ถ้า URL หลุด)
  const expectedSecret = process.env.APP_SHARED_SECRET;
  if (expectedSecret && req.headers['x-app-secret'] !== expectedSecret) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN' });
    return;
  }
  const redis = new Redis({ url, token });

  if (req.method === 'GET') {
    try {
      const data = await redis.get<BackupData>(DATA_KEY);
      res.status(200).json({ data: data ?? null });
    } catch (e) {
      console.error('redis get failed', e);
      res.status(502).json({ error: 'อ่านข้อมูลจากฐานข้อมูลไม่สำเร็จ' });
    }
    return;
  }

  if (req.method === 'POST') {
    const body = req.body as BackupData | undefined;
    if (!isValidBackup(body)) {
      res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง (ต้องมี cats/incomeCats/notes เป็น array)' });
      return;
    }
    try {
      await redis.set(DATA_KEY, body);
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('redis set failed', e);
      res.status(502).json({ error: 'บันทึกข้อมูลลงฐานข้อมูลไม่สำเร็จ' });
    }
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
}
