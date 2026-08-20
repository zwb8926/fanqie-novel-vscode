// Test send_code with type=24 (web login) — plain & obfuscated mobile.
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
    if (j) console.log('  ', JSON.stringify(j).slice(0, 350));
    else console.log('  body:', text.slice(0, 150));
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}
const Q = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';
const MOBILE = '13800138000'; // 测试号，避免真发短信
const rid = Date.now();

// 1. type=24 明文
await postForm('type24 plain', `https://fanqienovel.com/passport/web/send_code/?${Q}`,
  `mix_mode=0&mobile=${MOBILE}&a_region=86&type=24&request_id=${rid}`);
// 2. type=24 混淆 mobile
await postForm('type24 obf', `https://fanqienovel.com/passport/web/send_code/?${Q}`,
  `mix_mode=1&fixed_mix_mode=1&mobile=${E(MOBILE)}&type=${E('24')}&a_region=86&request_id=${rid + 1}`);
// 3. type=16（注册场景）
await postForm('type16 plain', `https://fanqienovel.com/passport/web/send_code/?${Q}`,
  `mix_mode=0&mobile=${MOBILE}&a_region=86&type=16&request_id=${rid + 2}`);
// 4. X.smsLogin 用 login_only + type 探测（拿假验证码测路径）
await postForm('sms_login type24', `https://fanqienovel.com/passport/web/sms_login/?${Q}`,
  `mix_mode=0&mobile=${MOBILE}&code=1234&a_region=86&type=24`);
