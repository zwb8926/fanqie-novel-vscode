// Research 24: find passport SDK host in muye + check npm/pypi fanqie packages for login code.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(40000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
const muye = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js');
for (const k of ['sso.snssdk', 'passport.douyin', 'login.snssdk', 'passport.bytedance', 'iesdouyin', 'snssdk.com', 'sso.bytedance', 'sso.snssdk.com', 'douyin.snssdk', 'passport.snssdk', 'sso.douyin']) {
  const found = [];
  let idx = muye.indexOf(k);
  while (idx >= 0 && found.length < 3) { found.push(idx); idx = muye.indexOf(k, idx + 1); }
  if (found.length) {
    for (const f of found) console.log(`-- "${k}" @${f}: ` + muye.slice(Math.max(0, f - 250), f + 300).replace(/\n+/g, ' '));
  } else console.log(`-- "${k}": NOT FOUND`);
}

// the SDK request method: how host is constructed — find `this.request` or `request:` near 2985k
console.log('\n######## request builder');
const idx2 = muye.indexOf('passport.sso', 2980000);
console.log('passport.sso @', idx2);
// find the host constant near SDK: search "https://" occurrences between 2983000 and 2996000
let idx = muye.indexOf('https://', 2983000);
while (idx >= 0 && idx < 2997000) {
  console.log(`-- https @${idx}: ` + muye.slice(idx, idx + 90));
  idx = muye.indexOf('https://', idx + 1);
}

// npm search
try {
  const r = await fetch('https://registry.npmjs.org/-/v1/search?text=fanqienovel%20OR%20%E7%95%AA%E8%8C%84%E5%B0%8F%E8%AF%B4&size=10', { signal: AbortSignal.timeout(20000) });
  const j = await r.json();
  console.log('\n######## npm packages:');
  for (const o of (j.objects || [])) console.log(o.package.name + ' | ' + (o.package.description || '').slice(0, 100) + ' | ' + o.package.links.repository);
} catch (e) { console.log('npm ERR', e.message); }
