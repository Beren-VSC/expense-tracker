# context.md — Expense Tracker App (Mobile)

## โครงสร้างไฟล์
- `App.tsx` — entry point, Expo Router setup
- `src/screens/` — หน้าจอต่างๆ ของแอป
- `src/components/` — UI components ที่ใช้ซ้ำ
- `src/data/` — data layer (mock data, types)
- `src/theme/` — สี, font, spacing
- `app.json` — Expo config (app name, version, icon)
- `package.json` — dependencies

## Stack
- React Native + Expo (Expo Router)
- TypeScript
- ไม่มี backend — ข้อมูลเก็บ local

## กฎสำคัญ
- ใช้ Expo Router (App Router pattern) — routing อยู่ใน `src/screens/`
- ชื่อตัวแปรภาษาอังกฤษ, UI ภาษาไทย
- type ทุกอย่างด้วย TypeScript

## Just-in-time context (ข้อ 8)
อ่านเฉพาะไฟล์ที่เกี่ยวกับ Task เท่านั้น:
- แก้หน้าจอ → อ่านใน src/screens/
- แก้ component → อ่านใน src/components/
- แก้ data/type → อ่านใน src/data/
- แก้สีหรือ style → อ่านใน src/theme/
