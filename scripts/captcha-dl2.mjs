// Analyze captcha.js module exports & endpoints & origin checks.
import fs from 'node:fs';
const js = fs.readFileSync(process.env.TEMP + '/captcha.js', 'utf8');
function ctx(key, from = 0, len = 500, max = 3) {
  const found = [];
  let idx = js.indexOf(key, from);
  while (idx >= 0 && found.length < max) { found.push(idx); idx = js.indexOf(key, idx + 1); }
  if (!found.length) { console.log(`-- "${key}": NOT FOUND`); return; }
  for (const f of found) console.log(`\n== "${key}" @${f}:\n` + js.slice(Math.max(0, f - len), f + len).replace(/\n+/g, ' '));
}
ctx('initVerifyCenter=', 0, 400, 2);
ctx('SMS=', 0, 400, 2);
ctx('getFp=', 0, 300, 2);
ctx('render=', 17000, 300, 2);
// endpoints
const urls = [...new Set([...js.matchAll(/https?:\/\/[^"'\s`)]+/g)].map(m => m[0].replace(/\/+$/, '')))];
console.log('\nURLs:', urls.slice(0, 20).join('\n  '));
// origin/referer checks
ctx('referrer', 0, 250, 3);
ctx('location.origin', 0, 250, 3);
ctx('document.domain', 0, 250, 2);
// what object holds render/init/getFp
ctx('init:function', 0, 300, 3);
