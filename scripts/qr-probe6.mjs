// Find the confirm API URL in scan-code.js (u.a request target) + any sso paths.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const js = await (await fetch('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/novel-dragon/feoffline/drweb/js/scan-code.e7bfd976e493192f3f9c.js', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).text();
function ctx(key, from = 0, len = 400, max = 4) {
  const found = [];
  let idx = js.indexOf(key, from);
  while (idx >= 0 && found.length < max) { found.push(idx); idx = js.indexOf(key, idx + 1); }
  if (!found.length) { console.log(`-- "${key}": NOT FOUND`); return; }
  for (const f of found) console.log(`\n== "${key}" @${f}:\n` + js.slice(Math.max(0, f - len), f + len).replace(/\n+/g, ' '));
}
// all URL-ish strings
const urls = [...new Set([...js.matchAll(/["'`]([^"'`]*https?[^"'`]*)["'`]/g)].map(m => m[1]))];
console.log('URLs:', urls.slice(0, 15).join('\n  '));
// path strings containing api/passport/sso/scan/qr
const paths = [...new Set([...js.matchAll(/["'`]([^"'`]{3,80})["'`]/g)].map(m => m[1]).filter(p => /(api|passport|sso|scan|qr|login|confirm|csrf)/i.test(p)))];
console.log('\npaths:', paths.slice(0, 25).join('\n  '));
