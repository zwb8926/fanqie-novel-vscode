// Systematic test: same-origin get_qrcode with aid=2503 + full params (the SMS-login winning combo).
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
      console.log('  err:', d.error_code, '|', (d.description || j.message || '').slice(0, 60), '| qr_id:', d.qr_id ? 'YES' : '-', '| qr_token:', d.qr_token ? 'YES' : '-', '| url:', d.qr_code_url ? 'YES' : '-');
      if (d.qr_id) console.log('  FULL:', JSON.stringify(d).slice(0, 300));
    } else console.log('  body:', text.slice(0, 120));
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}
const Q = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';
const svc1 = encodeURIComponent('https://fanqienovel.com/');
const svc2 = encodeURIComponent('https://fanqienovel.com/api/author/login/url/');
const svc3 = encodeURIComponent('https://fanqienovel.com/passport/web/web_login/');

// direct 路径 + 三种 service
await t('direct svc=/', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc1}&need_validate=0&${Q}`);
await t('direct svc=author', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc2}&need_validate=0&${Q}`);
await t('direct svc=web_login', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc3}&need_validate=0&${Q}`);
// 加 request_id / biz_params
await t('direct +request_id', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc1}&need_validate=0&request_id=${Date.now()}&${Q}`);
await t('direct +biz_params', `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc1}&need_validate=0&biz_params=${encodeURIComponent('{"url":"https://fanqienovel.com/"}')}&${Q}`);
// sso 路径变体（可能 sso 域名可用，先探测）
await t('sso passport', `https://sso.douyin.com/passport/web/get_qrcode/?service=${svc1}&need_validate=0&${Q}`);
// GET qrcode 旧路径 + 完整参数
await t('sso classic full', `https://sso.douyin.com/get_qr_code/?service=${svc1}&need_validate=0&${Q}`);
