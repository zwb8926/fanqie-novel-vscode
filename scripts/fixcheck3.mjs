// Inspect /comment/{bookId}-0 page state for comment list.
const UA = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const r = await fetch('https://fanqienovel.com/comment/7405108467217746969-0', {
  headers: { 'User-Agent': UA, Accept: 'text/html' },
  signal: AbortSignal.timeout(30000),
});
const text = await r.text();
console.log('status:', r.status, 'len:', text.length);
const start = text.lastIndexOf('__INITIAL_STATE__=');
if (start < 0) { console.log('no state'); process.exit(0); }
let i = start + 19;
while (text[i] === ' ' || text[i] === '\n') i++;
let depth = 0, end = -1, inStr = false, esc = false;
for (let k = i; k < text.length; k++) {
  const c = text[k];
  if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
  else if (c === '"') inStr = true;
  else if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
}
if (end <= 0) { console.log('no state end'); process.exit(0); }
console.log('raw head:', JSON.stringify(text.slice(i, i + 60)));
const st = JSON.parse(text.slice(i, end));
const c = st.comment || {};
console.log('comment keys:', Object.keys(c).join(','));
console.log('comment data:', JSON.stringify(c.data).slice(0, 2000));
