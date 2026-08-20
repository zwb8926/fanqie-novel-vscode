// Research 32: all API constants in the reader SDK (o.b.* / Object(b.h) calls).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
const sdk = await getText('https://lf-cdn-tos.bytescm.com/obj/static/toutiao/feoffline/novel_reader/js/index_a5daa448.js');
console.log('sdk len:', sdk.length);
// find the o.b constants object definition
const m = sdk.match(/b=\{[^;]{0,4000}\}/);
if (m) console.log('\no.b constants:\n' + m[0].slice(0, 4000));
// fallback: find "PAY_SINGLE_INFO" definition
const i1 = sdk.indexOf('PAY_SINGLE_INFO');
console.log('\nPAY_SINGLE_INFO @', i1, ':', i1 >= 0 ? sdk.slice(i1 - 400, i1 + 300) : '');
// find all "/reading" or "/api" or "novel" endpoint strings
const paths = [...sdk.matchAll(/["'](\/[a-zA-Z0-9_\/:]+)["']/g)].map(m => m[1]).filter(p => /(comment|reader|directory|chapter|item|book|content|danmaku|paragraph|reply)/.test(p));
console.log('\nendpoint-ish strings:', [...new Set(paths)].join('\n'));
// all "GET|POST" helper calls with first arg
const calls = [...sdk.matchAll(/Object\(b\.h\)\("(GET|POST)","([^"]+)"/g)].map(m => m[1] + ' ' + m[2]);
console.log('\nb.h calls:', [...new Set(calls)].join('\n'));
// comment-related strings
for (const k of ['comment', 'danmaku', 'paragraph', 'reply']) {
  const hits = [];
  let idx = sdk.indexOf(k);
  while (idx >= 0 && hits.length < 5) { hits.push(idx); idx = sdk.indexOf(k, idx + 1); }
  if (hits.length) {
    console.log(`\n"${k}" hits: ${hits.length}`);
    for (const h of hits.slice(0, 3)) console.log('  @' + h + ': ' + sdk.slice(Math.max(0, h - 130), h + 200).replace(/\n+/g, ' '));
  }
}
