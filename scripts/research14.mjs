// Research 14: same-origin passport test, header variations, reader SDK js, more bundle constants.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BROWSER_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://fanqienovel.com/',
  'Origin': 'https://fanqienovel.com',
  'sec-ch-ua': '"Not/A)Brand";v="99", "Google Chrome";v="126", "Chromium";v="126"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};
async function req(url, opts = {}) {
  const r = await fetch(url, { headers: { ...BROWSER_HEADERS, ...opts.headers }, redirect: 'follow', signal: AbortSignal.timeout(25000), ...opts });
  const text = await r.text();
  return { status: r.status, text, headers: Object.fromEntries(r.headers.entries()) };
}
async function t(name, url, opts = {}) {
  try {
    const { status, text } = await req(url, opts);
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nURL: ${url}\nHTTP: ${status} len=${text.length}`);
    if (j) console.log('json:', JSON.stringify(j).slice(0, 700));
    else console.log('body:', text.slice(0, 200));
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}

// A. homepage headers (set-cookie?)
try {
  const { status, headers } = await req('https://fanqienovel.com/');
  console.log('homepage status:', status);
  for (const [k, v] of Object.entries(headers)) if (/cookie|set-cookie/i.test(k)) console.log('  HDR:', k, '=', v.slice(0, 200));
  console.log('  all hdr keys:', Object.keys(headers).join(','));
} catch (e) { console.log('home FAIL', e.message); }

// B. same-origin passport QR
const svc = encodeURIComponent('https://fanqienovel.com/api/author/login/url/');
await t('passport-same-origin', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=1967&app_name=novelapp&version_code=57700&device_platform=web&channel=fanqienovel`);
await t('passport-same-origin2', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=1967`);

// C. endpoints with browser headers + param fixes
await t('directory-bookId', 'https://fanqienovel.com/api/reader/directory/detail?bookId=7392138784464936459&enter_from=0');
await t('chapter-ismobile-hdr', 'https://fanqienovel.com/api/reader/full?itemId=7392244682832495129', { headers: { 'ismobile': '0' } });
await t('search-full-hdrs', 'https://fanqienovel.com/api/author/search/search_book/v1?filter=127,121,127&page_count=10&page_index=0&query_type=0&query_word=%E5%86%A4%E9%AA%82&rank_type=0');
