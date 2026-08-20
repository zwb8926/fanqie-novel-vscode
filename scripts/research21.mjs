// Research 21: challenge html analysis + SDK QR call site + final login strategy tests.
import fs from 'node:fs';
const TEMP = process.env.TEMP;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(25000), ...opts });
  return { status: r.status, text: await r.text(), headers: Object.fromEntries(r.headers.entries()) };
}

// A. challenge html: look for redirect mechanism
try {
  const html = fs.readFileSync(TEMP + '/sso_challenge.html', 'utf8');
  for (const key of ['location.href', 'location.replace', 'meta http-equiv', 'refresh', 'redirect', 'window.location', 'src="', 'secsdk', 'verify']) {
    const idx = html.indexOf(key);
    if (idx >= 0) console.log(`challenge "${key}" @${idx}: ` + html.slice(Math.max(0, idx - 150), idx + 250).replace(/\n+/g, ' '));
    else console.log(`challenge "${key}": NOT FOUND`);
  }
  // print all script/link tags
  const tags = [...html.matchAll(/<(script|link|meta|iframe)[^>]*>/gi)].map(m => m[0].slice(0, 200));
  console.log('\ntags:', tags.join('\n'));
} catch (e) { console.log('challenge read ERR', e.message); }

// B. sso with the challenge cookie set, retry
try {
  const first = await getText('https://sso.douyin.com/get_qr_code/?service=https%3A%2F%2Ffanqienovel.com%2Fapi%2Fauthor%2Flogin%2Furl%2F&need_validate=0', { headers: { 'Referer': 'https://fanqienovel.com/' } });
  const setC = first.headers['set-cookie'] || '';
  console.log('\nsso set-cookie:', setC.slice(0, 300));
  const retry = await getText('https://sso.douyin.com/get_qr_code/?service=https%3A%2F%2Ffanqienovel.com%2Fapi%2Fauthor%2Flogin%2Furl%2F&need_validate=0', {
    headers: { 'Referer': 'https://fanqienovel.com/', 'Cookie': 'gfkadpd=10006,31827; ' + (setC.split(';')[0] || '') },
  });
  console.log('retry HTTP', retry.status, 'len', retry.text.length, 'ct', retry.headers['content-type']);
  console.log('retry body:', retry.text.slice(0, 500));
} catch (e) { console.log('sso retry ERR', e.message); }

// C. muye: find QR call site & login URL
const js = (await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js')).text;
function searchKey(key, maxHits = 3, ctx = 400) {
  let idx = js.indexOf(key);
  let n = 0;
  while (idx >= 0 && n < maxHits) {
    console.log(`\n==== "${key}" @${idx}:\n` + js.slice(Math.max(0, idx - ctx), idx + ctx).replace(/\n+/g, ' '));
    idx = js.indexOf(key, idx + 1);
    n++;
  }
  if (n === 0) console.log(`\n==== "${key}": NOT FOUND`);
}
console.log('\n\n######## muye login bits');
searchKey('isShowLogin', 2, 300);
searchKey('passport/web/login', 2, 400);
searchKey('getQRCode', 2, 400);
searchKey('QRCode', 2, 300);
searchKey('passport.open', 1, 300);
