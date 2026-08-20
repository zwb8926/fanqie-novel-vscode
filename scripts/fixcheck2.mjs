// Check: how to get a book's OWN comments (SEO).
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, ua = SPIDER) {
  const r = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
  return { status: r.status, text: await r.text() };
}
const OLD_BOOK = '7405108467217746969';

// 1. older book's page comment links
const { text } = await getText(`https://fanqienovel.com/page/${OLD_BOOK}`);
const links = [...text.matchAll(/\/comment\/(\d{10,})-(\d{10,})/g)].map(m => [m[1], m[2]]);
console.log('old book comment links:', links.length);
const own = links.filter(l => l[0] === OLD_BOOK);
console.log('own-book links:', own.length, own.slice(0, 3).join(' '));
const others = links.filter(l => l[0] !== OLD_BOOK).slice(0, 5);
console.log('other-book links sample:', others.map(o => o[0]).join(' '));
// context of links
const idx = text.indexOf('/comment/');
console.log('\ncontext:', text.slice(idx - 400, idx + 200).replace(/\s+/g, ' ').slice(0, 600));

// 2. variants for comment list page
for (const u of [
  `https://fanqienovel.com/comment/${OLD_BOOK}-0`,
  `https://fanqienovel.com/comment/${OLD_BOOK}`,
  `https://fanqienovel.com/book/${OLD_BOOK}/comment`,
  `https://fanqienovel.com/api/comment/get_book_comment_list/${OLD_BOOK}`,
]) {
  try {
    const r = await getText(u);
    console.log(`\n[${u}] -> ${r.status} len=${r.text.length} ${r.text.slice(0, 60).replace(/\n/g, ' ')}`);
  } catch (e) { console.log(`[${u}] ERR ${e.message}`); }
}

// 3. does the 书评 section render on the book page? grep for 评论 section in state
const st = JSON.parse(require('fs').readFileSync(process.env.TEMP + '/fq_book_state.json', 'utf8'));
console.log('\nbook state comment:', JSON.stringify(st.comment || {}).slice(0, 200));
