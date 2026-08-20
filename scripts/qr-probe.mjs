// Find getQRCode / checkQRConnect call sites in muye bundle.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const js = await (await fetch('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })).text();
function ctx(key, from = 0, len = 700, max = 4) {
  const found = [];
  let idx = js.indexOf(key, from);
  while (idx >= 0 && found.length < max) { found.push(idx); idx = js.indexOf(key, idx + 1); }
  if (!found.length) { console.log(`-- "${key}": NOT FOUND`); return; }
  for (const f of found) console.log(`\n== "${key}" @${f}:\n` + js.slice(Math.max(0, f - len), f + len).replace(/\n+/g, ' '));
}
ctx('getQRCode', 0, 500, 4);
ctx('GET_QRCODE', 0, 500, 3);
ctx('check_qrconnect', 0, 400, 3);
ctx('getQRCodeUrl', 0, 400, 3);
