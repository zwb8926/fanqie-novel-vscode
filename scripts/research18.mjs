// Research 18: real book id tests + comment page SSR + passport sdk config in bundle.
import fs from 'node:fs';
const TEMP = process.env.TEMP;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(30000), ...opts });
  return { status: r.status, text: await r.text(), headers: Object.fromEntries(r.headers.entries()) };
}
async function t(name, url, opts = {}) {
  try {
    const { status, text } = await getText(url, opts);
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nHTTP: ${status} len=${text.length}`);
    if (j) console.log('json:', JSON.stringify(j).slice(0, 900));
    else console.log('body:', text.slice(0, 200));
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}
const H = { 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };
const BOOK = '7576659101376072728';
const CH = '7576659313758831128';

await t('directory-real', `https://fanqienovel.com/api/reader/directory/detail?bookId=${BOOK}&enter_from=0`, { headers: H });
await t('chapter-real', `https://fanqienovel.com/api/reader/full?itemId=${CH}`, { headers: H });
await t('chapter-real2', `https://fanqienovel.com/api/reader/full/chapter/detail?bookId=${BOOK}&itemId=${CH}`, { headers: H });
await t('book-detail', `https://fanqienovel.com/api/reader/full/book/detail?bookId=${BOOK}`, { headers: H });
await t('search-real', `https://fanqienovel.com/api/author/search/search_book/v1?query_word=${encodeURIComponent('灵根')}&page_count=10&page_index=0&filter=127,121,127&rank_type=0&query_type=0`, { headers: H });

// comment page SSR
try {
  const { status, text } = await getText(`https://fanqienovel.com/comment?bookId=${BOOK}`, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
  console.log(`\ncomment page HTTP ${status} len=${text.length}`);
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
      const st = JSON.parse(text.slice(i, end));
      fs.writeFileSync(TEMP + '/fq_comment_state.json', text.slice(i, end));
      const c = st.comment || {};
      console.log('comment state keys:', Object.keys(c).join(','));
      console.log('comment state:', JSON.stringify(c).slice(0, 1500));
    }
  }
} catch (e) { console.log('comment page ERR', e.message); }

// passport sdk config in bundle
const js = (await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js')).text;
function searchKey(key, maxHits = 3, ctx = 500) {
  let idx = js.indexOf(key);
  let n = 0;
  while (idx >= 0 && n < maxHits) {
    console.log(`\n==== "${key}" @${idx}:\n` + js.slice(Math.max(0, idx - ctx), idx + ctx).replace(/\n+/g, ' '));
    idx = js.indexOf(key, idx + 1);
    n++;
  }
  if (n === 0) console.log(`\n==== "${key}": NOT FOUND`);
}
console.log('\n\n######## bundle: passport/qrcode/service');
searchKey('byted_acrawler', 2, 400);
searchKey('"service"', 3, 300);
searchKey('qrcode', 3, 300);
searchKey('scan_qrcode', 2, 400);
