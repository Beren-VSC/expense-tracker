// รันหลัง `expo export -p web` เสมอ (ทั้งตอน deploy จากเครื่องและตอน Vercel auto-build จาก Git)
// ต้องเป็น Node ล้วน ไม่พึ่ง python/PIL เพราะ build container ของ Vercel รับประกันแค่ Node
// หน้าที่: คัดลอก icon.png ไปเป็น apple-touch-icon.png + ฝัง link tag ลง dist/index.html
// (ก่อนหน้านี้ไม่มี apple-touch-icon เลย ทำให้ "Add to Home Screen" บน iOS ไปแคปหน้าจอ/ใช้ไอคอนอื่นแทนแบบสุ่ม)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const iconSrc = path.join(root, 'assets', 'icon.png');
const iconDest = path.join(root, 'dist', 'apple-touch-icon.png');
const htmlPath = path.join(root, 'dist', 'index.html');

fs.copyFileSync(iconSrc, iconDest);

let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('apple-touch-icon')) {
  const tags = '<link rel="apple-touch-icon" href="/apple-touch-icon.png" /><meta name="theme-color" content="#1c1a16" />';
  html = html.replace('</head>', `${tags}</head>`);
  fs.writeFileSync(htmlPath, html);
}

console.log('post-export: injected apple-touch-icon into dist/index.html');
