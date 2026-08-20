// Research 27: SSR book page comment data + web reader URL + SDK fetch endpoints + comment list probes.
import fs from 'node:fs';
const TEMP = process.env.TEMP;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(30000), ...opts });
  return { status: r.status, text: await r.text() };
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
const BOOK = '7576659101376072728';

// A. SSR book state comment section
try {
  const st = JSON.parse(fs.readFileSync(TEMP + '/fq_book_state.json', 'utf8'));
  console.log('book state comment:', JSON.stringify(st.comment || {}).slice(0, 1200));
  console.log('\nbook state seo:', JSON.stringify(st.seo || {}).slice(0, 600));
} catch (e) { console.log('state ERR', e.message); }

// B. reader URL guesses
const js = (await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js')).text;
for (const k of ['/reader/', 'reader?', 'phoneUrl', 'chapter?', '/chapter/', 'openReader', 'goReader']) {
  const found = [];
  let idx = js.indexOf(k);
  while (idx >= 0 && found.length < 2) { found.push(idx); idx = js.indexOf(k, idx + 1); }
  if (found.length) for (const f of found) console.log(`\n-- muye "${k}" @${f}: ` + js.slice(Math.max(0, f - 220), f + 300).replace(/\n+/g, ' '));
  else console.log(`-- muye "${k}": NOT FOUND`);
}

// C. SDK js fetch endpoints
const sdk = (await getText('https://lf-cdn-tos.bytescm.com/obj/static/toutiao/feoffline/novel_reader/js/index_a5daa448.js')).text;
for (const k of ['reader/full', 'item_id', 'itemId', 'fetch(', 'XMLHttpRequest', 'novel/reader', 'api/', 'content']) {
  const found = [];
  let idx = sdk.indexOf(k);
  while (idx >= 0 && found.length < 2) { found.push(idx); idx = sdk.indexOf(k, idx + 1); }
  if (found.length) for (const f of found) console.log(`\n-- sdk "${k}" @${f}: ` + sdk.slice(Math.max(0, f - 200), f + 280).replace(/\n+/g, ' '));
  else console.log(`-- sdk "${k}": NOT FOUND`);
}

// D. comment list probes on SEO backend
const H = { 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };
await t('cl-post', `https://fanqienovel.com/api/comment/get_book_comment_list?bookId=${BOOK}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ book_id: BOOK, page_index: 0, page_size: 10 }) });
await t('cl-get-full', `https://fanqienovel.com/api/comment/get_book_comment_list?bookId=${BOOK}&page_index=0&page_size=10&platform=web&sort_type=1&group_id=${BOOK}&item_id=0`, { headers: H });
await t('cl-novel-list', `https://fanqienovel.com/api/comment/get_novel_book_comment_list?bookId=${BOOK}&page_index=0&page_size=10`, { headers: H });
