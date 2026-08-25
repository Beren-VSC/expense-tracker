// Local dev server ทางเลือกที่ไม่ต้อง login Vercel account (ต่างจาก `vercel dev` ซึ่งต้อง login ครั้งแรก)
// ใช้ตอนพัฒนา/ทดสอบในเครื่องเท่านั้น — deploy จริงยังใช้ `vercel deploy` ตามปกติ
import http from 'node:http';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import parseHandler from './api/parse';
import dataHandler from './api/data';

const PORT = Number(process.env.PORT) || 3000;

const routes: Record<string, typeof parseHandler> = {
  '/api/parse': parseHandler,
  '/api/data': dataHandler,
};

const server = http.createServer(async (req, res) => {
  const path = (req.url ?? '').split('?')[0];
  const handler = routes[path];
  if (!handler) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  let body: unknown;
  if (raw) {
    try { body = JSON.parse(raw); } catch { body = undefined; }
  }
  (req as unknown as VercelRequest).body = body;

  const vRes = res as unknown as VercelResponse;
  vRes.status = (code: number) => { res.statusCode = code; return vRes; };
  vRes.json = (obj: unknown) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
    return vRes;
  };

  try {
    await handler(req as unknown as VercelRequest, vRes);
  } catch (err) {
    console.error('dev-server unhandled error:', err);
    if (!res.headersSent) res.statusCode = 500;
    res.end(JSON.stringify({ error: 'internal error' }));
  }
});

server.listen(PORT, () => {
  console.log(`ai-proxy dev server (no Vercel login needed) → http://localhost:${PORT}`);
});
