// Research 10: (A) live-test douyin passport QR endpoints; (B) fetch denniemok api/comments files.
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TEMP = process.env.TEMP;
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(30000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}

// A. QR endpoints
const service = encodeURIComponent('https://fanqienovel.com/api/author/login/url/');
const tests = [
  ['get_qr_code (old)', `https://sso.douyin.com/get_qr_code/?service=${service}&need_validate=0`],
  ['get_qrcode (new)', `https://sso.douyin.com/passport/web/get_qrcode/?service=${service}&need_validate=0&aid=1967&app_name=novelapp`],
  ['get_qrcode (new2)', `https://sso.douyin.com/passport/web/get_qrcode/?service=${service}&need_validate=0&aid=6383&app_name=aweme`],
];
for (const [name, url] of tests) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://fanqienovel.com/' }, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    console.log(`\n==== ${name}\nHTTP ${r.status} len=${text.length}\n${text.slice(0, 900)}`);
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}

// B. denniemok api files
const files = ['src/services/api.js', 'src/utils/constants.js', 'src/utils/commentReplies.js', 'src/utils/chapter-helpers.js', 'src/utils/bookInfo.js', 'src/components/comments/CommentsContent.jsx', 'src/components/comments/CommentThread.jsx'];
for (const f of files) {
  const url = `https://raw.githubusercontent.com/denniemok/fanqie-novel-reader/main/${f}`;
  try {
    const text = await getText(url);
    const safe = 'denn__' + f.replace(/[\\/]/g, '_');
    fs.writeFileSync(TEMP + '/' + safe, text);
    console.log(`\n======== ${f} len=${text.length}`);
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      if (/https?:|api|comment|reply|directory|chapter|item_id|book_id|endpoint|baseUrl|fetch|url:/i.test(l)) {
        console.log(String(i + 1).padStart(5) + '| ' + l.trim().slice(0, 230));
      }
    });
  } catch (e) { console.log(`\nERR ${f}: ${e.message}`); }
}
