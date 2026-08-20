// Debug woff2 + test static table decryption.
import fs from 'node:fs';
import zlib from 'node:zlib';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
const fontBuf = await getBuf('https://lf6-awef.bytetos.com/obj/awesome-font/c/dc027189e0ba4cd.woff2');
console.log('sig:', fontBuf.toString('ascii', 0, 4), 'flavor:', fontBuf.readUInt32BE(4).toString(16));
console.log('length:', fontBuf.readUInt32BE(8), 'numTables:', fontBuf.readUInt16BE(12));
console.log('totalSfntSize:', fontBuf.readUInt32BE(14), 'totalCompressedSize:', fontBuf.readUInt32BE(18));
const numTables = fontBuf.readUInt16BE(12);
const compSize = fontBuf.readUInt32BE(18);
const compStart = 48 + numTables * 4;
console.log('compStart:', compStart, 'available:', fontBuf.length - compStart);
for (const [name, slice] of [
  ['to end', fontBuf.slice(compStart)],
  ['exact size', fontBuf.slice(compStart, compStart + compSize)],
]) {
  try {
    const d = zlib.brotliDecompressSync(slice);
    console.log(name, 'OK decompressed len:', d.length, 'sig:', d.toString('ascii', 0, 4));
  } catch (e) {
    console.log(name, 'FAIL:', e.code, e.message.slice(0, 80));
  }
}

// static table test
const src = fs.readFileSync(process.env.TEMP + '/fysh_build_fontDecrypt.js', 'utf8');
const m = src.match(/const GID_TO_CHAR = (\{[\s\S]*?\});/);
const GID_TO_CHAR = eval('(' + m[1] + ')');
console.log('\nstatic table entries:', Object.keys(GID_TO_CHAR).length, 'sample:', JSON.stringify(Object.entries(GID_TO_CHAR).slice(0, 5)));
const UNICODE_START = 0xe3e8, GID_START = 58344;
const state = JSON.parse(fs.readFileSync(process.env.TEMP + '/fq_chapter_state.json', 'utf8'));
const content = state.reader.chapterData.content;
function staticDecrypt(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xe000 && cp <= 0xf8ff) {
      const gid = GID_START + (cp - UNICODE_START);
      out += GID_TO_CHAR[gid] ?? ch;
    } else out += ch;
  }
  return out;
}
const dec = staticDecrypt(content.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
console.log('\nstatic-decrypted sample:\n', dec.slice(0, 260));
