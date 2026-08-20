// Research 15: passport SDK params, rank constants, reader SDK comment logic.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(40000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
const js = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js');
function searchKey(key, maxHits = 3, ctx = 500) {
  let idx = js.indexOf(key);
  let n = 0;
  while (idx >= 0 && n < maxHits) {
    console.log(`\n==== "${key}" @${idx}:\n` + js.slice(Math.max(0, idx - ctx), idx + ctx).replace(/\n+/g, ' '));
    idx = js.indexOf(key, idx + 1);
    n++;
  }
  if (n === 0) console.log(`\n==== "${key}": NOT FOUND`);
}

// rank & editor constants (before serial_rank_category_list_common)
searchKey('serial_rank_category_list_common', 2, 900);
// search form params
searchKey('query_word:', 2, 600);
searchKey('filter:', 2, 400);
// passport sdk config
searchKey('passport_sdk_version', 2, 400);
searchKey('biz_params', 2, 400);
searchKey('get_qrcode', 3, 300);
// reader sdk js
console.log('\n\n######## reader SDK js');
for (const f of ['index_a5daa448.js', 'commons_a9af0ae9.js']) {
  try {
    const sdk = await getText(`https://lf-cdn-tos.bytescm.com/obj/static/toutiao/feoffline/novel_reader/js/${f}`);
    console.log(`\n### ${f} len=${sdk.length}`);
    for (const key of ['comment', 'paragraph', 'chapterData', 'itemId', 'directory', 'api/reader', '段评', '章评']) {
      const idx = sdk.indexOf(key);
      if (idx >= 0) console.log(`  -- "${key}" @${idx}: ` + sdk.slice(Math.max(0, idx - 150), idx + 250).replace(/\n+/g, ' '));
    }
  } catch (e) { console.log('ERR', f, e.message); }
}
