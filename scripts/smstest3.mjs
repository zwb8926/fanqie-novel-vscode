// Brute-force sms_login variants to find a working login path.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };
const TICKET = 'mobile_ticket_test1234567890';
async function t(name, url, opts = {}) {
  try {
    const r = await fetch(url, { headers: { ...H, ...opts.headers }, method: opts.method || 'GET', body: opts.body, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n[${name}] ${r.status}`);
    if (j) console.log('  ', JSON.stringify(j).slice(0, 300));
    else console.log('  body:', text.slice(0, 120));
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}
const BASE = 'https://fanqienovel.com/passport/web/';
const Q = 'aid=1967&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0';
const BODY = 'mix_mode=1&mobile=13800138000&code=1234&a_region=86&mobile_ticket=' + TICKET;

// form-urlencoded POST（标准 passport 用法）
await t('sms_login form', BASE + 'sms_login/?' + Q, { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' }, body: BODY });
await t('sms_login_only form', BASE + 'sms_login_only/?' + Q, { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' }, body: BODY });
await t('sms_login_continue form', BASE + 'sms_login_continue/?' + Q, { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' }, body: BODY });
// JSON POST + ticket 放 query
await t('sms_login json+ticket', BASE + 'sms_login/?' + Q + '&mobile_ticket=' + TICKET, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ mix_mode: 1, mobile: '13800138000', code: '1234', a_region: '86' }) });
// 全参数在 query（GET）
await t('sms_login all-query', BASE + 'sms_login/?' + Q + '&mix_mode=1&mobile=13800138000&code=1234&a_region=86&mobile_ticket=' + TICKET);
// aid=2503
await t('sms_login aid2503 form', BASE + 'sms_login/?' + Q.replace('aid=1967', 'aid=2503'), { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' }, body: BODY });
// validate_code（校验验证码）路径探测
await t('validate_code form', BASE + 'validate_code/?' + Q, { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' }, body: BODY });
