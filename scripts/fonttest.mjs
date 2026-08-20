// Validate font decryption: fetch chapter page font, parse cmap, decrypt content.
import fs from 'node:fs';
import zlib from 'node:zlib';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CH = '7576659313758831128';

async function getBuf(url, ua = UA) {
  const r = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// 1. chapter page html
const html = (await getBuf(`https://fanqienovel.com/reader/${CH}`, UA + '; Baiduspider')).toString('utf8');
const fontUrls = [...html.matchAll(/@font-face\s*\{[^}]*?src:\s*url\(([^)]+)\)/gi)].map(m => m[1].replace(/['"]/g, ''));
console.log('font urls:', fontUrls);

// 2. parse font
const fontBuf = await getBuf(fontUrls[0].startsWith('http') ? fontUrls[0] : 'https://fanqienovel.com' + fontUrls[0]);
console.log('font magic:', fontBuf.slice(0, 4).toString('ascii'), 'len:', fontBuf.length);

function parseFont(buf) {
  let data = buf;
  if (buf.toString('ascii', 0, 4) === 'wOF2') {
    const numTables = buf.readUInt16BE(12);
    const compStart = 48 + numTables * 4;
    data = zlib.brotliDecompressSync(buf.slice(compStart));
  } else if (buf.toString('ascii', 0, 4) === 'wOFF') {
    // WOFF1: header 44 bytes, then directory
    const numTables = buf.readUInt16BE(12);
    const tables = {};
    let off = 44;
    for (let i = 0; i < numTables; i++) {
      const tag = buf.toString('ascii', off, off + 4);
      const tOffset = buf.readUInt32BE(off + 4);
      const compLen = buf.readUInt32BE(off + 8);
      const origLen = buf.readUInt32BE(off + 12);
      const raw = buf.slice(tOffset, tOffset + compLen);
      tables[tag] = compLen < origLen ? zlib.inflateSync(raw) : raw;
      off += 20;
    }
    return { tables, isWoff1: true };
  }
  // raw TTF: parse table directory
  const numTables = data.readUInt16BE(4);
  const tables = {};
  let off = 12;
  for (let i = 0; i < numTables; i++) {
    const tag = data.toString('ascii', off, off + 4);
    const tOffset = data.readUInt32BE(off + 8);
    const tLen = data.readUInt32BE(off + 12);
    tables[tag] = data.slice(tOffset, tOffset + tLen);
    off += 16;
  }
  return { tables, isWoff1: false };
}

function parseCmap(cmapBuf) {
  const version = cmapBuf.readUInt16BE(0);
  const numTables = cmapBuf.readUInt16BE(2);
  const subtables = [];
  let off = 4;
  for (let i = 0; i < numTables; i++) {
    subtables.push({ platform: cmapBuf.readUInt16BE(off), encoding: cmapBuf.readUInt16BE(off + 2), offset: cmapBuf.readUInt32BE(off + 4) });
    off += 8;
  }
  const map = new Map();
  for (const st of subtables) {
    const base = st.offset;
    const format = cmapBuf.readUInt16BE(base);
    if (format === 4) {
      const segCountX2 = cmapBuf.readUInt16BE(base + 6);
      const segCount = segCountX2 / 2;
      let p = base + 14;
      const endCodes = [];
      for (let i = 0; i < segCount; i++) { endCodes.push(cmapBuf.readUInt16BE(p)); p += 2; }
      p += 2; // reservedPad
      const startCodes = [];
      for (let i = 0; i < segCount; i++) { startCodes.push(cmapBuf.readUInt16BE(p)); p += 2; }
      const idDeltas = [];
      for (let i = 0; i < segCount; i++) { idDeltas.push(cmapBuf.readUInt16BE(p)); p += 2; }
      const idRangeOffsets = [];
      for (let i = 0; i < segCount; i++) { idRangeOffsets.push(cmapBuf.readUInt16BE(p)); p += 2; }
      const glyphArrayStart = p;
      for (let i = 0; i < segCount; i++) {
        const startC = startCodes[i], endC = endCodes[i];
        for (let c = startC; c <= endC; c++) {
          if (c === 0xffff) continue;
          let gid;
          if (idRangeOffsets[i] === 0) {
            gid = (c + idDeltas[i]) & 0xffff;
          } else {
            const addr = glyphArrayStart + i * 2 + idRangeOffsets[i] + (c - startC) * 2;
            if (addr + 2 > cmapBuf.length) continue;
            gid = cmapBuf.readUInt16BE(addr);
            if (gid !== 0) gid = (gid + idDeltas[i]) & 0xffff;
          }
          if (gid !== 0 && !map.has(c)) map.set(c, gid);
        }
      }
    } else if (format === 12) {
      const nGroups = cmapBuf.readUInt32BE(base + 12);
      let p = base + 16;
      for (let i = 0; i < nGroups; i++) {
        const startC = cmapBuf.readUInt32BE(p);
        const endC = cmapBuf.readUInt32BE(p + 4);
        const startGid = cmapBuf.readUInt32BE(p + 8);
        p += 12;
        for (let c = startC; c <= endC; c++) {
          if (!map.has(c)) map.set(c, startGid + (c - startC));
        }
      }
    }
  }
  return map;
}

const { tables } = parseFont(fontBuf);
console.log('tables:', Object.keys(tables).join(','));
if (!tables.cmap) { console.log('NO cmap!'); process.exit(1); }
const charToGid = parseCmap(tables.cmap);
console.log('cmap entries:', charToGid.size);
let puaCount = 0, puaWithGid = 0;
const gidToChar = new Map();
for (const [c, g] of charToGid) {
  if (!gidToChar.has(g) && !(c >= 0xe000 && c <= 0xf8ff)) gidToChar.set(g, c);
  if (c >= 0xe000 && c <= 0xf8ff) { puaCount++; if (g) puaWithGid++; }
}
console.log('pua entries:', puaCount, 'with gid:', puaWithGid, '| reverse map size:', gidToChar.size);
// check some pua mappings resolve to real chars
let resolvable = 0, sample = [];
for (const [c, g] of charToGid) {
  if (c >= 0xe000 && c <= 0xf8ff && gidToChar.has(g)) {
    resolvable++;
    if (sample.length < 6) sample.push(`U+${c.toString(16)}->${String.fromCodePoint(gidToChar.get(g))}`);
  }
}
console.log('resolvable pua:', resolvable, 'sample:', sample.join(' '));

// 3. decrypt the content
const state = JSON.parse(fs.readFileSync(process.env.TEMP + '/fq_chapter_state.json', 'utf8'));
const content = state.reader.chapterData.content;
function decrypt(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xe000 && cp <= 0xf8ff) {
      const gid = charToGid.get(cp);
      const real = gid != null && gidToChar.has(gid) ? String.fromCodePoint(gidToChar.get(gid)) : ch;
      out += real;
    } else out += ch;
  }
  return out;
}
const dec = decrypt(content.replace(/<[^>]+>/g, ' '));
console.log('\ndecrypted sample:', dec.slice(0, 220));
