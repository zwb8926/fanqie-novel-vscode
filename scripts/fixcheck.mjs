// Fix validation: directory shape, woff2 dynamic font, spider-UA comment links, SSR search.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { request, DEFAULT_UA } from '../out/net/http.js';
import { extractInitialState } from '../out/api/ssr.js';

const BOOK = '7576659101376072728';
const CH = '7576659313758831128';
const SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';

async function getText(url, ua = DEFAULT_UA) {
  const r = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'text/html,application/json' }, signal: AbortSignal.timeout(30000) });
  return { status: r.status, text: await r.text() };
}

// A. directory raw shape
try {
  const { text } = await getText(`https://fanqienovel.com/api/reader/directory/detail?bookId=${BOOK}&enter_from=0`);
  const j = JSON.parse(text);
  const d = j.data;
  console.log('A. directory keys:', Object.keys(d).join(','));
  const v = d.chapterListWithVolume;
  console.log('   volume[0] type:', Array.isArray(v) ? 'array' : typeof v, 'len:', Array.isArray(v) ? v.length : 0);
  if (Array.isArray(v) && v[0]) {
    console.log('   volume[0] keys:', Object.keys(v[0]).join(','));
    console.log('   volume[0]:', JSON.stringify(v[0]).slice(0, 300));
  }
  console.log('   allItemIds len:', (d.allItemIds || []).length);
} catch (e) { console.log('A FAIL', e.message); }

// B. woff2 proper parse
try {
  const fontBuf = Buffer.from(await (await fetch('https://lf6-awef.bytetos.com/obj/awesome-font/c/dc027189e0ba4cd.woff2', { signal: AbortSignal.timeout(30000) })).arrayBuffer());
  const numTables = fontBuf.readUInt16BE(12);
  console.log('\nB. woff2 numTables:', numTables, 'totalSfntSize:', fontBuf.readUInt32BE(16), 'compSize:', fontBuf.readUInt32BE(20));
  // parse directory
  const entries = [];
  let p = 48;
  const readBase128 = () => {
    let result = 0, i = 0;
    for (; ;) {
      const b = fontBuf[p++];
      if (i === 0 && b === 0x80) throw new Error('invalid base128');
      if (result & 0xfe000000) throw new Error('overflow');
      result = (result << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return result;
      i++;
      if (i >= 5) throw new Error('too long');
    }
  };
  const TAG_INDEX = ['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','EBSC','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gasp','gcid','glyf','gvar','hdmx','hsty','just','kern','lcar','loca','ltag','MATH','maxp','merge','meta','mort','morx','opbd','prop','sbix','seac','sfnt','shm','trak','vhea','vmtx','DSIG','vvar'];
  for (let i = 0; i < numTables; i++) {
    const flags = fontBuf[p++];
    const tagIndex = flags & 0x3f;
    let tag;
    if (tagIndex === 63) { tag = fontBuf.toString('ascii', p, p + 4); p += 4; }
    else tag = TAG_INDEX[tagIndex];
    const origLength = readBase128();
    let transformLength = 0;
    if (flags & 0x40) transformLength = readBase128();
    entries.push({ tag, origLength, transformLength });
  }
  console.log('   entries:', entries.map(e => e.tag + ':' + e.origLength + (e.transformLength ? '(t' + e.transformLength + ')' : '')).join(' '));
  const compressed = fontBuf.slice(p);
  const sfnt = zlib.brotliDecompressSync(compressed);
  console.log('   decompressed len:', sfnt.length);
  // find cmap table data in the decompressed stream (concatenated in order)
  const cmapIdx = entries.findIndex(e => e.tag === 'cmap');
  let off = 0;
  const tableOffsets = [];
  for (const e of entries) { tableOffsets.push(off); off += e.origLength; }
  const cmapBuf = sfnt.slice(tableOffsets[cmapIdx], tableOffsets[cmapIdx] + entries[cmapIdx].origLength);
  console.log('   cmap starts with:', cmapBuf.toString('hex', 0, 8));
  const version = cmapBuf.readUInt16BE(0);
  console.log('   cmap version:', version, 'numTables:', cmapBuf.readUInt16BE(2));
} catch (e) { console.log('B FAIL:', e.message); }

// C. spider UA book page comment links
try {
  const { text } = await getText(`https://fanqienovel.com/page/${BOOK}`, SPIDER);
  const links = [...text.matchAll(/\/comment\/(\d{10,})-(\d{10,})/g)].map(m => m[1] + '-' + m[2]);
  console.log('\nC. spider book page comment links:', links.length, links.slice(0, 5).join(' '));
  const normal = await getText(`https://fanqienovel.com/page/${BOOK}`);
  const links2 = [...normal.text.matchAll(/\/comment\/(\d{10,})-(\d{10,})/g)].map(m => m[1] + '-' + m[2]);
  console.log('   normal UA comment links:', links2.length);
} catch (e) { console.log('C FAIL', e.message); }

// D. SSR search page with spider UA
try {
  const { status, text } = await getText(`https://fanqienovel.com/search?query_word=${encodeURIComponent('灵根')}&page_index=0`, SPIDER);
  console.log('\nD. search page:', status, 'len:', text.length);
  const st = extractInitialState(text);
  if (st) {
    console.log('   search state keys:', Object.keys(st.search || {}).join(','));
    const sb = st.search?.searchBookList;
    console.log('   books:', Array.isArray(sb) ? sb.length : 'n/a', JSON.stringify((sb || [])[0] || {}).slice(0, 300));
  } else console.log('   no state (maybe SPA)');
} catch (e) { console.log('D FAIL', e.message); }
