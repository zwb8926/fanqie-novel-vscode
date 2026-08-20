// Debug: what does /comment/{bookId}-0 page contain?
const UA = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const r = await fetch('https://fanqienovel.com/comment/7405108467217746969-0', {
  headers: { 'User-Agent': UA, Accept: 'text/html' },
  signal: AbortSignal.timeout(30000),
});
const text = await r.text();
const idx = text.lastIndexOf('__INITIAL_STATE__=');
console.log('status:', r.status, 'len:', text.length, 'state idx:', idx);
if (idx >= 0) {
  console.log('context:', text.slice(idx, idx + 200).replace(/\s+/g, ' '));
}
// find title & body text
const title = (text.match(/<title>([^<]*)<\/title>/) || [])[1];
console.log('title:', title);
const body = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('body text:', body.slice(0, 400));
// comment links?
const links = [...text.matchAll(/\/comment\/(\d{10,})-(\d{10,})/g)].map(m => m[0]);
console.log('comment links:', links.length, links.slice(0, 5).join(' '));
