// Research 7: homepage JS chunks -> find QR login flow.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, extra = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...extra }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
function grepPrint(tag, text, patterns, maxLines = 80) {
  const lines = text.split('\n');
  let count = 0;
  lines.forEach((l, i) => {
    if (patterns.some(p => p.test(l))) {
      if (count++ < maxLines) console.log(String(i + 1).padStart(5) + '| ' + l.trim().slice(0, 260));
    }
  });
  console.log(`--- ${tag}: ${count}+ lines`);
}
const home = await getText('https://fanqienovel.com/');
console.log('home len:', home.length);
grepPrint('home', home, [/login|sso|qr/i], 20);
const chunks = [...home.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
console.log('chunks:', JSON.stringify(chunks.slice(0, 60), null, 1));
const ssoRe = /sso\.douyin|get_qr_code|check_qrconnect|qrconnect|passport|qr_code|login/i;
let found = 0;
for (const c of chunks.slice(0, 60)) {
  const url = c.startsWith('http') ? c : 'https://fanqienovel.com' + c;
  try {
    const js = await getText(url);
    if (ssoRe.test(js)) {
      found++;
      console.log('\n### chunk: ' + url + ' len=' + js.length);
      grepPrint('chunk', js, [/sso\.douyin|get_qr_code|check_qrconnect|qrconnect|passport[^'"\s]*|service[=:][^,}]{0,140}|login[^'"\s]{0,60}/gi], 25);
      if (found >= 5) break;
    }
  } catch (e) { /* skip */ }
}
