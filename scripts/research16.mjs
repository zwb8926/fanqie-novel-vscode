// Research 16: chapter/search variants, passport param combos, full comment occurrences in SDK.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(30000), ...opts });
  return { status: r.status, text: await r.text(), headers: Object.fromEntries(r.headers.entries()) };
}
async function t(name, url, opts = {}) {
  try {
    const { status, text, headers } = await getText(url, opts);
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nURL: ${url}\nHTTP: ${status} len=${text.length} ct=${headers['content-type'] || ''}`);
    if (j) console.log('json:', JSON.stringify(j).slice(0, 600));
    else console.log('body:', text.slice(0, 150));
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}
const H = { 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };

// A. chapter variants
await t('ch1', 'https://fanqienovel.com/api/reader/full/chapter/detail?bookId=7392138784464936459&itemId=7392244682832495129', { headers: H });
await t('ch2', 'https://fanqienovel.com/api/reader/full?itemId=7392244682832495129&bookId=7392138784464936459', { headers: { ...H, ismobile: '0' } });
await t('ch3-mobile', 'https://fanqienovel.com/api/reader/full?itemId=7392244682832495129', { headers: { ...H, ismobile: '1' } });
// B. search variants
await t('s1', 'https://fanqienovel.com/api/author/search/search_book/v1?query_word=%E5%86%A4%E9%AA%82&page_count=10&page_index=0', { headers: H });
await t('s2', 'https://fanqienovel.com/api/author/search/search_book/v1?query_word=%E5%86%A4%E9%AA%82&page_count=10&page_index=0&filter=127,121,127&rank_type=0&query_type=0&biz_id=1', { headers: H });
await t('s3-post', 'https://fanqienovel.com/api/author/search/search_book/v1?query_word=%E5%86%A4%E9%AA%82&page_count=10&page_index=0', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: '{}' });
// C. rank endpoints
await t('rank-list', 'https://fanqienovel.com/api/rank/category/list?app_id=2503&rank_list_type=3&offset=0&limit=10&category_id=0', { headers: H });
await t('rank-cats-config', 'https://fanqienovel.com/api/config/list?config_key=serial_rank_category_list_common', { headers: H });
await t('editor-list', 'https://fanqienovel.com/api/editor/list', { headers: H });
// D. passport combos
const svc = encodeURIComponent('https://fanqienovel.com/api/author/login/url/');
await t('p1', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=1967&app_name=novelapp&version_code=70132&device_platform=android&sdk_version=7.0.1.32`, { headers: H });
await t('p2', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=2503&app_name=novelapp&version_code=57700&device_platform=web`, { headers: H });
await t('p3', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=6383&app_name=aweme&version_code=190400&device_platform=web&channel=aweme`, { headers: H });
// E. SSR book page check
await t('ssr-book-page', 'https://fanqienovel.com/page/7392138784464936459', { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
// F. all comment occurrences in reader SDK
const sdk = (await getText('https://lf-cdn-tos.bytescm.com/obj/static/toutiao/feoffline/novel_reader/js/index_a5daa448.js')).text;
console.log('\n\n######## SDK comment occurrences:');
let idx = -1, n = 0;
while ((idx = sdk.indexOf('comment', idx + 1)) >= 0 && n < 40) {
  console.log(`@${idx}: ` + sdk.slice(Math.max(0, idx - 130), idx + 200).replace(/\n+/g, ' '));
  n++;
}
console.log('total comment hits:', n);
// G. SDK: how chapter content is fetched
for (const key of ['reader/full', 'getChapter', 'itemId', 'chapterData', 'api/']) {
  const i = sdk.indexOf(key);
  if (i >= 0) console.log(`\nSDK "${key}" @${i}: ` + sdk.slice(Math.max(0, i - 160), i + 260).replace(/\n+/g, ' '));
}
