// Test SDK-style params: next + token on both /passport/sso/ and /passport/web/ paths.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };
const Q = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';
const next = encodeURIComponent('https://fanqienovel.com/');

async function t(name, url) {
  try {
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n[${name}] ${r.status} len=${text.length}`);
    if (j) {
      const d = j.data || {};
      console.log('  err:', d.error_code ?? j.error_code, '|', (d.description || j.message || '').slice(0, 50), '| keys:', Object.keys(d).slice(0, 8).join(','));
      if (d.qrcode || d.qr_id || d.token) console.log('  HIT:', JSON.stringify(d).slice(0, 250));
    } else console.log('  body:', text.slice(0, 100));
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}

// 1. get_qrcode with next (sso-proxy path)
await t('get next (sso)', `https://fanqienovel.com/passport/sso/get_qrcode/?next=${next}&${Q}`);
// 2. get_qrcode with next (direct path)
await t('get next (direct)', `https://fanqienovel.com/passport/web/get_qrcode/?next=${next}&${Q}`);
// 3. poll with token + next (sso-proxy)
const r0 = await fetch(`https://fanqienovel.com/passport/sso/get_qrcode/?next=${next}&${Q}`, { headers: H, signal: AbortSignal.timeout(20000) });
const j0 = JSON.parse(await r0.text());
const token = j0.data?.token || j0.data?.qr_token || '';
console.log('\nnew token:', token);
await t('poll token+next (sso)', `https://fanqienovel.com/passport/sso/check_qrconnect/?next=${next}&token=${token}&${Q}`);
await t('poll token+next (direct)', `https://fanqienovel.com/passport/web/check_qrconnect/?next=${next}&token=${token}&${Q}`);
await t('poll token+next (reading)', `https://reading.snssdk.com/passport/sso/check_qrconnect/?next=${next}&token=${token}&${Q}`);
