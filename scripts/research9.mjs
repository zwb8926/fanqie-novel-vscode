// Research 9: (A) denniemok/fanqie-novel-reader api files (has comments); (B) substring grep of muye.js for QR login.
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const TEMP = process.env.TEMP;
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(40000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}

// A. denniemok repo files
console.log('######## denniemok tree');
try {
  const meta = await getJson('https://api.github.com/repos/denniemok/fanqie-novel-reader');
  const tree = await getJson(`https://api.github.com/repos/denniemok/fanqie-novel-reader/git/trees/${meta.default_branch}?recursive=1`);
  const files = tree.tree.filter(t => t.type === 'blob').map(t => t.path);
  const interesting = files.filter(f => /api|lib|util|fanqie|request/i.test(f) && !/node_modules/.test(f));
  console.log('interesting files:');
  console.log(interesting.join('\n'));
  fs.writeFileSync(TEMP + '/denniemok-files.txt', files.join('\n'));
} catch (e) { console.log('ERR', e.message); }

// B. fetch the likely api files
const candidates = [
  'src/api/fanqie.js', 'src/api/index.js', 'src/lib/fanqie.js', 'src/lib/api.js',
  'src/lib/request.js', 'src/api.js', 'src/lib.js', 'src/utils/api.js',
];
for (const c of candidates) {
  const url = `https://raw.githubusercontent.com/denniemok/fanqie-novel-reader/main/${c}`;
  try {
    const text = await getText(url);
    console.log(`\n######## denniemok/${c} len=${text.length}`);
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      if (/https?:|api|comment|directory|chapter|item_id|book_id|endpoint/i.test(l)) {
        console.log(String(i + 1).padStart(5) + '| ' + l.trim().slice(0, 240));
      }
    });
  } catch (e) { /* not found */ }
}

// C. substring grep muye.js for QR login
try {
  const js = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js');
  console.log('\n######## muye.js substring search');
  for (const key of ['sso.douyin', 'get_qr_code', 'check_qrconnect', 'qrconnect', 'passport.ixigua', 'passport', 'login/url', 'author/login']) {
    let idx = js.indexOf(key);
    let n = 0;
    while (idx >= 0 && n < 5) {
      console.log(`\n-- "${key}" at ${idx}:`);
      console.log(js.slice(Math.max(0, idx - 250), idx + 350).replace(/\n/g, ' '));
      idx = js.indexOf(key, idx + 1);
      n++;
    }
    if (n === 0) console.log(`-- "${key}": not found`);
  }
} catch (e) { console.log('ERR muye', e.message); }

// D. extract __INITIAL_STATE__ properly
try {
  const home = await getText('https://fanqienovel.com/');
  const idx = home.indexOf('__INITIAL_STATE__');
  console.log('\n######## __INITIAL_STATE__ at', idx);
  console.log(home.slice(idx, idx + 400));
} catch (e) { console.log('ERR home', e.message); }
