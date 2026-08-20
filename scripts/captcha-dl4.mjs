// Read SMS module sendCode implementation (may auto-handle captcha + replay).
import fs from 'node:fs';
const js = fs.readFileSync(process.env.TEMP + '/captcha.js', 'utf8');
console.log(js.slice(34066, 35200).replace(/\n+/g, ' '));
