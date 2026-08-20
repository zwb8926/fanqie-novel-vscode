// Debug raw state head of /rank page.
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const r = await fetch('https://fanqienovel.com/rank', { headers: { 'User-Agent': SPIDER, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
const text = await r.text();
const idx = text.lastIndexOf('__INITIAL_STATE__=');
let i = idx + 19;
while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i++;
console.log('i =', i, 'char at i:', JSON.stringify(text[i]), 'code:', text.charCodeAt(i));
console.log('slice head:', JSON.stringify(text.slice(i, i + 40)));
// how many occurrences?
let n = 0, last = -1;
for (let k = 0; (k = text.indexOf('__INITIAL_STATE__=', k)) >= 0; k++) { n++; last = k; }
console.log('occurrences:', n);
// try all occurrences
for (let k = 0; (k = text.indexOf('__INITIAL_STATE__=', k)) >= 0; k++) {
  const j = k + 19;
  const ch = text[j];
  console.log(`occurrence at ${k}: next char ${JSON.stringify(ch)}`, ch === '{' ? '' : '(not object!)');
}
