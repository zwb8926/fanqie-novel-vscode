// Verify direct-path sms_login + send_code param requirements.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json; charset=utf-8' };
async function t(name, url, opts = {}) {
  try {
    const r = await fetch(url, { headers: { ...H, ...opts.headers }, method: opts.method || 'GET', body: opts.body, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n[${name}] ${r.status} len=${text.length}`);
    if (j) console.log('  json:', JSON.stringify(j).slice(0, 500));
    else console.log('  body:', text.slice(0, 200));
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}

// 1. sms_login direct path (expect: 验证码错误, not 无权限)
await t('sms_login direct GET', `https://fanqienovel.com/passport/web/sms_login/?mix_mode=1&mobile=13800138000&code=1234&a_region=86&aid=1967&app_name=novelapp&version_code=57700&device_platform=web&sdk_version=1.6.1&passport_sdk_version=2.0.0`);
await t('sms_login direct POST', `https://fanqienovel.com/passport/web/sms_login/?aid=1967&app_name=novelapp&version_code=57700&device_platform=web&sdk_version=1.6.1`, {
  method: 'POST',
  body: JSON.stringify({ mix_mode: 1, mobile: '13800138000', code: '1234', a_region: '86' }),
});
// 2. send_code with extra params (from/request_id)
await t('send_code +from', `https://fanqienovel.com/passport/web/send_code/?mix_mode=1&mobile=13800138000&a_region=86&aid=1967&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&from=fanqienovel&request_id=${Date.now()}`);
// 3. web_login / third auth probe (other login paths)
await t('web_login direct', `https://fanqienovel.com/passport/web/web_login/?aid=1967&app_name=novelapp&version_code=57700&device_platform=web&sdk_version=1.6.1`);
// 4. check_login (verify session state)
await t('check_login direct', `https://fanqienovel.com/passport/account/info/v2/?aid=1967&app_name=novelapp&version_code=57700&device_platform=web`);
