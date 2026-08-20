// Fetch the scan-code.html page and extract its JS/API params.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Accept: 'text/html' };
const svcE = encodeURIComponent('https://fanqienovel.com/');
const Q = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';
const r0 = await fetch(`https://fanqienovel.com/passport/sso/get_qrcode/?service=${svcE}&need_validate=0&${Q}`, { headers: H, signal: AbortSignal.timeout(20000) });
const j0 = JSON.parse(await r0.text());
const token = j0.data.token;
console.log('token:', token);

// scan-code.html
const scanUrl = `https://reading.snssdk.com/reading_offline/drweb/page/scan-code.html?custom_brightness=1&hide_nav_bar=1&hide_status_bar=1&need_custom_brightness=1&next_url=${encodeURIComponent('https://reading.snssdk.com/passport/sso/scan_qrcode/')}&qr_source_aid=2503&token=${token}&version_code=5.8.3`;
const r = await fetch(scanUrl, { headers: H, signal: AbortSignal.timeout(20000) });
const html = await r.text();
console.log('scan page:', r.status, 'len:', html.length);
// scripts
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
console.log('scripts:', JSON.stringify(scripts));
// inline JS with check_qrconnect?
for (const k of ['check_qrconnect', 'scan_qrcode', 'checkQRCode', 'qrcode_token', 'qr_token', 'token', 'poll', 'setInterval']) {
  const i = html.indexOf(k);
  console.log(`"${k}" @`, i, i >= 0 ? html.slice(Math.max(0, i - 150), i + 200).replace(/\s+/g, ' ') : '');
}
// fetch the first inline script fully
const inline = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
inline.forEach((s, i) => console.log(`\n=== inline script ${i} (${s.length}) ===\n` + s.slice(0, 1500)));
