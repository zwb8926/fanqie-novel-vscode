// Debug /rank page state structure.
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const r = await fetch('https://fanqienovel.com/rank', { headers: { 'User-Agent': SPIDER, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
const text = await r.text();
console.log('status:', r.status, 'len:', text.length);
const idx = text.lastIndexOf('__INITIAL_STATE__=');
console.log('state idx:', idx);
if (idx >= 0) {
  console.log('context:', text.slice(idx, idx + 300).replace(/\s+/g, ' '));
}
// find rank-related JSON keys
for (const k of ['rankVersion', 'book_list', 'rankCategoryTypeList', 'readRankList']) {
  const i = text.indexOf(k);
  console.log(`"${k}" @`, i, i >= 0 ? text.slice(Math.max(0, i - 80), i + 120).replace(/\s+/g, ' ') : '');
}
// any server-rendered rank list in HTML?
const bl = text.indexOf('rankList');
console.log('rankList @', bl);
