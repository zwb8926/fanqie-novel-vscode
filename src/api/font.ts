/**
 * PUA 字体加密解密。
 *
 * 番茄官网对爬虫渲染的章节正文做「字体反爬」：正文里的部分汉字被替换为
 * Unicode 私有区字符（U+E000–U+F8FF），页面通过自定义字体把私有区字符渲染成
 * 正常汉字。
 *
 * 解密分三层：
 *   1. 动态层：下载页面 @font-face 引用的字体文件，用 cmap 表得到
 *      「PUA 字符 -> 字体字形」，再用 CFF 字符集里形如 "gidXXXXX" 的字形名
 *      还原出该字符的「虚拟 gid」（字符在字体字符集中的序号 + 58344）。
 *   2. 静态表：fontmap.json 给出「虚拟 gid -> 真实字符」的映射
 *      （来源于开源项目对字体字符集顺序的分析，覆盖 362 个常用字符）。
 *   3. 线性公式兜底：虚拟 gid = 58344 + (cp - 0xE3E8)。
 *
 * 实测：动态层+静态表可完整解密章节正文。
 */
import zlib from 'node:zlib';
import { request } from '../net/http';
import fontMap from './fontmap.json';

const UNICODE_START = 0xe3e8;
const GID_START = 58344;
const PUA_RE = /[\uE000-\uF8FF]/;

/** 字体解析缓存：url -> PUA 字符 -> 虚拟 gid | null */
const fontCache = new Map<string, Map<number, number> | null>();

/* ------------------------- 静态表（兜底） ------------------------- */

function staticDecryptChar(cp: number): string | null {
  if (cp < 0xe000 || cp > 0xf8ff) return null;
  const gid = GID_START + (cp - UNICODE_START);
  return (fontMap as Record<string, string>)[String(gid)] ?? null;
}

/* ------------------------- WOFF2 / TTF 解析 ------------------------- */

const TAG_INDEX = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
  'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'EBSC', 'CBDT', 'CBLC',
  'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar',
  'fdsc', 'feat', 'fmtx', 'fvar', 'gasp', 'gcid', 'glyf', 'gvar', 'hdmx', 'hsty',
  'just', 'kern', 'lcar', 'loca', 'ltag', 'MATH', 'maxp', 'merge', 'meta', 'mort',
  'morx', 'opbd', 'prop', 'sbix', 'seac', 'sfnt', 'shm', 'trak', 'vhea', 'vmtx',
  'DSIG', 'vvar', '',
];

interface FontTables {
  cmap?: Buffer;
  cff?: Buffer;
}

function readBase128(buf: Buffer, pos: { p: number }): number {
  let result = 0;
  for (let i = 0; ; i++) {
    if (pos.p >= buf.length) throw new Error('woff2 truncated');
    const b = buf[pos.p++];
    if (i === 0 && b === 0x80) throw new Error('invalid base128');
    if ((result & 0xfe000000) !== 0) throw new Error('base128 overflow');
    result = (result << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) return result;
    if (i >= 4) throw new Error('base128 too long');
  }
}

function parseWoff2(buf: Buffer): FontTables {
  const numTables = buf.readUInt16BE(12);
  const entries: Array<{ tag: string; origLength: number }> = [];
  const pos = { p: 48 };
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos.p++];
    const tagIndex = flags & 0x3f;
    let tag: string;
    if (tagIndex === 63) {
      tag = buf.toString('ascii', pos.p, pos.p + 4);
      pos.p += 4;
    } else {
      tag = TAG_INDEX[tagIndex] ?? '';
    }
    const origLength = readBase128(buf, pos);
    if (flags & 0x40) readBase128(buf, pos);
    entries.push({ tag, origLength });
  }
  const sfnt = zlib.brotliDecompressSync(buf.slice(pos.p));
  let off = 0;
  const out: FontTables = {};
  for (const e of entries) {
    const data = sfnt.slice(off, off + e.origLength);
    if (e.tag === 'cmap') out.cmap = data;
    if (e.tag === 'CFF ') out.cff = data;
    off += e.origLength;
  }
  return out;
}

function parseWoff1(buf: Buffer): FontTables {
  const numTables = buf.readUInt16BE(12);
  let p = 44;
  const out: FontTables = {};
  for (let i = 0; i < numTables; i++) {
    const tag = buf.toString('ascii', p, p + 4);
    const tOffset = buf.readUInt32BE(p + 4);
    const compLen = buf.readUInt32BE(p + 8);
    const origLen = buf.readUInt32BE(p + 12);
    const raw = buf.slice(tOffset, tOffset + compLen);
    const data = compLen < origLen ? zlib.inflateSync(raw) : raw;
    if (tag === 'cmap') out.cmap = data;
    if (tag === 'CFF ') out.cff = data;
    p += 20;
  }
  return out;
}

function parseTtf(buf: Buffer): FontTables {
  const numTables = buf.readUInt16BE(4);
  let p = 12;
  const out: FontTables = {};
  for (let i = 0; i < numTables; i++) {
    const tag = buf.toString('ascii', p, p + 4);
    const tOffset = buf.readUInt32BE(p + 8);
    const tLen = buf.readUInt32BE(p + 12);
    const data = buf.slice(tOffset, tOffset + tLen);
    if (tag === 'cmap') out.cmap = data;
    if (tag === 'CFF ') out.cff = data;
    p += 16;
  }
  return out;
}

/** 解析 cmap（format 4 / 12），返回 char -> 字体字形 id */
function parseCmap(cmap: Buffer): Map<number, number> {
  const map = new Map<number, number>();
  const numTables = cmap.readUInt16BE(2);
  const records: Array<{ platform: number; encoding: number; offset: number }> = [];
  let p = 4;
  for (let i = 0; i < numTables; i++) {
    records.push({ platform: cmap.readUInt16BE(p), encoding: cmap.readUInt16BE(p + 2), offset: cmap.readUInt32BE(p + 4) });
    p += 8;
  }
  records.sort((a, b) => {
    const pri = (r: { platform: number; encoding: number }) => (r.platform === 3 ? 0 : r.platform === 0 ? 1 : 2);
    return pri(a) - pri(b);
  });
  for (const rec of records) {
    const base = rec.offset;
    if (base + 2 > cmap.length) continue;
    const format = cmap.readUInt16BE(base);
    if (format === 4) {
      const segCountX2 = cmap.readUInt16BE(base + 6);
      const segCount = segCountX2 / 2;
      let q = base + 14;
      const endCodes: number[] = [];
      for (let i = 0; i < segCount; i++) { endCodes.push(cmap.readUInt16BE(q)); q += 2; }
      q += 2;
      const startCodes: number[] = [];
      for (let i = 0; i < segCount; i++) { startCodes.push(cmap.readUInt16BE(q)); q += 2; }
      const idDeltas: number[] = [];
      for (let i = 0; i < segCount; i++) { idDeltas.push(cmap.readUInt16BE(q)); q += 2; }
      const idRangeOffsets: number[] = [];
      for (let i = 0; i < segCount; i++) { idRangeOffsets.push(cmap.readUInt16BE(q)); q += 2; }
      const glyphArrayStart = q;
      for (let i = 0; i < segCount; i++) {
        for (let c = startCodes[i]; c <= endCodes[i] && c !== 0xffff; c++) {
          let gid: number;
          if (idRangeOffsets[i] === 0) {
            gid = (c + idDeltas[i]) & 0xffff;
          } else {
            const addr = glyphArrayStart + i * 2 + idRangeOffsets[i] + (c - startCodes[i]) * 2;
            if (addr + 2 > cmap.length) continue;
            gid = cmap.readUInt16BE(addr);
            if (gid !== 0) gid = (gid + idDeltas[i]) & 0xffff;
          }
          if (gid !== 0 && !map.has(c)) map.set(c, gid);
        }
      }
      if (map.size) return map;
    } else if (format === 12) {
      const nGroups = cmap.readUInt32BE(base + 12);
      let q = base + 16;
      for (let i = 0; i < nGroups; i++) {
        const startC = cmap.readUInt32BE(q);
        const endC = cmap.readUInt32BE(q + 4);
        const startGid = cmap.readUInt32BE(q + 8);
        q += 12;
        for (let c = startC; c <= endC; c++) {
          if (!map.has(c)) map.set(c, startGid + (c - startC));
        }
      }
      if (map.size) return map;
    }
  }
  return map;
}

/** CFF INDEX 读取 */
function readCffIndex(data: Buffer, pos: { p: number }): Buffer[] {
  const count = data.readUInt16BE(pos.p);
  pos.p += 2;
  if (count === 0) {
    pos.p += 1;
    return [];
  }
  const offSize = data[pos.p++];
  const offsets: number[] = [];
  for (let i = 0; i <= count; i++) {
    let v = 0;
    for (let b = 0; b < offSize; b++) v = (v << 8) | data[pos.p++];
    offsets.push(v);
  }
  const dataStart = pos.p;
  const items: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    items.push(data.slice(dataStart + offsets[i] - 1, dataStart + offsets[i + 1] - 1));
  }
  pos.p = dataStart + offsets[count] - 1;
  return items;
}

/** 解析 CFF 字符集：返回 字形 id -> SID */
function parseCffCharset(cff: Buffer, charsetOff: number, numGlyphs: number): number[] {
  const cs = cff.slice(charsetOff);
  const fmt = cs[0];
  const sidForGlyph: number[] = new Array(numGlyphs + 1).fill(0);
  if (fmt === 0) {
    let q = 1;
    for (let g = 1; g <= numGlyphs && q + 1 < cs.length; g++) {
      sidForGlyph[g] = cs.readUInt16BE(q);
      q += 2;
    }
  } else if (fmt === 1) {
    let q = 1;
    let g = 1;
    while (q < cs.length && g <= numGlyphs) {
      const firstSID = cs.readUInt16BE(q);
      const nLeft = cs[q + 2];
      q += 3;
      for (let i = 0; i <= nLeft && g <= numGlyphs; i++) sidForGlyph[g++] = firstSID + i;
    }
  } else if (fmt === 2) {
    let q = 1;
    let g = 1;
    while (q < cs.length && g <= numGlyphs) {
      const firstSID = cs.readUInt16BE(q);
      const nLeft = cs.readUInt16BE(q + 2);
      q += 4;
      for (let i = 0; i <= nLeft && g <= numGlyphs; i++) sidForGlyph[g++] = firstSID + i;
    }
  }
  return sidForGlyph;
}

/** 解析 CFF Top DICT，返回操作符表 */
function parseCffDict(dict: Buffer): Array<{ op: number; operands: number[] }> {
  const out: Array<{ op: number; operands: number[] }> = [];
  let operands: number[] = [];
  let i = 0;
  const readOperand = (): number | undefined => {
    const b0 = dict[i];
    if (b0 === 28) { const v = dict.readInt16BE(i + 1); i += 3; return v; }
    if (b0 === 29) { const v = dict.readInt32BE(i + 1); i += 5; return v; }
    if (b0 === 30) {
      let s = '';
      i++;
      for (; ;) {
        if (i >= dict.length) return undefined;
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
      operands.push(v ?? 0);
    }
  }
  return out;
}

/**
 * 下载并解析字体，返回「PUA 字符 -> 虚拟 gid」映射。
 * 虚拟 gid = 字形在字体字符集中的序号（gidXXXXX 名称）对应的字符表序号。
 */
async function loadFontVgidMap(fontUrl: string): Promise<Map<number, number> | null> {
  if (fontCache.has(fontUrl)) return fontCache.get(fontUrl) ?? null;
  try {
    const buf = await fetchFontBytes(fontUrl);
    let tables: FontTables;
    const magic = buf.toString('ascii', 0, 4);
    if (magic === 'wOF2') tables = parseWoff2(buf);
    else if (magic === 'wOFF') tables = parseWoff1(buf);
    else tables = parseTtf(buf);
    if (!tables.cmap) throw new Error('no cmap');
    const charToFontGid = parseCmap(tables.cmap);
    if (!charToFontGid.size) throw new Error('empty cmap');

    // CFF 字符集：字形 id -> SID -> 字符串（"gidXXXXX" -> 虚拟 gid）
    const fontGidToVgid = new Map<number, number>();
    if (tables.cff) {
      try {
        const cff = tables.cff;
        const pos = { p: cff[2] };
        readCffIndex(cff, pos); // Name INDEX
        const topIdx = readCffIndex(cff, pos);
        const stringIdx = readCffIndex(cff, pos);
        const topDict = parseCffDict(topIdx[0] ?? Buffer.alloc(0));
        const charsetOff = topDict.find(x => x.op === 15)?.operands[0];
        const charStringsOff = topDict.find(x => x.op === 17)?.operands[0];
        if (charsetOff !== undefined && charStringsOff !== undefined) {
          // 字形数量：CharStrings INDEX 的 count
          const csPos = { p: charStringsOff };
          const numGlyphs = cff.readUInt16BE(csPos.p);
          const sidForGlyph = parseCffCharset(cff, charsetOff, numGlyphs);
          for (let g = 1; g < sidForGlyph.length; g++) {
            const sid = sidForGlyph[g];
            const idx = sid - 391;
            if (idx >= 0 && idx < stringIdx.length) {
              const name = stringIdx[idx].toString('latin1');
              const m = name.match(/^gid(\d+)$/);
              if (m) fontGidToVgid.set(g, Number(m[1]));
            }
          }
        }
      } catch {
        /* CFF 解析失败则退回线性公式 */
      }
    }

    const result = new Map<number, number>();
    for (const [cp, fontGid] of charToFontGid) {
      if (cp >= 0xe000 && cp <= 0xf8ff) {
        const vgid = fontGidToVgid.get(fontGid) ?? GID_START + (cp - UNICODE_START);
        result.set(cp, vgid);
      }
    }
    if (!result.size) throw new Error('no pua mappings');
    fontCache.set(fontUrl, result);
    return result;
  } catch {
    fontCache.set(fontUrl, null);
    return null;
  }
}

async function fetchFontBytes(url: string): Promise<Buffer> {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
      Referer: 'https://fanqienovel.com/',
      Accept: 'font/woff2,font/woff,*/*',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

/* ------------------------- 对外接口 ------------------------- */

function vgidOf(cp: number, vgidMap: Map<number, number> | null): number {
  if (vgidMap) {
    const v = vgidMap.get(cp);
    if (v !== undefined) return v;
  }
  return GID_START + (cp - UNICODE_START);
}

/** 解密文本（动态字体优先，静态表兜底） */
export async function decryptText(encryptedText: string, fontUrl?: string): Promise<string> {
  if (!encryptedText || !PUA_RE.test(encryptedText)) return encryptedText;
  const vgidMap = fontUrl ? await loadFontVgidMap(fontUrl) : null;
  return decryptWith(encryptedText, vgidMap);
}

/** 解密 HTML（跳过标签），fontUrl 可选 */
export async function decryptHtmlPua(html: string, fontUrl?: string): Promise<string> {
  if (!html || !PUA_RE.test(html)) return html;
  const vgidMap = fontUrl ? await loadFontVgidMap(fontUrl) : null;
  return html.replace(/(<[^>]*>)|([\uE000-\uF8FF])/g, (match, tag: string | undefined, pua: string | undefined) => {
    if (tag !== undefined) return tag;
    if (pua !== undefined) {
      const cp = pua.codePointAt(0)!;
      const vgid = vgidOf(cp, vgidMap);
      return (fontMap as Record<string, string>)[String(vgid)] ?? pua;
    }
    return match;
  });
}

/** 同步静态表解密（无网络场景兜底） */
export function decryptTextStatic(encryptedText: string): string {
  if (!encryptedText || !PUA_RE.test(encryptedText)) return encryptedText;
  return decryptWith(encryptedText, null);
}

function decryptWith(text: string, vgidMap: Map<number, number> | null): string {
  let result = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xe000 && cp <= 0xf8ff) {
      const vgid = vgidOf(cp, vgidMap);
      result += (fontMap as Record<string, string>)[String(vgid)] ?? ch;
    } else {
      result += ch;
    }
  }
  return result;
}
