// Test aff-path send_code + sms_login (official SDK paths) with type + mix_mode.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };

function E(s) { // SDK 的 mobile 混淆：每字节 ^5 转 hex
  const bytes = new TextEncoder().encode(s);
  return Array.from(bytes).map(b => (5 ^ b).toString(16)).join('');
}

async function postForm(name, url, body, extraHeaders = {}) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8', ...extraHeaders },
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

const Q = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0';
const MOBILE = '17600818084';
const EM = E(MOBILE);
const ET = E('7');

// 1. aff 路径 + 明文参数（type=7）
await postForm('aff plain', `https://fanqienovel.com/passport/aff/web/mobile/send_code/?${Q}`,
  `mix_mode=0&mobile=${MOBILE}&a_region=86&type=7&request_id=${Date.now()}`);
// 2. aff 路径 + 混淆参数
await postForm('aff obf', `https://fanqienovel.com/passport/aff/web/mobile/send_code/?${Q}`,
  `mix_mode=1&fixed_mix_mode=1&mobile=${EM}&type=${ET}&a_region=86&request_id=${Date.now()}`);
// 3. 原 web 路径 + type=7
await postForm('web+type', `https://fanqienovel.com/passport/web/send_code/?${Q}`,
  `mix_mode=0&mobile=${MOBILE}&a_region=86&type=7&request_id=${Date.now()}`);
// 4. aff sms_login 路径可达性
await postForm('aff sms_login', `https://fanqienovel.com/passport/aff/web/mobile/sms_login/?${Q}`,
  `mix_mode=0&mobile=${MOBILE}&code=1234&a_region=86&type=7`);
// 5. proxy 前缀 aff
await postForm('aff proxy', `https://fanqienovel.com/passport/sso/aff/web/mobile/send_code/?${Q}`,
  `mix_mode=0&mobile=${MOBILE}&a_region=86&type=7&request_id=${Date.now()}`);
