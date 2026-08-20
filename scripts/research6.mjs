// Research 6: analyze fanqienovel.com login page JS for the QR login flow.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
function grepPrint(tag, text, patterns, maxLines = 60) {
  const lines = text.split('\n');
  let count = 0;
  lines.forEach((l, i) => {
    if (patterns.some(p => p.test(l))) {
      if (count++ < maxLines) console.log(String(i + 1).padStart(5) + '| ' + l.trim().slice(0, 250));
    }
  });
  console.log(`--- ${tag}: ${count}+ lines`);
}

// 1. login page
const loginHtml = await getText('https://fanqienovel.com/login');
console.log('login page len:', loginHtml.length);
grepPrint('login-html', loginHtml, [/sso|douyin|qr|login|passport|script|_next/i], 40);

// 2. all script chunk URLs
const chunks = [...loginHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
console.log('\nchunks:', JSON.stringify(chunks.slice(0, 40), null, 1));

// 3. fetch chunks, look for qr/sso
const ssoRe = /sso\.douyin|get_qr_code|check_qrconnect|qrconnect|passport|qr_code/i;
for (const c of chunks.slice(0, 40)) {
  const url = c.startsWith('http') ? c : 'https://fanqienovel.com' + c;
  try {
    const js = await getText(url);
    if (ssoRe.test(js)) {
      console.log('\n### chunk HAS sso/qr: ' + url + ' len=' + js.length);
      grepPrint(url.split('/').pop().slice(0, 30), js, [/sso\.douyin[^'"\s]*|get_qr_code|check_qrconnect|qrconnect|service[=:][^,}]{0,120}/gi], 40);
    }
  } catch (e) { /* chunk fetch fail, skip */ }
}
