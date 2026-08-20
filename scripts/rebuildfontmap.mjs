// Rebuild fontmap.json from ying-ck charset.json (listA = 完整 gid 映射).
import fs from 'node:fs';
const UA = { 'User-Agent': 'Mozilla/5.0' };
const t = await (await fetch('https://raw.githubusercontent.com/ying-ck/fanqienovel-downloader/main/src/charset.json', { headers: UA })).text();
const [listA] = JSON.parse(t);
const GID_START = 58344;
const map = {};
listA.forEach((ch, idx) => {
  if (ch && ch !== '?') map[String(GID_START + idx)] = ch;
});
// merge with existing (keep CSDN extras not in listA)
const existing = JSON.parse(fs.readFileSync('src/api/fontmap.json', 'utf8'));
let added = 0;
for (const [k, v] of Object.entries(existing)) {
  if (!(k in map)) { map[k] = v; added++; }
}
fs.writeFileSync('src/api/fontmap.json', JSON.stringify(map, null, 0));
console.log('fontmap.json rebuilt:', Object.keys(map).length, 'entries (merged extras:', added + ')');
console.log('58620 =>', map['58620'], '| 58589 =>', map['58589'], '| 58593 =>', map['58593']);
