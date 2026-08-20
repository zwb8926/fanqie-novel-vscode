// Char-by-char scan debug.
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const r = await fetch('https://fanqienovel.com/rank', { headers: { 'User-Agent': SPIDER, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
const text = await r.text();
const idx = text.lastIndexOf('__INITIAL_STATE__=');
let i = idx + 19;
while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i++;
console.log('idx:', idx, 'i:', i);
for (let k = i; k < i + 24; k++) {
  console.log(k, JSON.stringify(text[k]), 'code', text.charCodeAt(k));
}
// Also check the char right before idx
console.log('before idx:', JSON.stringify(text.slice(idx - 30, idx)));
// find the actual end of the state: look for `";` or `"` followed by <script or newline after the last }
const after = text.slice(idx);
const endMark = after.indexOf('</script>');
console.log('</script> at relative:', endMark);
// show tail: chars around relative (endMark - 60)
console.log('tail:', JSON.stringify(after.slice(endMark - 80, endMark + 20)));
