// Research 20: login callback endpoint, SSR book page structure, passport final tries, state login URLs.
import fs from 'node:fs';
const TEMP = process.env.TEMP;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(30000), ...opts });
  return { status: r.status, text: await r.text() };
}
async function t(name, url, opts = {}) {
  try {
    const { status, text } = await getText(url, opts);
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nHTTP: ${status} len=${text.length}`);
    if (j) console.log('json:', JSON.stringify(j).slice(0, 600));
    else console.log('body:', text.slice(0, 200));
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}
const H = { 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };
const svc = encodeURIComponent('https://fanqienovel.com/api/author/login/url/');

await t('login-callback', 'https://fanqienovel.com/api/author/login/url/', { headers: H });
await t('p2503-full', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&os_version=10&device_type=P30&iid=2187355326270644&device_id=2187355326004404&update_version_code=57700&manifest_version_code=57700&new_user=0&app_version=7.0.1.32`, { headers: H });
await t('p2503-short', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&aid=2503&need_validate=0&sdk_version=2.0.0`, { headers: H });

// SSR book page for real book
try {
  const { status, text } = await getText(`https://fanqienovel.com/page/7576659101376072728`, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
  console.log(`\n==== ssr-book-page-real HTTP ${status} len=${text.length}`);
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
      fs.writeFileSync(TEMP + '/fq_book_state.json', raw);
      const st = JSON.parse(raw);
      const page = st.page || {};
      console.log('state keys:', Object.keys(st).join(','));
      console.log('page keys:', Object.keys(page).slice(0, 30).join(','));
      console.log('page.sample:', JSON.stringify({ bookId: page.bookId, bookName: page.bookName, author: page.author, chapterTotal: page.chapterTotal, chapterList: (page.chapterList || []).length, chapterListWithVolume: (page.chapterListWithVolume || []).length, itemIds: (page.itemIds || []).length, abstract: (page.abstract || '').slice(0, 80) }));
      console.log('reader keys:', Object.keys(st.reader || {}).join(','));
      console.log('reader.sample:', JSON.stringify(st.reader).slice(0, 400));
    } else console.log('no state found');
  }
} catch (e) { console.log('ssr book ERR', e.message); }

// homepage state login URLs
try {
  const st = JSON.parse(fs.readFileSync(TEMP + '/fq_state.json', 'utf8'));
  const s = JSON.stringify(st);
  const idx = s.indexOf('login');
  console.log('\nhome state "login" @', idx, ':', idx >= 0 ? s.slice(Math.max(0, idx - 300), idx + 300) : '');
} catch (e) { console.log('state read ERR', e.message); }
