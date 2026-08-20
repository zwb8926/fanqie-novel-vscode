// Research part 3: fetch fanqie-assistant userscript API files (official site endpoints).
import fs from 'node:fs';
const UA = { 'User-Agent': 'dsh-research' };
const TEMP = process.env.TEMP;
async function getText(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
const base = 'https://raw.githubusercontent.com/naiyQAQ/fanqie-assistant/main/';
const files = [
  'src/api/index.ts', 'src/api/app.ts', 'src/api/book.ts', 'src/api/bookshelf.ts',
  'src/api/catalog.ts', 'src/api/content.ts', 'src/api/device.ts', 'src/api/devicebody.ts',
  'src/api/provision.ts', 'src/api/search.ts', 'src/api/user.ts',
  'src/utils/request.ts', 'src/config.ts', 'src/hooks/fetchHook.ts',
];
for (const f of files) {
  const url = base + f;
  try {
    const text = await getText(url);
    const safe = 'fqa__' + f.replace(/[\\/]/g, '_');
    fs.writeFileSync(`${TEMP}/${safe}`, text);
    console.log(`\n======== ${f} (len=${text.length})`);
    const lines = text.split('\n');
    const MAX = 220;
    const show = lines.length <= MAX ? lines : lines.filter(l => /api|login|qr|device|comment|https?:|baseURL|url:|endpoint/i.test(l));
    console.log(show.map((l, i) => String(lines.indexOf(l) + 1).padStart(4) + '| ' + l.slice(0, 220)).join('\n'));
  } catch (e) { console.log(`\nERR ${f}: ${e.message}`); }
}
// also ying-ck downloader main.py login part + phone.md
const yb = 'https://raw.githubusercontent.com/ying-ck/fanqienovel-downloader/main/';
for (const f of ['src/main.py', 'phone.md']) {
  try {
    const text = await getText(yb + f);
    const safe = 'ying__' + f.replace(/[\\/]/g, '_');
    fs.writeFileSync(`${TEMP}/${safe}`, text);
    console.log(`\n======== ying-ck/${f} (len=${text.length})`);
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      if (/api\/|login|qr|douyin|device|session|web_session|token/i.test(l)) {
        console.log(String(i + 1).padStart(4) + '| ' + l.trim().slice(0, 200));
      }
    });
  } catch (e) { console.log(`ERR ${f}: ${e.message}`); }
}
