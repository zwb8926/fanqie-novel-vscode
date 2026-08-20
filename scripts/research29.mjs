// Research 29: full chapterData structure + SEO comment data on chapter page.
import fs from 'node:fs';
const TEMP = process.env.TEMP;
const SPIDER_UA = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const CH = '7576659313758831128';
async function getText(url, ua = SPIDER_UA) {
  const r = await fetch(url, { headers: { 'User-Agent': ua, 'Accept': 'text/html' }, signal: AbortSignal.timeout(30000) });
  return { status: r.status, text: await r.text() };
}
function extractState(text) {
  const tag = '__INITIAL_STATE__=';
  const start = text.indexOf(tag);
  if (start < 0) return null;
  let i = start + tag.length;
  while (text[i] === ' ' || text[i] === '\n') i++;
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let k = i; k < text.length; k++) {
    const c = text[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  if (end <= 0) return null;
  try { return JSON.parse(text.slice(i, end)); } catch { return null; }
}

const { status, text } = await getText(`https://fanqienovel.com/reader/${CH}`);
console.log(`chapter page HTTP ${status} len=${text.length}`);
const st = extractState(text);
if (st) {
  const cd = st.reader?.chapterData || {};
  console.log('\nchapterData keys:', Object.keys(cd).join(','));
  const { content, ...meta } = cd;
  console.log('\nmeta:', JSON.stringify(meta).slice(0, 1200));
  console.log('\ncontent type:', typeof content, 'len:', String(content || '').length);
  console.log('content sample:', String(content || '').slice(0, 800));
  console.log('\ncomment state:', JSON.stringify(st.comment || {}).slice(0, 300));
  // any comment-like fields in chapterData?
  for (const k of ['comment', 'danmaku', 'paragraph']) {
    if (cd[k] !== undefined) console.log('chapterData.' + k + ':', JSON.stringify(cd[k]).slice(0, 400));
  }
  fs.writeFileSync(TEMP + '/fq_chapter_state.json', JSON.stringify(st));
  // HTML comment sections
  const htmlComments = [...text.matchAll(/comment[^"']{0,80}/gi)].slice(0, 10).map(m => m[0]);
  console.log('\nHTML comment mentions:', JSON.stringify(htmlComments));
  // check rendered comment blocks
  const idx = text.indexOf('评论');
  console.log('\n"评论" in html @', idx, idx >= 0 ? text.slice(idx - 200, idx + 300).replace(/\s+/g, ' ') : '');
} else {
  console.log('no state');
}
