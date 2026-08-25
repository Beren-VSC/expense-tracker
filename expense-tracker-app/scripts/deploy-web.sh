#!/bin/bash
# Deploy เว็บแอปขึ้น Vercel แบบ manual จากเครื่อง (สำรอง — ปกติ auto-deploy จาก git push ทำงานให้เองแล้ว)
set -e
cd "$(dirname "$0")/.."

npx expo export -p web
node scripts/post-export.js
npx vercel deploy dist --prod --yes --name expense-tracker-app
