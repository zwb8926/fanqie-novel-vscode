// Research 31: redcandle + app comment endpoint candidates.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(25000), ...opts });
  return { status: r.status, text: await r.text() };
}
async function t(name, url, opts = {}) {
  try {
    const { status, text } = await getText(url, opts);
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nURL: ${url}\nHTTP: ${status} len=${text.length}`);
    if (j) console.log('json:', JSON.stringify(j).slice(0, 700));
    else console.log('body:', text.slice(0, 150));
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}
const BOOK = '7576659101376072728';
const CH = '7576659313758831128';
const AQ = 'aid=1967&app_name=novelapp&version_code=70132&device_platform=android&os=android&ssmix=a&device_type=P30&device_brand=realme&os_version=10&update_version_code=70132&manifest_version_code=70132&channel=43536163a&iid=2187355326270644&device_id=2187355326004404';

// redcandle base
await t('rc-directory', `https://api5-sinfonlinec.jxbhmy.com/reading/bookapi/directory/all_items/v?book_id=${BOOK}&${AQ}`, { headers: { 'User-Agent': 'com.dragon.read' } });
await t('rc-chapter', `https://api5-sinfonlinec.jxbhmy.com/reading/reader/full/v?item_id=${CH}&req_type=1&${AQ}`, { headers: { 'User-Agent': 'com.dragon.read' } });
// app comment candidates (api5-normal)
for (const [n, path] of [
  ['c1', `/reading/comment/list/v?book_id=${BOOK}&item_id=${CH}&page_index=0&page_size=10&sort_type=1`],
  ['c2', `/reading/comment/list_comment/v?book_id=${BOOK}&item_id=${CH}&page_index=0&page_size=10`],
  ['c3', `/reading/comment/chapter_comment/v?book_id=${BOOK}&item_id=${CH}&page_index=0&page_size=10`],
  ['c4', `/reading/comment/paragraph/list/v?book_id=${BOOK}&item_id=${CH}&paragraph_index=0`],
  ['c5', `/reading/comment/paragraph/v?book_id=${BOOK}&item_id=${CH}&paragraph_index=0`],
]) {
  await t(n, `https://api5-normal-sinfonlineb.fqnovel.com${path}&${AQ}`, { headers: { 'User-Agent': 'com.dragon.read', 'Referer': 'https://fanqienovel.com/' } });
}
// redcandle comment candidates
for (const [n, path] of [
  ['rc-c1', `/reading/comment/list/v?book_id=${BOOK}&item_id=${CH}&page_index=0&page_size=10`],
  ['rc-c2', `/reading/comment/chapter_comment/v?book_id=${BOOK}&item_id=${CH}&page_index=0&page_size=10`],
]) {
  await t(n, `https://api5-sinfonlinec.jxbhmy.com${path}&${AQ}`, { headers: { 'User-Agent': 'com.dragon.read' } });
}
