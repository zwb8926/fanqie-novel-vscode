// Fetch /rank multiple times; characterize each serialization form.
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
for (let n = 1; n <= 3; n++) {
  const r = await fetch('https://fanqienovel.com/rank', { headers: { 'User-Agent': SPIDER, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
  const text = await r.text();
  const idx = text.lastIndexOf('__INITIAL_STATE__=');
  let i = idx + 19;
  while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i++;
  const form = text[i] === '{' ? 'object' : text[i] === '"' ? 'string' : 'other(' + JSON.stringify(text[i]) + ')';
  console.log(`fetch#${n}: form=${form}`);
  console.log('  head:', JSON.stringify(text.slice(i, i + 90)));
  if (form === 'string') {
    // find what follows after `common"`
    const afterCommon = text.indexOf('common', i);
    console.log('  after common:', JSON.stringify(text.slice(afterCommon, afterCommon + 60)));
    // find the end of the quoted string: last quote before `;`
    const semi = text.indexOf(';', i);
    console.log('  before semi:', JSON.stringify(text.slice(semi - 40, semi)));
  }
}
