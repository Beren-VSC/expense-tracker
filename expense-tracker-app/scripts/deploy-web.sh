#!/bin/bash
# Build + deploy เว็บแอปขึ้น Vercel (โปรเจกต์ expense-tracker-app) พร้อมฝัง apple-touch-icon
# ให้ตอน "Add to Home Screen" บน iOS ใช้โลโก้ของแอปจริง แทนการแคปหน้าจอเอง
set -e
cd "$(dirname "$0")/.."

npx expo export -p web

# สร้าง apple-touch-icon (180x180 ตามสเปคของ iOS) จาก assets/icon.png แล้วฝัง link tag ลง index.html
python3 - << 'PY'
from PIL import Image
im = Image.open('assets/icon.png').convert('RGB').resize((180, 180), Image.LANCZOS)
im.save('dist/apple-touch-icon.png')

with open('dist/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

tags = '<link rel="apple-touch-icon" href="/apple-touch-icon.png" /><meta name="theme-color" content="#1c1a16" />'
if 'apple-touch-icon' not in html:
    html = html.replace('</head>', tags + '</head>')
    with open('dist/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
print('injected apple-touch-icon into dist/index.html')
PY

npx vercel deploy dist --prod --yes --name expense-tracker-app
