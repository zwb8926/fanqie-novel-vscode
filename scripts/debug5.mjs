// Compare CSDN article table with fontmap.json.
import fs from 'node:fs';
const html = fs.readFileSync(process.env.TEMP + '/csdn_font_article.html', 'utf8');
const blocks = html.match(/<code[^>]*>([\s\S]*?)<\/code>/g) || [];
const block = blocks[1]
  .replace(/<[^>]+>/g, '')
  .replaceAll('&#39;', "'")
  .replaceAll('&#34;', '"')
  .replaceAll('&#61;', '=')
  .replaceAll('&gt;', '>')
  .replaceAll('&lt;', '<');
const dm = block.match(/dit_data\s*=\s*(\{[\s\S]*?\})/);
if (!dm) { console.log('no dict'); process.exit(0); }
const table = eval('(' + dm[1] + ')');
const mine = JSON.parse(fs.readFileSync('src/api/fontmap.json', 'utf8'));
console.log('article entries:', Object.keys(table).length, '| mine:', Object.keys(mine).length);
let extra = 0;
for (const k of Object.keys(table)) {
  if (!(k in mine)) { extra++; if (extra <= 50) console.log('extra:', k, '=>', table[k]); }
}
console.log('total extra:', extra);
for (const g of ['58589', '58593', '58620']) {
  console.log('gid', g, 'article:', table[g] || '-', '| mine:', mine[g] || '-');
}
