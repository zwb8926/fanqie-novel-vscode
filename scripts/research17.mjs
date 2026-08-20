// Research 17: real book ids, comment list endpoints, passport params, challenge html.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
import fs from 'node:fs';
const TEMP = process.env.TEMP;
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(30000), ...opts });
  return { status: r.status, text: await r.text(), headers: Object.fromEntries(r.headers.entries()) };
}
async function t(name, url, opts = {}) {
  try {
    const { status, text } = await getText(url, opts);
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nHTTP: ${status} len=${text.length}`);
    if (j) console.log('json:', JSON.stringify(j).slice(0, 800));
    else console.log('body:', text.slice(0, 300));
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}
const H = { 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };

// A. extract __INITIAL_STATE__
try {
  const { text } = await getText('https://fanqienovel.com/');
  const start = text.indexOf('__INITIAL_STATE__=');
  if (start >= 0) {
    let i = start + '__INITIAL_STATE__='.length;
    while (text[i] === ' ' || text[i] === '\n') i++;
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let k = i; k < text.length; k++) {
      const c = text[k];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
      else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
    }
    if (end > 0) {
      const raw = text.slice(i, end);
      fs.writeFileSync(TEMP + '/fq_state.json', raw);
      const st = JSON.parse(raw);
      console.log('\nstate top keys:', Object.keys(st).join(','));
      const rec = st.recommend || st.bookstore || st.home || {};
      console.log('state.recommend keys:', Object.keys(rec).slice(0, 20).join(','));
      const s = JSON.stringify(st);
      const ids = [...s.matchAll(/"book_id":(\d+)/g)].slice(0, 20).map(m => m[1]);
      console.log('book_ids found:', ids.join(','));
      fs.writeFileSync(TEMP + '/fq_state_ids.txt', ids.join('\n'));
    }
  }
} catch (e) { console.log('state ERR', e.message); }

// B. rank with gender
await t('rank-male', 'https://fanqienovel.com/api/rank/category/list?app_id=2503&rank_list_type=3&offset=0&limit=10&category_id=1140&gender=male&rank_version=', { headers: H });
await t('rank-male2', 'https://fanqienovel.com/api/rank/category/list?app_id=2503&rank_list_type=1&offset=0&limit=10&category_id=0&gender=male', { headers: H });

// C. passport aid=2503 variants
const svc = encodeURIComponent('https://fanqienovel.com/api/author/login/url/');
await t('p2503a', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=2503&app_name=novelapp&version_code=57700&device_platform=web&sdk_version=7.0.1.32&passport_sdk_version=2.0.0`, { headers: H });
await t('p2503b', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=2503&app_name=novelapp&version_code=57700&device_platform=web&new_user=0`, { headers: H });
await t('p2503c', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&update_version_code=57700&manifest_version_code=57700`, { headers: H });

// D. muye comment/paragraph paths
const js = (await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js')).text;
console.log('\n\n######## muye comment paths:');
let idx = -1, n = 0;
while ((idx = js.indexOf('comment', idx + 1)) >= 0 && n < 30) {
  console.log(`@${idx}: ` + js.slice(Math.max(0, idx - 120), idx + 180).replace(/\n+/g, ' '));
  n++;
}
console.log('\n######## muye paragraph hits:');
idx = -1; n = 0;
while ((idx = js.indexOf('paragraph', idx + 1)) >= 0 && n < 10) {
  console.log(`@${idx}: ` + js.slice(Math.max(0, idx - 120), idx + 180).replace(/\n+/g, ' '));
  n++;
}

// E. sso challenge full html
try {
  const { text } = await getText(`https://sso.douyin.com/get_qr_code/?service=${svc}&need_validate=0`, { headers: { 'Referer': 'https://fanqienovel.com/' } });
  fs.writeFileSync(TEMP + '/sso_challenge.html', text);
  console.log('\n\n######## sso challenge len:', text.length);
  console.log(text.slice(0, 2500));
} catch (e) { console.log('sso ERR', e.message); }
