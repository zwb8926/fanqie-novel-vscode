// Debug: directory grouping + dynamic font decryption details.
import { getDirectory, getChapter } from '../out/api/fanqie.js';
import { decryptHtmlPua, decryptTextStatic } from '../out/api/font.js';
import { fetchReaderPageState, extractFontUrls } from '../out/api/ssr.js';

// A. directory
const dir = await getDirectory('7576659101376072728');
console.log('A. volumes:', dir.volumes.length);
dir.volumes.forEach(v => console.log('   vol:', JSON.stringify(v.volume_name).slice(0, 30), 'chapters:', v.chapters.length, 'first:', v.chapters[0] && v.chapters[0].title));

// B. chapter + font
const ch = await getChapter('7576659313758831128');
const joined = ch.paragraphs.join('');
let puaCount = 0;
for (const c of joined) { const cp = c.codePointAt(0); if (cp >= 0xe000 && cp <= 0xf8ff) puaCount++; }
console.log('\nB. paras:', ch.paragraphs.length, 'PUA remaining:', puaCount);
// locate first remaining PUA char context
const idx = joined.search(/[\uE000-\uF8FF]/);
console.log('   first PUA context:', joined.slice(Math.max(0, idx - 20), idx + 10));

// C. dynamic font direct test
const page = await fetchReaderPageState('7576659313758831128');
const fontUrl = page && page._html ? extractFontUrls(page._html)[0] : undefined;
console.log('\nC. fontUrl:', fontUrl);
const html = ch.content;
const dec = await decryptHtmlPua(html, fontUrl);
const decJoined = dec.replace(/<[^>]+>/g, ' ');
let pua2 = 0;
for (const c of decJoined) { const cp = c.codePointAt(0); if (cp >= 0xe000 && cp <= 0xf8ff) pua2++; }
console.log('   dynamic-dec PUA remaining:', pua2);
const idx2 = decJoined.search(/[\uE000-\uF8FF]/);
console.log('   first PUA context:', decJoined.slice(Math.max(0, idx2 - 20), idx2 + 10));

// D. static-only compare
const decS = decryptTextStatic(html.replace(/<[^>]+>/g, ' '));
let pua3 = 0;
for (const c of decS) { const cp = c.codePointAt(0); if (cp >= 0xe000 && cp <= 0xf8ff) pua3++; }
console.log('\nD. static-only PUA remaining:', pua3);
