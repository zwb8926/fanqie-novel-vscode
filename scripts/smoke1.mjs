// Smoke-test fanqienovel.com web API endpoints directly.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };

async function t(name, url, opts = {}) {
  try {
    const r = await fetch(url, { headers: { ...H, ...opts.headers }, signal: AbortSignal.timeout(20000), ...opts });
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nURL: ${url}\nHTTP: ${r.status}`);
    if (j) {
      const keys = j.data ? Object.keys(j.data).slice(0, 12) : [];
      console.log('code:', j.code, '| message:', j.message, '| data keys:', keys.join(','));
      if (j.data && typeof j.data === 'object') {
        const s = JSON.stringify(j.data);
        console.log('data sample:', s.slice(0, 600));
      }
    } else {
      console.log('non-JSON body:', text.slice(0, 300));
    }
  } catch (e) { console.log(`\n==== ${name}\nURL: ${url}\nFAIL: ${e.message}`); }
}

// 1. search
await t('search', 'https://fanqienovel.com/api/author/search/search_book/v1?filter=127,121,127&page_count=10&page_index=0&query_type=0&query_word=%E8%AF%A1%E7%A7%98%E4%B9%8B%E4%B8%BB&rank_type=0');
// 2. rank categories
await t('rank categories', 'https://fanqienovel.com/api/rank/category/get_rank_list/v1');
// 3. user info (no login)
await t('user info', 'https://fanqienovel.com/api/user/info/v2');
// 4. reader progress (no login)
await t('reader progress', 'https://fanqienovel.com/api/reader/book/progress');
// 5. bookshelf info (no login)
await t('bookshelf info', 'https://fanqienovel.com/reading/bookapi/bookshelf/info/v:version/?aid=1967&iid=0&version_code=57700&update_version_code=57700');
// 6. app search tab (no login)
await t('app search tab', 'https://fanqienovel.com/reading/bookapi/search/tab/v?aid=1967&iid=0&version_code=57700&update_version_code=57700');
