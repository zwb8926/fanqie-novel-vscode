// 改类名 cookie-hint → key-hint
import fs from 'node:fs';
let s = fs.readFileSync('media/app.js', 'utf8');
const before = s;
s = s.replace("el('div', 'cookie-hint', '键盘：", "el('div', 'key-hint', '键盘：");
if (s === before) { console.log('无变化'); process.exit(1); }
fs.writeFileSync('media/app.js', s);
console.log('类名已改');
