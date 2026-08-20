// Contexts of unknown PUA char U+E4FC (gid 58620).
import fs from 'node:fs';
const st = JSON.parse(fs.readFileSync(process.env.TEMP + '/fq_chapter_state.json', 'utf8'));
const content = st.reader.chapterData.content.replace(/<[^>]+>/g, ' ');
const target = String.fromCodePoint(0xe4fc);
const seen = new Set();
let idx = 0;
let n = 0;
while ((idx = content.indexOf(target, idx)) >= 0 && n < 20) {
  const ctx = content.slice(Math.max(0, idx - 12), idx + 12).replace(/\n/g, ' ');
  if (!seen.has(ctx)) {
    seen.add(ctx);
    console.log('»' + ctx.replace(target, '□') + '«');
    n++;
  }
  idx += 1;
}
console.log('total occurrences:', (content.match(new RegExp(target, 'g')) || []).length);
