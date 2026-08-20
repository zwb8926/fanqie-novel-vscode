// Research 28: SEO spider pages for chapter content + comment fallback.
import fs from 'node:fs';
const TEMP = process.env.TEMP;
const SPIDER_UA = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
const BOOK = '7576659101376072728';
const CH = '7576659313758831128';
async function getText(url, ua = SPIDER_UA) {
  const r = await fetch(url, { headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(30000) });
  return { status: r.status, text: await r.text() };
}
function extractState(text, tag = '__INITIAL_STATE__=') {
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

// A. book page with spider UA
try {
  const { status, text } = await getText(`https://fanqienovel.com/page/${BOOK}`);
  console.log(`book page spider: HTTP ${status} len=${text.length}`);
  fs.writeFileSync(TEMP + '/fq_book_spider.html', text);
  const st = extractState(text);
  if (st) {
    console.log('seo:', JSON.stringify(st.seo || {}).slice(0, 800));
    console.log('page.chapterListWithVolume[0]:', JSON.stringify((st.page?.chapterListWithVolume || [])[0]).slice(0, 500));
  }
  // find chapter links in HTML
  const links = [...text.matchAll(/href="([^"]*)"[^>]*>([^<]{0,30})/g)].map(m => [m[1], m[2]]).filter(m => /item|reader|chapter|book/.test(m[0]));
  console.log('links sample:', JSON.stringify(links.slice(0, 15)));
} catch (e) { console.log('book spider ERR', e.message); }

// B. chapter SEO page guesses
for (const url of [
  `https://fanqienovel.com/reader/${CH}`,
  `https://fanqienovel.com/s/${CH}`,
  `https://fanqienovel.com/book/${BOOK}/${CH}`,
  `https://fanqienovel.com/item/${CH}`,
  `https://fanqienovel.com/chapter/${CH}`,
]) {
  try {
    const { status, text } = await getText(url);
    console.log(`\n[${url}] HTTP ${status} len=${text.length}`);
    if (status === 200) {
      const st = extractState(text);
      if (st) {
        console.log('  state keys:', Object.keys(st).join(','));
        console.log('  reader:', JSON.stringify(st.reader || {}).slice(0, 400));
        console.log('  preview:', JSON.stringify(st.preview || {}).slice(0, 400));
      }
      const body = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
      const txt = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('  text sample:', txt.slice(0, 300));
    }
  } catch (e) { console.log(`[${url}] ERR`, e.message); }
}
