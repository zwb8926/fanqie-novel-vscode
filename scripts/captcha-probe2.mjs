// Find the captcha renderer (N) implementation: JS URL, TTGCaptcha params, replay logic.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const js = await (await fetch('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })).text();
function ctx(key, from, len, max = 2) {
  const found = [];
  let idx = js.indexOf(key, from);
  while (idx >= 0 && found.length < max) { found.push(idx); idx = js.indexOf(key, idx + 1); }
  if (!found.length) { console.log(`-- "${key}": NOT FOUND`); return; }
  for (const f of found) console.log(`\n== "${key}" @${f}:\n` + js.slice(Math.max(0, f - len), f + len).replace(/\n+/g, ' '));
}
ctx('verifyData', 3003000, 700, 3);
ctx('x-tt-passport-replay-params', 0, 600, 2);
ctx('sec_sdk_build', 0, 500, 3);
ctx('captcha/index.js', 0, 400, 2);
ctx('risk_verify', 0, 400, 2);
