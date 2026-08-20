// Research 12: live-test discovered endpoints + fetch official reader SDK page.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(30000), ...opts });
  return { status: r.status, text: await r.text() };
}

async function t(name, url, opts = {}) {
  try {
    const { status, text } = await getText(url, opts);
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nURL: ${url}\nHTTP: ${status} len=${text.length}`);
    if (j) {
      console.log('code:', j.code, '| msg:', j.message);
      const s = JSON.stringify(j).slice(0, 800);
      console.log('json:', s);
    } else {
      console.log('body:', text.slice(0, 300));
    }
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}

const H = { 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };

// 1. chapter content endpoint (from bundle: url=/api/reader/full, params={itemId, ismobile})
await t('chapter-full', 'https://fanqienovel.com/api/reader/full?itemId=7392244682832495129&ismobile=0', { headers: H });
// 2. directory
await t('directory', 'https://fanqienovel.com/api/reader/directory/detail?book_id=7392138784464936459&enter_from=0', { headers: H });
// 3. search with params from old impl
await t('search-old', 'https://fanqienovel.com/api/author/search/search_book/v1?filter=127,121,127&page_count=10&page_index=0&query_type=0&query_word=%E5%86%A4%E9%AA%82&rank_type=0', { headers: H });
// 4. user info v2
await t('user-info-v2', 'https://fanqienovel.com/api/user/info/v2', { headers: H });
// 5. reader user info
await t('reader-user-info', 'https://fanqienovel.com/api/reader/user/info', { headers: H });
// 6. rank categories
await t('rank-cats', 'https://fanqienovel.com/api/rank/category/get_rank_list/v1', { headers: H });
// 7. book comment (need bookId+commentId+userId; use placeholder to see response)
await t('book-comment', 'https://fanqienovel.com/api/comment/get_book_comment?bookId=7392138784464936459&commentId=0&userId=0', { headers: H });
// 8. official reader SDK page
await t('reader-sdk-page', 'https://api.fanqiesdk.com/feoffline/novel_reader/novel/book/reader/v2/page/index.html', { headers: H });
