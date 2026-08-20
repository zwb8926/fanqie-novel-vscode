// Research 5: fetch core files from small repos, grep for login/comment/endpoints.
import fs from 'node:fs';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36' };
const TEMP = process.env.TEMP;
async function getText(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
function grepPrint(name, text, patterns, maxLines = 150) {
  const lines = text.split('\n');
  let count = 0;
  lines.forEach((l, i) => {
    if (patterns.some(p => p.test(l))) {
      if (count++ < maxLines) console.log(String(i + 1).padStart(5) + '| ' + l.trim().slice(0, 230));
    }
  });
  console.log(`--- ${name}: ${count}+ matching lines (len=${text.length})`);
}

const targets = [
  ['kailous/fanqienovel-book', 'main', 'pages/api/book.ts'],
  ['kailous/fanqienovel-book', 'main', 'pages/api/item.ts'],
  ['kailous/fanqienovel-book', 'main', 'tampermonkey/Tool.js'],
  ['luochaolun/fanqienovel', 'main', 'python/fanqie.py'],
  ['luochaolun/fanqienovel', 'main', 'rust/src/fq_api.rs'],
  ['shing-yu/FanQieNovelDownloadOnWeb', 'master', 'tools/Fanqie.py'],
  ['rainyautumn1/FanqieNovelDownloader', 'main', 'downloader.py'],
];
for (const [repo, branch, path] of targets) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  console.log('\n######## ' + repo + '/' + path);
  try {
    const text = await getText(url);
    const safe = (repo.replace('/', '-') + '__' + path.replace(/[\\/]/g, '_'));
    fs.writeFileSync(TEMP + '/' + safe, text);
    grepPrint(safe, text, [/https?:\/\/[^'"\s]*(api|sso|passport|login)[^'"\s]*/i, /get_qr_code|check_qrconnect|qrconnect|sso\.douyin/i, /comment|评论/i, /directory|chapter|item_id|book_id/i]);
  } catch (e) { console.log('ERR ' + e.message); }
}
