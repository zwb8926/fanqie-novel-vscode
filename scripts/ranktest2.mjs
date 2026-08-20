// Find correct params for the "全部" (all categories) rank list.
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36', Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };
async function getText(url, headers = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
  return { status: r.status, text: await r.text() };
}
function extract(html) {
  const idx = html.lastIndexOf('__INITIAL_STATE__=');
  if (idx < 0) return null;
  let i = idx + 19;
  while (i < html.length && (html[i] === ' ' || html[i] === '\n')) i++;
  if (html[i] === '"') {
    let k = i + 1, esc = false;
    for (; k < html.length; k++) {
      const c = html[k];
      if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') break;
    }
    try {
      const inner = JSON.parse(html.slice(i, k + 1));
      return typeof inner === 'string' ? JSON.parse(inner) : inner;
    } catch { return null; }
  }
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let k = i; k < html.length; k++) {
    const c = html[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  if (end <= 0) return null;
  try { return JSON.parse(html.slice(i, end)); } catch { return null; }
}

// 1. rank page SSR state
const { status, text } = await getText('https://fanqienovel.com/rank', { 'User-Agent': SPIDER, Accept: 'text/html' });
console.log('rank page:', status, 'len:', text.length);
const st = extract(text);
if (st) {
  const r = st.rank || {};
  console.log('rank state keys:', Object.keys(r).join(','));
  console.log('rankVersion:', r.rankVersion, '| defaultPage:', r.defaultPage, '| total:', r.total_num, '| typeText:', r.rankTypeText);
  const bl = r.book_list || [];
  console.log('book_list:', bl.length, 'first:', JSON.stringify(bl[0] || {}).slice(0, 200));
  console.log('readRankList:', Array.isArray(r.readRankList) ? r.readRankList.length : typeof r.readRankList, 'first:', JSON.stringify((r.readRankList || [])[0] || {}).slice(0, 150));
  console.log('newRankList:', Array.isArray(r.newRankList) ? r.newRankList.length : typeof r.newRankList);
  console.log('rankCategoryTypeList sample:', JSON.stringify((r.rankCategoryTypeList || []).slice(0, 2)).slice(0, 200));
}

// 2. try rank_version values with cat=0
for (const rv of ['', '6', '5', '1', '2']) {
  const url = `https://fanqienovel.com/api/rank/category/list?app_id=2503&rank_list_type=3&offset=0&limit=24&category_id=0&rank_version=${rv}&gender=male&rankMold=`;
  try {
    const r = await getText(url, H);
    const j = JSON.parse(r.text);
    console.log(`[cat=0 rv='${rv}'] code=${j.code} books=${j.data?.book_list?.length ?? 'n/a'} typeText=${j.data?.rankTypeText ?? ''}`);
  } catch (e) { console.log(`[cat=0 rv='${rv}'] FAIL ${e.message}`); }
}
// 3. maybe "全部" needs gender+rankMold combos
for (const mold of ['1', '2', '3', '4']) {
  const url = `https://fanqienovel.com/api/rank/category/list?app_id=2503&rank_list_type=3&offset=0&limit=24&category_id=0&rank_version=&gender=male&rankMold=${mold}`;
  try {
    const r = await getText(url, H);
    const j = JSON.parse(r.text);
    console.log(`[cat=0 mold=${mold}] code=${j.code} books=${j.data?.book_list?.length ?? 'n/a'}`);
  } catch (e) { console.log(`[cat=0 mold=${mold}] FAIL ${e.message}`); }
}
