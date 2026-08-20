// Check gid formula consistency + list unknown PUA chars in chapter.
import zlib from 'node:zlib';
import fs from 'node:fs';

const r = await fetch('https://lf6-awef.bytetos.com/obj/awesome-font/c/dc027189e0ba4cd.woff2', { signal: AbortSignal.timeout(30000) });
const buf = Buffer.from(await r.arrayBuffer());
const numTables = buf.readUInt16BE(12);
const entries = [];
let p = 48;
const readBase128 = () => { let result = 0; for (; ;) { const b = buf[p++]; result = (result << 7) | (b & 0x7f); if ((b & 0x80) === 0) return result; } };
const TAG_INDEX = ['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','EBSC','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gasp','gcid','glyf','gvar','hdmx','hsty','just','kern','lcar','loca','ltag','MATH','maxp','merge','meta','mort','morx','opbd','prop','sbix','seac','sfnt','shm','trak','vhea','vmtx','DSIG','vvar'];
for (let i = 0; i < numTables; i++) {
  const flags = buf[p++];
  const tagIndex = flags & 0x3f;
  let tag;
  if (tagIndex === 63) { tag = buf.toString('ascii', p, p + 4); p += 4; } else tag = TAG_INDEX[tagIndex];
  const origLength = readBase128();
  if (flags & 0x40) readBase128();
  entries.push({ tag, origLength });
}
const sfnt = zlib.brotliDecompressSync(buf.slice(p));
let off = 0;
const cmapIdx = entries.findIndex(e => e.tag === 'cmap');
for (let i = 0; i < cmapIdx; i++) off += entries[i].origLength;
const cmap = sfnt.slice(off, off + entries[cmapIdx].origLength);

// parse format 4
const base = 12;
const segCountX2 = cmap.readUInt16BE(base + 6);
const segCount = segCountX2 / 2;
let p2 = base + 14;
const endCodes = [];
for (let i = 0; i < segCount; i++) { endCodes.push(cmap.readUInt16BE(p2)); p2 += 2; }
p2 += 2;
const startCodes = [];
for (let i = 0; i < segCount; i++) { startCodes.push(cmap.readUInt16BE(p2)); p2 += 2; }
const idDeltas = [];
for (let i = 0; i < segCount; i++) { idDeltas.push(cmap.readUInt16BE(p2)); p2 += 2; }
const idRangeOffsets = [];
for (let i = 0; i < segCount; i++) { idRangeOffsets.push(cmap.readUInt16BE(p2)); p2 += 2; }
const glyphArrayStart = p2;
const charToGid = new Map();
for (let i = 0; i < segCount; i++) {
  for (let c = startCodes[i]; c <= endCodes[i] && c !== 0xffff; c++) {
    let gid;
    if (idRangeOffsets[i] === 0) gid = (c + idDeltas[i]) & 0xffff;
    else {
      const addr = glyphArrayStart + i * 2 + idRangeOffsets[i] + (c - startCodes[i]) * 2;
      gid = cmap.readUInt16BE(addr);
      if (gid !== 0) gid = (gid + idDeltas[i]) & 0xffff;
    }
    charToGid.set(c, gid);
  }
}
// formula check
const GID_START = 58344, UNICODE_START = 0xe3e8;
let mismatch = 0;
for (const [c, g] of charToGid) {
  if (c >= 0xe000 && c <= 0xf8ff) {
    const expect = GID_START + (c - UNICODE_START);
    if (g !== expect) { mismatch++; if (mismatch <= 5) console.log('MISMATCH U+' + c.toString(16) + ' gid=' + g + ' expect=' + expect); }
  }
}
console.log('formula mismatches:', mismatch, 'of', charToGid.size);

// unknown chars in chapter content
const st = JSON.parse(fs.readFileSync(process.env.TEMP + '/fq_chapter_state.json', 'utf8'));
const content = st.reader.chapterData.content;
const fontmap = JSON.parse(fs.readFileSync('src/api/fontmap.json', 'utf8'));
const unknown = new Map();
for (const ch of content) {
  const cp = ch.codePointAt(0);
  if (cp >= 0xe000 && cp <= 0xf8ff) {
    const gid = GID_START + (cp - UNICODE_START);
    if (!fontmap[String(gid)]) {
      if (!unknown.has(cp)) unknown.set(cp, { count: 0, gid });
      unknown.get(cp).count++;
    }
  }
}
console.log('\nunknown PUA chars in chapter:', unknown.size);
for (const [cp, info] of unknown) {
  console.log('  U+' + cp.toString(16) + ' gid=' + info.gid + ' x' + info.count);
}
