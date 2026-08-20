// Research 26: find the book comment LIST API via muye state handlers + ugc backend.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(40000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
const js = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js');
function ctx(k, from = 0, len = 500, max = 3) {
  const found = [];
  let idx = js.indexOf(k, from);
  while (idx >= 0 && found.length < max) { found.push(idx); idx = js.indexOf(k, idx + 1); }
  if (!found.length) { console.log(`-- "${k}": NOT FOUND`); return; }
  for (const f of found) console.log(`-- "${k}" @${f}: ` + js.slice(Math.max(0, f - len), f + len).replace(/\n+/g, ' '));
}
// how state.comment gets filled
ctx('comment.data', 220000, 400, 3);
ctx('setComment', 0, 400, 3);
ctx('"comment"', 0, 300, 5);
// ugc backend
ctx('ugc', 0, 350, 4);
ctx('book/comment', 0, 400, 4);
ctx('comment/book', 0, 400, 4);
ctx('novel/comment', 0, 400, 4);
// get_book_comment usage site
ctx('get_book_comment', 105000, 700, 2);
// fetch comment list endpoint via network patterns: search "/api/" constants near comment
ctx('/api/comment', 0, 500, 3);
