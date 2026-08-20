// Research 11: substring search muye.js for exact API paths & login host usage.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
const js = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js');
console.log('bundle len:', js.length);

function searchKey(key, maxHits = 4, ctx = 320) {
  let idx = js.indexOf(key);
  let n = 0;
  while (idx >= 0 && n < maxHits) {
    console.log(`\n==== "${key}" @${idx}:\n` + js.slice(Math.max(0, idx - ctx), idx + ctx).replace(/\n+/g, ' '));
    idx = js.indexOf(key, idx + 1);
    n++;
  }
  if (n === 0) console.log(`\n==== "${key}": NOT FOUND`);
}

// login host & flow
searchKey('passport/web/get_qrcode', 2, 500);
searchKey('sso.douyin', 2, 400);
searchKey('login/url', 3, 400);
searchKey('author/login', 2, 400);
// reader routes & api paths
searchKey('"reader/', 2, 200);
searchKey('/reader/full', 2, 300);
searchKey('directory', 2, 300);
searchKey('all_items', 2, 300);
searchKey('search_book', 2, 300);
searchKey('search/tab', 2, 300);
searchKey('multi-detail', 2, 300);
searchKey('bookapi', 3, 300);
searchKey('/api/comment', 3, 400);
searchKey('comment/list', 3, 400);
searchKey('reply', 3, 200);
searchKey('rank', 2, 250);
searchKey('user/info', 3, 300);
