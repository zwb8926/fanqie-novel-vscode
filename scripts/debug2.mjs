// Debug: font cmap contents — does it map real chars or only PUA?
import zlib from 'node:zlib';

const r = await fetch('https://lf6-awef.bytetos.com/obj/awesome-font/c/dc027189e0ba4cd.woff2', { signal: AbortSignal.timeout(30000) });
const buf = Buffer.from(await r.arrayBuffer());
const numTables = buf.readUInt16BE(12);
const entries = [];
let p = 48;
const readBase128 = () => {
  let result = 0;
  for (let i = 0; ; i++) {
    const b = buf[p++];
    result = (result << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) return result;
  }
};
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
console.log('cmap len:', cmap.length, 'version:', cmap.readUInt16BE(0), 'numTables:', cmap.readUInt16BE(2));

// parse all subtables
let q = 4;
const subs = [];
for (let i = 0; i < cmap.readUInt16BE(2); i++) {
  subs.push({ p: cmap.readUInt16BE(q), e: cmap.readUInt16BE(q + 2), off: cmap.readUInt32BE(q + 4) });
  q += 8;
}
console.log('subtables:', JSON.stringify(subs));
for (const s of subs) {
  const fmt = cmap.readUInt16BE(s.off);
  console.log(`subtable (${s.p},${s.e}) fmt=${fmt}`);
  if (fmt === 4) {
    const segCountX2 = cmap.readUInt16BE(s.off + 6);
    const segCount = segCountX2 / 2;
    let p2 = s.off + 14;
    const endCodes = [];
    for (let i = 0; i < segCount; i++) { endCodes.push(cmap.readUInt16BE(p2)); p2 += 2; }
    p2 += 2;
    const startCodes = [];
    for (let i = 0; i < segCount; i++) { startCodes.push(cmap.readUInt16BE(p2)); p2 += 2; }
    console.log('  segments:', segCount, 'first segs:', startCodes.slice(0, 8).map((v, i) => v.toString(16) + '-' + endCodes[i].toString(16)).join(' '));
    // count pua vs real
    let pua = 0, real = 0, total = 0;
    const puaSample = [];
    for (let i = 0; i < segCount; i++) {
      for (let c = startCodes[i]; c <= endCodes[i] && c !== 0xffff; c++) {
        total++;
        if (c >= 0xe000 && c <= 0xf8ff) { pua++; if (puaSample.length < 5) puaSample.push(c.toString(16)); }
        else real++;
      }
    }
    console.log('  total:', total, 'PUA:', pua, 'real:', real, 'puaSample:', puaSample.join(' '));
  }
}
