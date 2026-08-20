// Analyze scan-code.js for the poll/confirm API params.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const js = await (await fetch('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/novel-dragon/feoffline/drweb/js/scan-code.e7bfd976e493192f3f9c.js', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).text();
console.log('len:', js.length);
function ctx(key, from = 0, len = 500, max = 4) {
  const found = [];
  let idx = js.indexOf(key, from);
  while (idx >= 0 && found.length < max) { found.push(idx); idx = js.indexOf(key, idx + 1); }
  if (!found.length) { console.log(`-- "${key}": NOT FOUND`); return; }
  for (const f of found) console.log(`\n== "${key}" @${f}:\n` + js.slice(Math.max(0, f - len), f + len).replace(/\n+/g, ' '));
}
for (const k of ['check_qrconnect', 'scan_qrcode', 'qrcode_token', 'qr_source_aid', 'token', 'next_url', 'confirm', 'sso/']) {
  ctx(k);
}
// endpoints
const urls = [...new Set([...js.matchAll(/["'`]([^"'`]*(?:api|passport|sso)[^"'`]*)["'`]/g)].map(m => m[1]))];
console.log('\nAPI strings:', urls.slice(0, 20).join('\n  '));
