// Find X instance (web /passport/web/*) smsLogin definition.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const js = await (await fetch('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })).text();
function ctx(key, from, len, max) {
  const found = [];
  let idx = js.indexOf(key, from);
  while (idx >= 0 && found.length < max) { found.push(idx); idx = js.indexOf(key, idx + 1); }
  if (!found.length) { console.log(`-- "${key}": NOT FOUND`); return; }
  for (const f of found) console.log(`\n== "${key}" @${f}:\n` + js.slice(Math.max(0, f - len), f + len).replace(/\n+/g, ' '));
}
// X.smsLogin: search after 3007500 for "login_only" usage
ctx('login_only', 3007500, 600, 3);
// search the exact X sendCode block then next smsLogin
const sc = js.indexOf('type:void 0!==o&&o?16:24', 0);
console.log('\nX.sendCode at:', sc);
if (sc >= 0) console.log(js.slice(sc - 200, sc + 2200).replace(/\n+/g, ' '));
