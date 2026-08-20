// Print the full __INITIAL_STATE__ assignment line as raw text.
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const r = await fetch('https://fanqienovel.com/rank', { headers: { 'User-Agent': SPIDER, Accept: 'text/html' }, signal: AbortSignal.timeout(25000) });
const text = await r.text();
const idx = text.lastIndexOf('__INITIAL_STATE__=');
console.log('RAW:', text.slice(idx - 25, idx + 260).replace(/\n/g, '\\n'));
console.log('\n--- tail ---');
const endMark = text.indexOf('</script>', idx);
console.log('RAW TAIL:', text.slice(endMark - 260, endMark + 10).replace(/\n/g, '\\n'));
