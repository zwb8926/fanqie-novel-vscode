// Research 25: app API without signature + comment list endpoint discovery.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(25000), ...opts });
  return { status: r.status, text: await r.text() };
}
async function t(name, url, opts = {}) {
  try {
    const { status, text } = await getText(url, opts);
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nHTTP: ${status} len=${text.length}`);
    if (j) console.log('json:', JSON.stringify(j).slice(0, 700));
    else console.log('body:', text.slice(0, 150));
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}
const CH = '7576659313758831128';
const BOOK = '7576659101376072728';

// app batch_full without signature (luochaolun style)
await t('app-batch-full', `https://api5-normal-sinfonlineb.fqnovel.com/reading/reader/batch_full/v?item_ids=${CH}&book_id=${BOOK}&novel_text_type=1&req_type=1&aid=1967&app_name=novelapp&version_code=70132&device_platform=android&os=android&ssmix=a&device_type=P30&device_brand=realme&os_version=10&update_version_code=70132&manifest_version_code=70132&channel=43536163a`, { headers: { 'User-Agent': 'com.dragon.read', 'Referer': 'https://fanqienovel.com/' } });
// app reader/full (single chapter)
await t('app-reader-full', `https://reading.snssdk.com/reading/reader/full/v?item_id=${CH}&req_type=1&aid=1967&app_name=novelapp&version_code=70132&device_platform=android&os=android&ssmix=a&device_type=P30&device_brand=realme&os_version=10&update_version_code=70132&manifest_version_code=70132&channel=43536163a`, { headers: { 'User-Agent': 'com.dragon.read', 'Referer': 'https://fanqienovel.com/' } });

// comment list endpoint guesses on fanqienovel.com
const H = { 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };
await t('cl1', `https://fanqienovel.com/api/comment/get_book_comment_list?bookId=${BOOK}&page_index=0&page_size=10`, { headers: H });
await t('cl2', `https://fanqienovel.com/api/comment/get_book_comment_list?book_id=${BOOK}&page_index=0&page_size=10&sort_type=1`, { headers: H });
await t('cl3', `https://fanqienovel.com/api/comment/book_comment_list?bookId=${BOOK}&page_index=0&page_size=10`, { headers: H });
await t('cl4', `https://fanqienovel.com/api/comment/list?bookId=${BOOK}&page_index=0&page_size=10`, { headers: H });

// muye: comment list constants
const js = (await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js')).text;
for (const k of ['get_book_comment_list', 'book_comment_list', 'comment_list', 'get_book_comments', 'comments/v', 'comment/detail']) {
  const found = [];
  let idx = js.indexOf(k);
  while (idx >= 0 && found.length < 2) { found.push(idx); idx = js.indexOf(k, idx + 1); }
  if (found.length) for (const f of found) console.log(`\n-- muye "${k}" @${f}: ` + js.slice(Math.max(0, f - 250), f + 300).replace(/\n+/g, ' '));
  else console.log(`-- muye "${k}": NOT FOUND`);
}
