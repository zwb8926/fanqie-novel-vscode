// Final comment list candidates + sitemap check.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BOOK = '7405108467217746969';
async function t(name, url, opts = {}) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*', ...opts.headers },
      signal: AbortSignal.timeout(20000),
      ...opts,
    });
    const text = await r.text();
    console.log(`\n[${name}] ${r.status} len=${text.length}`);
    console.log(text.slice(0, 400));
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}
const H = { 'Content-Type': 'application/json' };
await t('post-list', `https://fanqienovel.com/api/comment/get_book_comment_list`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ book_id: BOOK, page_index: 0, page_size: 10, sort_type: 1, platform: 'web' }),
});
await t('post-list2', `https://fanqienovel.com/api/comment/get_book_comment_list?book_id=${BOOK}&page_index=0&page_size=10`, {
  method: 'POST', headers: H, body: '{}',
});
await t('get-book-comment-zero', `https://fanqienovel.com/api/comment/get_book_comment?bookId=${BOOK}&commentId=0&userId=0`);
await t('robots', 'https://fanqienovel.com/robots.txt', { headers: { Accept: 'text/plain' } });
try {
  const r = await fetch('https://fanqienovel.com/sitemap.xml', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  const t2 = await r.text();
  console.log(`\n[sitemap] ${r.status} len=${t2.length}`);
  console.log(t2.slice(0, 300));
} catch (e) { console.log('\n[sitemap] FAIL', e.message); }
