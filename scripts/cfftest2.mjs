// Full pipeline: cmap(PUA->fontgid) + CFF names(fontgid->virtual gid) + static table -> decrypt.
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
const tags = entries.map(e => e.tag);
const getTable = (tag) => {
  const idx = tags.indexOf(tag);
  let off = 0;
  for (let i = 0; i < idx; i++) off += entries[i].origLength;
  return sfnt.slice(off, off + entries[idx].origLength);
};

// cmap
const cmap = getTable('cmap');
const charToFontGid = new Map();
{
  const base = 12;
  const segCountX2 = cmap.readUInt16BE(base + 6);
  const segCount = segCountX2 / 2;
  let q = base + 14;
  const endCodes = [];
  for (let i = 0; i < segCount; i++) { endCodes.push(cmap.readUInt16BE(q)); q += 2; }
  q += 2;
  const startCodes = [];
  for (let i = 0; i < segCount; i++) { startCodes.push(cmap.readUInt16BE(q)); q += 2; }
  const idDeltas = [];
  for (let i = 0; i < segCount; i++) { idDeltas.push(cmap.readUInt16BE(q)); q += 2; }
  const idRangeOffsets = [];
  for (let i = 0; i < segCount; i++) { idRangeOffsets.push(cmap.readUInt16BE(q)); q += 2; }
  const glyphArrayStart = q;
  for (let i = 0; i < segCount; i++) {
    for (let c = startCodes[i]; c <= endCodes[i] && c !== 0xffff; c++) {
      let gid;
      if (idRangeOffsets[i] === 0) gid = (c + idDeltas[i]) & 0xffff;
      else {
        const addr = glyphArrayStart + i * 2 + idRangeOffsets[i] + (c - startCodes[i]) * 2;
        gid = cmap.readUInt16BE(addr);
        if (gid !== 0) gid = (gid + idDeltas[i]) & 0xffff;
      }
      charToFontGid.set(c, gid);
    }
  }
}

// CFF parse
const cff = getTable('CFF ');
function readIndex(data, pos) {
  const count = data.readUInt16BE(pos);
  pos += 2;
  if (count === 0) return { items: [], pos: pos + 1 };
  const offSize = data[pos++];
  const offsets = [];
  for (let i = 0; i <= count; i++) {
    let v = 0;
    for (let b = 0; b < offSize; b++) v = (v << 8) | data[pos++];
    offsets.push(v);
  }
  const dataStart = pos;
  const items = [];
  for (let i = 0; i < count; i++) items.push(data.slice(dataStart + offsets[i] - 1, dataStart + offsets[i + 1] - 1));
  pos = dataStart + offsets[count] - 1;
  return { items, pos };
}
let pos = cff[2];
const nameIdx = readIndex(cff, pos); pos = nameIdx.pos;
const topIdx = readIndex(cff, pos); pos = topIdx.pos;
const stringIdx = readIndex(cff, pos); pos = stringIdx.pos;

// top dict charset
const top = topIdx.items[0];
function parseDict(dict) {
  const out = [];
  let operands = [];
  let i = 0;
  const readOperand = () => {
    const b0 = dict[i];
    if (b0 === 28) { const v = dict.readInt16BE(i + 1); i += 3; return v; }
    if (b0 === 29) { const v = dict.readInt32BE(i + 1); i += 5; return v; }
    if (b0 === 30) {
      let s = ''; i++;
      for (; ;) {
        const b = dict[i++];
        for (const nib of [b >> 4, b & 0x0f]) {
          if (nib === 0x0a) s += '.';
          else if (nib === 0x0b) s += 'E';
          else if (nib === 0x0c) s += 'E-';
          else if (nib === 0x0e) s += '-';
          else if (nib === 0x0f) return parseFloat(s);
          else s += String(nib);
        }
      }
    }
    if (b0 >= 32 && b0 <= 246) { const v = b0 - 139; i += 1; return v; }
    if (b0 >= 247 && b0 <= 250) { const v = (b0 - 247) * 256 + dict[i + 1] + 108; i += 2; return v; }
    if (b0 >= 251 && b0 <= 254) { const v = -(b0 - 251) * 256 - dict[i + 1] - 108; i += 2; return v; }
    if (b0 === 255) { const v = dict.readInt16BE(i + 1) * 65536 + dict.readUInt16BE(i + 3); i += 5; return v; }
    return undefined;
  };
  while (i < dict.length) {
    const b0 = dict[i];
    if (b0 === 12) {
      const op = 1200 + dict[i + 1];
      out.push({ op, operands: operands.slice() });
      operands = [];
      i += 2;
    } else if (b0 <= 21) {
      out.push({ op: b0, operands: operands.slice() });
      operands = [];
      i += 1;
    } else {
      const before = i;
      const v = readOperand();
      if (i === before) break;
      operands.push(v);
    }
  }
  return out;
}
const topDict = parseDict(top);
const charsetOff = topDict.find(x => x.op === 15)?.operands[0];
const cs = cff.slice(charsetOff);
const fmt = cs[0];
const sidForGlyph = [];
if (fmt === 0) {
  let q = 1;
  for (let g = 1; q + 1 < cs.length; g++) { sidForGlyph[g] = cs.readUInt16BE(q); q += 2; }
} else if (fmt === 1) {
  let q = 1, g = 1;
  while (q < cs.length) {
    const firstSID = cs.readUInt16BE(q);
    const nLeft = cs[q + 2];
    q += 3;
    for (let i = 0; i <= nLeft; i++) sidForGlyph[g++] = firstSID + i;
  }
} else if (fmt === 2) {
  let q = 1, g = 1;
  while (q < cs.length) {
    const firstSID = cs.readUInt16BE(q);
    const nLeft = cs.readUInt16BE(q + 2);
    q += 4;
    for (let i = 0; i <= nLeft; i++) sidForGlyph[g++] = firstSID + i;
  }
}
const fontGidToVirtualGid = new Map();
let gidNames = 0;
for (let g = 1; g < sidForGlyph.length; g++) {
  const sid = sidForGlyph[g];
  const idx = sid - 391;
  if (idx >= 0 && idx < stringIdx.items.length) {
    const s = stringIdx.items[idx].toString('latin1');
    const m = s.match(/^gid(\d+)$/);
    if (m) { fontGidToVirtualGid.set(g, Number(m[1])); gidNames++; }
  }
}
console.log('glyphs with gid names:', gidNames, 'of', sidForGlyph.length - 1);

// decrypt chapter with virtual-gid approach
const fontmap = JSON.parse(fs.readFileSync('src/api/fontmap.json', 'utf8'));
const st = JSON.parse(fs.readFileSync(process.env.TEMP + '/fq_chapter_state.json', 'utf8'));
const content = st.reader.chapterData.content;
const GID_START = 58344, UNICODE_START = 0xe3e8;
let unknownCount = 0;
const unknown = new Map();
for (const ch of content) {
  const cp = ch.codePointAt(0);
  if (cp >= 0xe000 && cp <= 0xf8ff) {
    const fontGid = charToFontGid.get(cp);
    let vgid;
    if (fontGid !== undefined && fontGidToVirtualGid.has(fontGid)) vgid = fontGidToVirtualGid.get(fontGid);
    else vgid = GID_START + (cp - UNICODE_START);
    const real = fontmap[String(vgid)];
    if (!real) {
      unknownCount++;
      if (!unknown.has(cp)) unknown.set(cp, { vgid, fontGid });
    }
  }
}
console.log('unknown chars with font-derived gids:', unknownCount);
for (const [cp, info] of unknown) {
  console.log('  U+' + cp.toString(16) + ' fontgid=' + info.fontGid + ' vgid=' + info.vgid);
}
// how many of the formula-based unknowns got RESOLVED by font gids?
const formulaUnknown = new Set([0xe4dd, 0xe4e1, 0xe4fc]);
let resolved = 0;
for (const [cp, info] of unknown) {
  if (formulaUnknown.has(cp) && fontmap[String(info.vgid)]) resolved++;
}
console.log('formula-unknown resolved via font gid:', resolved);
