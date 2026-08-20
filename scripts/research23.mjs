// Research 23: exhaustive domain/path search across Home.js + muye.js for login implementation.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
function findAll(text, key, max = 6, ctx = 300) {
  let idx = text.indexOf(key);
  let n = 0;
  while (idx >= 0 && n < max) {
    console.log(`-- "${key}" @${idx}: ` + text.slice(Math.max(0, idx - ctx), idx + ctx).replace(/\n+/g, ' '));
    idx = text.indexOf(key, idx + 1);
    n++;
  }
  if (n === 0) console.log(`-- "${key}": NOT FOUND`);
}

const home = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/Home.8cfc78c6.js');
console.log('Home.js len:', home.length);
console.log('\n######## Home.js');
for (const k of ['sso.douyin', 'douyin.com', 'passport', 'qrcode', 'web_login', '扫码', 'get_qr_code', 'isShowLogin']) findAll(home, k, 2, 250);

const muye = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js');
console.log('\n######## muye.js');
for (const k of ['sso.douyin', 'douyin.com', 'qrcode', 'web_login', '扫码', 'get_qr_code', 'login/status', 'check_qrconnect', 'login_modal', 'LoginModal', 'sso/']) {
  const found = [];
  let idx = muye.indexOf(k);
  let n = 0;
  while (idx >= 0 && n < 3) { found.push(idx); idx = muye.indexOf(k, idx + 1); n++; }
  if (found.length) console.log(`-- "${k}": ${found.map(f => `@${f}: ` + muye.slice(Math.max(0, f - 200), f + 250).replace(/\n+/g, ' ')).join('\n')}`);
  else console.log(`-- "${k}": NOT FOUND`);
}
