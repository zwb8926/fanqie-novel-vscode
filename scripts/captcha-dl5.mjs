// Read S.prototype.renderCaptcha fully.
import fs from 'node:fs';
const js = fs.readFileSync(process.env.TEMP + '/captcha.js', 'utf8');
console.log(js.slice(21704, 23100).replace(/\n+/g, ' '));
