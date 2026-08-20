// Test same-origin /passport/sso/ QR endpoints with full params (the SDK rewrite target).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };
async function t(name, url) {
  try {
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n[${name}] ${r.status} len=${text.length}`);
    if (j) {
      const d = j.data || {};
      console.log('  err:', d.error_code, '|', (d.description || j.message || '').slice(0, 60), '| qr_id:', d.qr_id ? 'YES' : '-', '| qr_token:', d.qr_token ? 'YES' : '-', '| img:', d.qr_code_url ? 'YES' : '-');
      if (d.qr_id) console.log('  FULL:', JSON.stringify(d).slice(0, 400));
    } else console.log('  body:', text.slice(0, 120));
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}
const svc1 = encodeURIComponent('https://fanqienovel.com/');
const Q2503 = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';
const Q1967 = Q2503.replace('aid=2503', 'aid=1967');

// SDK 重写目标：/passport/sso/get_qrcode/
await t('sso-proxy qrcode 2503', `https://fanqienovel.com/passport/sso/get_qrcode/?service=${svc1}&need_validate=0&${Q2503}`);
await t('sso-proxy qrcode 1967', `https://fanqienovel.com/passport/sso/get_qrcode/?service=${svc1}&need_validate=0&${Q1967}`);
// 微信扫码通道
await t('wechat qrcode 2503', `https://fanqienovel.com/passport/web/wechat/get_qrcode/?service=${svc1}&need_validate=0&${Q2503}`);
await t('wechat qrcode 1967', `https://fanqienovel.com/passport/web/wechat/get_qrcode/?service=${svc1}&need_validate=0&${Q1967}`);
// 旧路径直接（无 /passport/web 前缀，SDK 原始路径）
await t('raw /get_qrcode/ 2503', `https://fanqienovel.com/get_qrcode/?service=${svc1}&need_validate=0&${Q2503}`);
