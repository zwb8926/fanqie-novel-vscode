// Full direct check_qrconnect response + poll several times (watch status change).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };
const Q = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';
const next = encodeURIComponent('https://fanqienovel.com/');

const r0 = await fetch(`https://fanqienovel.com/passport/web/get_qrcode/?next=${next}&${Q}`, { headers: H, signal: AbortSignal.timeout(20000) });
const j0 = JSON.parse(await r0.text());
console.log('get_qrcode data keys:', Object.keys(j0.data || {}).join(','));
console.log('get_qrcode data:', JSON.stringify(j0.data).slice(0, 500));
const token = j0.data.token;

// poll 3 times
for (let i = 1; i <= 3; i++) {
  const r = await fetch(`https://fanqienovel.com/passport/web/check_qrconnect/?next=${next}&token=${token}&${Q}`, { headers: H, signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { }
  console.log(`\n[poll#${i}] ${r.status} len=${text.length}`);
  if (j) {
    console.log('  top:', JSON.stringify(j).slice(0, 600));
  } else console.log('  body:', text.slice(0, 150));
}
