// Verify broken-form reconstruction + rank item keys.
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const r = await fetch('https://fanqienovel.com/rank', { headers: { 'User-Agent': SPIDER, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
const text = await r.text();
const idx = text.lastIndexOf('__INITIAL_STATE__=');
let i = idx + 19;
while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i++;
const semi = text.indexOf(';', i);
const lastQuote = text.lastIndexOf('"', semi > 0 ? semi : text.length);
console.log('form:', text[i] === '{' ? 'object' : text[i] === '"' ? 'string' : 'other');
const inner = text.slice(i + 1, lastQuote);
console.log('inner head:', inner.slice(0, 40));
console.log('inner tail:', inner.slice(-40));
try {
  const st = JSON.parse('{"' + inner);
  console.log('RECONSTRUCTION OK, top keys:', Object.keys(st).slice(0, 20).join(','));
  const rank = st.rank || {};
  const bl = rank.book_list || [];
  console.log('rank.book_list:', bl.length, '| rankVersion:', rank.rankVersion, '| defaultPage:', rank.defaultPage, '| total:', rank.total_num, '| typeText:', rank.rankTypeText);
  if (bl[0]) {
    console.log('item keys:', Object.keys(bl[0]).join(','));
    console.log('item:', JSON.stringify(bl[0]).slice(0, 400));
  }
  const cats = rank.rankCategoryTypeList || {};
  console.log('rankCategoryTypeList keys:', Object.keys(cats).join(','));
  console.log('male cats:', (cats.male || []).length, 'female cats:', (cats.female || []).length);
} catch (e) {
  console.log('RECONSTRUCTION FAIL:', e.message.slice(0, 100));
}
