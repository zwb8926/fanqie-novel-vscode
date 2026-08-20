// Research 13: reader SDK JS endpoints + rank endpoints + empty-body diagnosis.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(40000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}

// A. reader SDK page -> JS files
const page = await getText('https://api.fanqiesdk.com/feoffline/novel_reader/novel/book/reader/v2/page/index.html');
const scripts = [...page.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
console.log('reader sdk scripts:', JSON.stringify(scripts));
const bases = ['https://api.fanqiesdk.com/feoffline/novel_reader/novel/book/reader/v2/page/', 'https://api.fanqiesdk.com/feoffline/novel_reader/novel/book/reader/v2/'];
for (const s of scripts) {
  const url = s.startsWith('http') ? s : (s.startsWith('/') ? 'https://api.fanqiesdk.com' + s : bases[0] + s);
  try {
    const js = await getText(url);
    console.log(`\n### ${url} len=${js.length}`);
    for (const key of ['comment', 'paragraph', 'directory', 'chapter', 'itemId', 'api/', 'content', 'reply']) {
      const idx = js.indexOf(key);
      if (idx >= 0) console.log(`  -- "${key}" @${idx}: ` + js.slice(Math.max(0, idx - 120), idx + 220).replace(/\n+/g, ' '));
    }
  } catch (e) { console.log('ERR', url, e.message); }
}

// B. rank endpoints in muye bundle
const js = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js');
function searchKey(key, maxHits = 4, ctx = 400) {
  let idx = js.indexOf(key);
  let n = 0;
  while (idx >= 0 && n < maxHits) {
    console.log(`\n==== "${key}" @${idx}:\n` + js.slice(Math.max(0, idx - ctx), idx + ctx).replace(/\n+/g, ' '));
    idx = js.indexOf(key, idx + 1);
    n++;
  }
  if (n === 0) console.log(`\n==== "${key}": NOT FOUND`);
}
searchKey('rankCategoryTypeList', 2, 500);
searchKey('rankCategoryList', 2, 400);
searchKey('get_rank', 3, 300);
searchKey('.douyin', 2, 300);
searchKey('page_index', 2, 250);
searchKey('passport/web/get_qrcode', 1, 200);
searchKey('gfkadpd', 1, 200);
