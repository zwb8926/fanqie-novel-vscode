// Verify obfuscated sms_login (expect 1203 code error, not 3052).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };
function E(s) { return Array.from(new TextEncoder().encode(s)).map(b => (5 ^ b).toString(16)).join(''); }
async function postForm(name, url, body) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n[${name}] ${r.status}`);
    if (j) console.log('  ', JSON.stringify(j).slice(0, 400));
    else console.log('  body:', text.slice(0, 150));
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}
const Q = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';
const MOBILE = '13800138000';

// sms_login 混淆版（假验证码，期望业务错误而非参数错误）
await postForm('sms_login obf', `https://fanqienovel.com/passport/web/sms_login/?${Q}`,
  `mix_mode=1&fixed_mix_mode=1&mobile=${E(MOBILE)}&code=${E('1234')}&a_region=86`);
// send_code 再确认一次混淆版成功（拿 ticket）
await postForm('send_code obf', `https://fanqienovel.com/passport/web/send_code/?${Q}`,
  `mix_mode=1&fixed_mix_mode=1&mobile=${E(MOBILE)}&type=${E('24')}&a_region=86&request_id=${Date.now()}`);
