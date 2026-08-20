// Inspect SSR /rank book_list item shape.
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const r = await fetch('https://fanqienovel.com/rank', { headers: { 'User-Agent': SPIDER, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
const text = await r.text();
const idx = text.lastIndexOf('__INITIAL_STATE__=');
let i = idx + 19;
let depth = 0, end = -1, inStr = false, esc = false;
for (let k = i; k < text.length; k++) {
  const c = text[k];
  if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
  else if (c === '"') inStr = true;
  else if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
}
const st = JSON.parse(text.slice(i, end));
const rank = st.rank || {};
const bl = rank.book_list || [];
console.log('book_list len:', bl.length);
console.log('item[0] keys:', Object.keys(bl[0] || {}).join(','));
console.log('item[0]:', JSON.stringify(bl[0] || {}).slice(0, 600));
console.log('rankVersion:', rank.rankVersion, 'defaultPage:', rank.defaultPage, 'total:', rank.total_num, 'typeText:', rank.rankTypeText);
