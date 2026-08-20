// Find SMS module (N) render signature & renderCaptcha (A) in captcha.js.
import fs from 'node:fs';
const js = fs.readFileSync(process.env.TEMP + '/captcha.js', 'utf8');
function ctx(key, from = 0, len = 600, max = 3) {
  const found = [];
  let idx = js.indexOf(key, from);
  while (idx >= 0 && found.length < max) { found.push(idx); idx = js.indexOf(key, idx + 1); }
  if (!found.length) { console.log(`-- "${key}": NOT FOUND`); return; }
  for (const f of found) console.log(`\n== "${key}" @${f}:\n` + js.slice(Math.max(0, f - len), f + len).replace(/\n+/g, ' '));
}
// A.renderCaptcha definition: search "renderCaptcha:function"
ctx('renderCaptcha:function', 0, 500, 2);
ctx('renderCaptcha=function', 0, 500, 2);
// SMS module N: search "verify_data" render usage
ctx('verify_data:function', 0, 400, 2);
ctx('this.myVerify.autoRender', 0, 300, 2);
// what is W (initVerifyCenter)?
ctx('initVerifyCenter:function', 0, 300, 2);
ctx('N=function', 15000, 400, 2);
