// Probe SMS login endpoints (same-origin passport on fanqienovel.com).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json; charset=utf-8' };
const MOBILE = '13800138000'; // 测试号（不会真发短信）

async function t(name, url, opts = {}) {
  try {
    const r = await fetch(url, { headers: { ...H, ...opts.headers }, method: opts.method || 'GET', body: opts.body, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n[${name}] ${r.status} len=${text.length}`);
    if (j) console.log('  json:', JSON.stringify(j).slice(0, 400));
    else console.log('  body:', text.slice(0, 200));
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}

// 同源 passport：发送验证码（多种路径）
const q = 'mix_mode=1&mobile=' + MOBILE + '&a_region=86&aid=1967&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';
await t('send_code direct', `https://fanqienovel.com/passport/web/send_code/?${q}`);
await t('send_code proxy', `https://fanqienovel.com/passport/sso/passport/web/send_code/?${q}`);
await t('send_code proxy2', `https://fanqienovel.com/passport/sso/web/send_code/?${q}`);
await t('send_code aid2503', `https://fanqienovel.com/passport/web/send_code/?mix_mode=1&mobile=${MOBILE}&a_region=86&aid=2503&app_name=novelapp&version_code=57700&device_platform=web`);
// sso 直连（预期风控）
await t('send_code sso', `https://sso.douyin.com/passport/web/send_code/?${q}`);
// sms_login 直连（探测）
await t('sms_login proxy', `https://fanqienovel.com/passport/sso/passport/web/sms_login/?aid=1967&app_name=novelapp&version_code=57700&device_platform=web&sdk_version=1.6.1`, {
  method: 'POST',
  body: JSON.stringify({ mix_mode: 1, mobile: MOBILE, code: '1234', a_region: '86', aid: 1967 }),
});
