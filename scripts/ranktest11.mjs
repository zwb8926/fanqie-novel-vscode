// Definitive byte dump of whatever form /rank returns (loop until broken form appears).
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
let brokenSeen = false;
for (let n = 1; n <= 5 && !brokenSeen; n++) {
  const r = await fetch('https://fanqienovel.com/rank', { headers: { 'User-Agent': SPIDER, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
  const text = await r.text();
  const idx = text.lastIndexOf('__INITIAL_STATE__=');
  let i = idx + 19;
  while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i++;
  const form = text[i] === '{' ? 'object' : text[i] === '"' ? 'string' : 'other';
  console.log(`fetch#${n} form=${form}`);
  if (form === 'string') {
    // check whether quotes are escaped (form B) or not (form A)
    const escaped = text[i + 1] === '\\' && text[i + 2] === '"';
    console.log('  escaped-quotes:', escaped);
    if (!escaped) {
      brokenSeen = true;
      console.log('  BYTES:', [...text.slice(i, i + 24)].map(c => c.charCodeAt(0).toString(16)).join(' '));
      console.log('  CHARS:', JSON.stringify(text.slice(i, i + 24)));
      const semi = text.indexOf(';', i);
      console.log('  tail before ;:', JSON.stringify(text.slice(semi - 60, semi)));
    }
  }
}
