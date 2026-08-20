// Parse CFF charset: recover real chars for all glyphs (including unknown gid 58620 = glyph 276).
import zlib from 'node:zlib';

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
const cffIdx = tags.indexOf('CFF ');
let off = 0;
for (let i = 0; i < cffIdx; i++) off += entries[i].origLength;
const cff = sfnt.slice(off, off + entries[cffIdx].origLength);
console.log('CFF len:', cff.length, 'header:', cff[0], cff[1], cff[2], cff[3]);

// --- INDEX reader ---
function readIndex(data, pos, label) {
  const count = data.readUInt16BE(pos);
  pos += 2;
  console.log(`INDEX ${label}: pos=${pos - 2} count=${count}`);
  if (count === 0) return { items: [], pos: pos + 1 };
  const offSize = data[pos++];
  const offsets = [];
  for (let i = 0; i <= count; i++) {
    let v = 0;
    for (let b = 0; b < offSize; b++) v = (v << 8) | data[pos++];
    offsets.push(v);
  }
  const dataStart = pos; // 数据区起点（offsets 为相对此处的 1 基偏移）
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(data.slice(dataStart + offsets[i] - 1, dataStart + offsets[i + 1] - 1));
  }
  pos = dataStart + offsets[count] - 1; // 跳到下一个 INDEX
  return { items, pos };
}

// --- parse CFF ---
const hdrSize = cff[2];
let pos = hdrSize;
const nameIdx = readIndex(cff, pos, 'name');
pos = nameIdx.pos;
const topIdx = readIndex(cff, pos, 'topdict');
pos = topIdx.pos;
const stringIdx = readIndex(cff, pos, 'strings');
pos = stringIdx.pos;
const gsubrIdx = readIndex(cff, pos, 'gsubr');
console.log('name count:', nameIdx.items.length, 'top dicts:', topIdx.items.length, 'strings:', stringIdx.items.length, 'gsubrs:', gsubrIdx.items.length);

// --- parse Top DICT ---
const top = topIdx.items[0];
console.log('top dict bytes:', [...top.slice(0, 42)].map(b => b.toString(16).padStart(2, '0')).join(' '));
function parseDict(dict) {
  const out = [];
  let operands = [];
  let i = 0;
  const readOperand = () => {
    const b0 = dict[i];
    if (b0 === 28) { const v = dict.readInt16BE(i + 1); i += 3; return v; }
    if (b0 === 29) { const v = dict.readInt32BE(i + 1); i += 5; return v; }
    if (b0 === 30) { // real number
      let s = ''; i++;
      for (; ;) {
        const b = dict[i++];
        const hi = b >> 4, lo = b & 0x0f;
        for (const nib of [hi, lo]) {
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
      if (i === before) { console.log('UNHANDLED byte', b0, 'at', before); break; }
      operands.push(v);
    }
  }
  return out;
}
const topDict = parseDict(top);
const get = (op) => {
  const e = topDict.find(x => x.op === op);
  return e ? e.operands[0] : undefined;
};
const charsetOff = get(15);
const charStringsOff = get(17);
console.log('charset offset:', charsetOff, 'charstrings:', charStringsOff);

// --- charset ---
const cs = cff.slice(charsetOff);
const fmt = cs[0];
console.log('charset format:', fmt);
const sidForGlyph = [];
if (fmt === 0) {
  let q = 1;
  for (let g = 1; g < cff.length; g++) {
    if (q + 1 >= cs.length) break;
    sidForGlyph[g] = cs.readUInt16BE(q);
    q += 2;
  }
} else if (fmt === 1 || fmt === 2) {
  let q = 1;
  let g = 1;
  while (q < cs.length) {
    const firstSID = cs.readUInt16BE(q);
    const nLeft = fmt === 1 ? cs[q + 2] : cs.readUInt16BE(q + 2);
    q += fmt === 1 ? 3 : 4;
    for (let i = 0; i <= nLeft; i++) {
      sidForGlyph[g++] = firstSID + i;
    }
    if (g > 5000) break;
  }
}
console.log('glyphs with sid:', sidForGlyph.length, 'last gid:', sidForGlyph.length - 1);

const stdStrings = ['','.notdef','space','exclam','quotedbl','numbersign','dollar','percent','ampersand','quoteright','parenleft','parenright','asterisk','plus','comma','hyphen','period','slash','zero','one','two','three','four','five','six','seven','eight','nine','colon','semicolon','less','equal','greater','question','at','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','bracketleft','backslash','bracketright','asciicircum','underscore','quoteleft','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','braceleft','bar','braceright','asciitilde','exclamdown','cent','sterling','fraction','yen','florin','section','currency','quotesingle','quotedblleft','guillemotleft','guilsinglleft','guilsinglright','fi','fl','endash','dagger','daggerdbl','periodcentered','paragraph','bullet','quotesinglbase','quotedblbase','quotedblright','guillemotright','ellipsis','perthousand','questiondown','grave','acute','circumflex','tilde','macron','breve','dotaccent','dieresis','ring','cedilla','hungarumlaut','ogonek','caron','emdash','AE','ordfeminine','Lslash','Oslash','OE','ordmasculine','ae','dotlessi','lslash','oslash','oe','germandbls','onesuperior','logicalnot','mu','trademark','Eth','onehalf','plusminus','Thorn','onequarter','divide','brokenbar','degree','thorn','threequarters','twosuperior','registered','minus','eth','multiply','threesuperior','copyright','Aacute','Acircumflex','Adieresis','Agrave','Aring','Atilde','Ccedilla','Eacute','Ecircumflex','Edieresis','Egrave','Iacute','Icircumflex','Idieresis','Igrave','Ntilde','Oacute','Ocircumflex','Odieresis','Ograve','Otilde','Scaron','Uacute','Ucircumflex','Udieresis','Ugrave','Yacute','Ydieresis','Zcaron','aacute','acircumflex','adieresis','agrave','aring','atilde','ccedilla','eacute','ecircumflex','edieresis','egrave','iacute','icircumflex','idieresis','igrave','ntilde','oacute','ocircumflex','odieresis','ograve','otilde','scaron','uacute','ucircumflex','udieresis','ugrave','yacute','ydieresis','zcaron','exclamsmall','Hungarumlautsmall','dollaroldstyle','dollarsuperior','ampersandsmall','Acutesmall','parenleftsuperior','parenrightsuperior','twodotenleader','onedotenleader','zerooldstyle','oneoldstyle','twooldstyle','threeoldstyle','fouroldstyle','fiveoldstyle','sixoldstyle','sevenoldstyle','eightoldstyle','nineoldstyle','commasuperior','threequartersemdash','periodsuperior','questionsmall','asuperior','bsuperior','centsuperior','dsuperior','esuperior','isuperior','lsuperior','msuperior','nsuperior','osuperior','rsuperior','ssuperior','tsuperior','ff','ffi','ffl','parenleftinferior','parenrightinferior','Circumflexsmall','hyphensuperior','Gravesmall','Asmall','Bsmall','Csmall','Dsmall','Esmall','Fsmall','Gsmall','Hsmall','Ismall','Jsmall','Ksmall','Lsmall','Msmall','Nsmall','Osmall','Psmall','Qsmall','Rsmall','Ssmall','Tsmall','Usmall','Vsmall','Wsmall','Xsmall','Ysmall','Zsmall','colonmonetary','onefitted','rupiah','Tildesmall','exclamdownsmall','centoldstyle','Lslashsmall','Scaronsmall','Zcaronsmall','Dieresissmall','Brevesmall','Caronsmall','Dotaccentsmall','Macronsmall','figuredash','hypheninferior','Ogoneksmall','Ringsmall','Cedillasmall','questiondownsmall','oneeighth','threeeighths','fiveeighths','seveneighths','onethird','twothirds','zerosuperior','foursuperior','fivesuperior','sixsuperior','sevensuperior','eightsuperior','ninesuperior','zeroinferior','oneinferior','twoinferior','threeinferior','fourinferior','fiveinferior','sixinferior','seveninferior','eightinferior','nineinferior','centinferior','dollarinferior','periodinferior','commainferior','Agravesmall','Aacutesmall','Acircumflexsmall','Atildesmall','Adieresissmall','Aringsmall','AEsmall','Ccedillasmall','Egravesmall','Eacutesmall','Ecircumflexsmall','Edieresissmall','Igravesmall','Iacutesmall','Icircumflexsmall','Idieresissmall','Ethsmall','Ntildesmall','Ogravesmall','Oacutesmall','Ocircumflexsmall','Otildefinal','Odieresissmall','Oslashsmall','Ogravesmall','Ugravesmall','Uacutesmall','Ucircumflexsmall','Udieresissmall','Yacutesmall','Thornsmall','Ydieresissmall','001.000','001.001','001.002','001.003','Black','Bold','Book','Light','Medium','Regular','Roman','Semibold'];
function sidToString(sid) {
  if (sid === 0) return '.notdef';
  if (sid < stdStrings.length) return stdStrings[sid];
  const idx = sid - 391;
  if (idx >= 0 && idx < stringIdx.items.length) {
    return stringIdx.items[idx].toString('latin1');
  }
  return '?sid' + sid;
}

// glyph 276 = virtual gid 58620
for (const g of [276, 274, 280]) {
  const sid = sidForGlyph[g];
  console.log('glyph', g, 'sid', sid, '=>', sidToString(sid));
}
// build full map for our table range: virtual gid 58344..58700 -> glyph index = gid-58344
let found = 0;
for (let g = 1; g < sidForGlyph.length; g++) {
  const s = sidToString(sidForGlyph[g]);
  const m = s.match(/^uni([0-9A-Fa-f]{4})$/);
  if (m) {
    const cp = parseInt(m[1], 16);
    if (cp >= 0x20) {
      found++;
      if (g === 276) console.log('>>> glyph 276 (gid 58620) =', String.fromCodePoint(cp));
    }
  }
}
console.log('total uniXXXX glyphs:', found);
// print first 30
let shown = 0;
for (let g = 1; g < sidForGlyph.length && shown < 30; g++) {
  const s = sidToString(sidForGlyph[g]);
  const m = s.match(/^uni([0-9A-Fa-f]{4})$/);
  if (m) { console.log('glyph', g, '=>', String.fromCodePoint(parseInt(m[1], 16)), '(' + s + ')'); shown++; }
}
