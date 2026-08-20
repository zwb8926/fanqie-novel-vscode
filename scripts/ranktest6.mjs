// Minimal repro of double-encoded state extraction on /rank page.
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const r = await fetch('https://fanqienovel.com/rank', { headers: { 'User-Agent': SPIDER, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
const text = await r.text();
const idx = text.lastIndexOf('__INITIAL_STATE__=');
let i = idx + 19;
while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i++;

// quoted scan
let k = i + 1, esc = false, closing = -1;
for (; k < text.length; k++) {
  const c = text[k];
  if (esc) esc = false;
  else if (c === '\\') esc = true;
  else if (c === '"') { closing = k; break; }
}
console.log('closing quote at:', closing, 'len:', text.length);
if (closing > 0) {
  const raw = text.slice(i, closing + 1);
  console.log('outer parse...');
  try {
    const inner = JSON.parse(raw);
    console.log('inner type:', typeof inner, 'len:', inner.length);
    try {
      const st = JSON.parse(inner);
      console.log('state parsed OK. top keys:', Object.keys(st).join(','));
      console.log('rank.book_list:', st.rank?.book_list?.length, 'rankVersion:', st.rank?.rankVersion);
    } catch (e) {
      console.log('inner parse FAIL:', e.message.slice(0, 120));
      console.log('inner head:', inner.slice(0, 100));
    }
  } catch (e) {
    console.log('outer parse FAIL:', e.message.slice(0, 120));
    console.log('raw head:', raw.slice(0, 120));
  }
}
