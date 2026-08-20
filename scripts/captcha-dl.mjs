// Download secsdk-captcha and analyze its API surface.
import fs from 'node:fs';
const URLS = [
  'https://lf-rc1.yhgfb-cn-static.com/obj/rc-client-security/secsdk-captcha/@latest/captcha.js',
  'https://lf-cdn-tos.bytescm.com/obj/static/secsdk-captcha/@latest/captcha.js',
];
let js = null;
for (const u of URLS) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36' }, signal: AbortSignal.timeout(30000) });
    if (r.ok) { js = await r.text(); console.log('OK:', u, 'len:', js.length); break; }
    console.log('FAIL:', u, r.status);
  } catch (e) { console.log('ERR:', u, e.message); }
}
if (!js) process.exit(1);
fs.writeFileSync(process.env.TEMP + '/captcha.js', js);

// API surface analysis
for (const k of ['TTGCaptcha', 'window.TTGCaptcha', 'getFp', 'render', 'init', 'verify_data', 'successCb', 'closeCb', 'setPublicKey', 'refresh', 'reset', 'showMode']) {
  const hits = [];
  let idx = js.indexOf(k);
  while (idx >= 0 && hits.length < 3) { hits.push(idx); idx = js.indexOf(k, idx + 1); }
  console.log(`"${k}": ${hits.length ? hits.map(h => '@' + h).join(' ') : 'NOT FOUND'}`);
}
// what does the script export at the end?
const tail = js.slice(-600);
console.log('\ntail:', tail.slice(0, 400));
// look for UMD/global assignment
const umd = js.match(/typeof exports[\s\S]{0,200}/);
console.log('\numd:', umd ? umd[0].slice(0, 200) : 'n/a');
const glob = js.match(/window\.[A-Za-z_$]+=/g);
console.log('\nglobal assignments:', glob ? [...new Set(glob)].slice(0, 10).join(' ') : 'n/a');
