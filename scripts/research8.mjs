// Research 8: fetch Home JS chunk, grep login flow + also save __INITIAL_STATE__ structure.
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
function grepPrint(tag, text, patterns, maxLines = 100) {
  const lines = text.split('\n');
  let count = 0;
  lines.forEach((l, i) => {
    if (patterns.some(p => p.test(l))) {
      if (count++ < maxLines) console.log(String(i + 1).padStart(6) + '| ' + l.trim().slice(0, 300));
    }
  });
  console.log(`--- ${tag}: ${count}+ lines`);
}

const home = await getText('https://fanqienovel.com/');
// save __INITIAL_STATE__
const m = home.match(/window\.__INITIAL_STATE__=(\{.*?\});?<\/script>/s);
if (m) {
  fs.writeFileSync(process.env.TEMP + '/fq_initial_state.json', m[1]);
  console.log('initial state saved, len:', m[1].length);
  try {
    const st = JSON.parse(m[1]);
    console.log('top keys:', Object.keys(st).join(','));
    for (const k of Object.keys(st)) {
      const v = st[k];
      if (v && typeof v === 'object') console.log('  ' + k + ':', Object.keys(v).slice(0, 15).join(','));
    }
  } catch (e) { console.log('state parse fail', e.message); }
}

const js = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/Home.8cfc78c6.js');
console.log('\nHome.js len:', js.length);
grepPrint('Home.js', js, [/sso\.douyin[^'"\s]*|get_qr_code|check_qrconnect|qrconnect|passport[^'"\s]{0,40}|\/api\/author\/login[^'"\s]*|service=[^'"&\s]{0,100}/gi], 40);

const js2 = await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js');
console.log('\nmuye.js len:', js2.length);
grepPrint('muye.js', js2, [/sso\.douyin[^'"\s]*|get_qr_code|check_qrconnect|qrconnect|passport[^'"\s]{0,40}|\/api\/author\/login[^'"\s]*|service=[^'"&\s]{0,100}/gi], 40);
