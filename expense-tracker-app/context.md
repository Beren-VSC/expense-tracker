# context.md — Expense Tracker App (Mobile)

## โครงสร้างไฟล์
- `App.tsx` — entry point, สลับหน้าจอด้วย `useState<Screen>` เอง (ไม่ได้ใช้ Expo Router หรือ React Navigation แม้จะมี `@react-navigation` อยู่ใน dependency ก็ตาม)
- `src/screens/` — หน้าจอต่างๆ ของแอป (HomeScreen ทำหน้าที่เป็น Dashboard หลักด้วย)
- `src/components/` — UI components ที่ใช้ซ้ำ
- `src/data/` — data layer (mock data เริ่มต้น, types)
- `src/theme/` — สี, font, spacing
- `app.json` — Expo config (app name, version, icon, `expo-image-picker` permission plugin)
- `package.json` — dependencies
- `../ai-proxy/` — backend proxy แยกโปรเจกต์ (Vercel serverless function) เก็บ `GEMINI_API_KEY` ฝั่ง server ให้ AI capture เรียกใช้ (Google Gemini API free tier — ใช้งานฟรี ไม่ต้องผูกบัตรเครดิต)

## Stack
- React Native + Expo SDK 56, TypeScript
- ข้อมูลเก็บใน `AsyncStorage` (`@react-native-async-storage/async-storage`) ผ่าน `STORAGE_KEY` ใน `App.tsx` — ไม่มี backend สำหรับข้อมูล แต่มี backend proxy แยกสำหรับเรียก AI เท่านั้น

## กฎสำคัญ
- ชื่อตัวแปรภาษาอังกฤษ, UI ภาษาไทย
- type ทุกอย่างด้วย TypeScript
- **ห้าม manual add รายการใหม่** — การเพิ่มรายการทำผ่าน `AICaptureSheet.tsx` เท่านั้น (ถ่าย/แนบรูปสลิป หรือพิมพ์คำสั่งข้อความ ให้ AI อ่าน/แปลผ่าน `ai-proxy` แล้วมีหน้ายืนยัน/แก้ไขก่อนบันทึกจริง) — `AddItemSheet.tsx` เหลือไว้สำหรับ "แก้ไข/ลบรายการที่บันทึกแล้ว" เท่านั้น
- ต้องตั้งค่า `EXPO_PUBLIC_API_BASE_URL` (ดู `.env.example`) ให้ชี้ไปที่ `ai-proxy` ที่รันอยู่ (`vercel dev` หรือ URL prod) ไม่งั้น AI capture จะเรียก backend ไม่ได้
- Expo SDK เปลี่ยน API บ่อย — เช็ค docs เวอร์ชันที่ตรงกันก่อนใช้ API ใหม่ (ดู `AGENTS.md`)

## Just-in-time context (ข้อ 8)
อ่านเฉพาะไฟล์ที่เกี่ยวกับ Task เท่านั้น:
- แก้หน้าจอ/Dashboard → อ่านใน `src/screens/`
- แก้ flow เพิ่มรายการด้วย AI → อ่าน `src/components/AICaptureSheet.tsx`
- แก้ flow แก้ไข/ลบรายการเดิม → อ่าน `src/components/AddItemSheet.tsx`
- แก้ data/type → อ่านใน `src/data/`
- แก้สีหรือ style → อ่านใน `src/theme/`
- แก้ backend/prompt ที่ AI ใช้อ่านสลิป → อ่าน `../ai-proxy/api/parse.ts`
