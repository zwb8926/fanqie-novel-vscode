// Test: replay send_code with isResend+fp from the 1105 response (weak check?).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
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

// 1. 先拿一次 1105 响应，提取 fp 和 verify_ticket
const r1 = await fetch(`https://fanqienovel.com/passport/web/send_code/?${Q}`, {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
  body: `mix_mode=1&fixed_mix_mode=1&mobile=${E(MOBILE)}&type=${E('24')}&a_region=86&request_id=${Date.now()}`,
  signal: AbortSignal.timeout(20000),
});
const j1 = JSON.parse(await r1.text());
console.log('[step1] error_code:', j1.data.error_code);
let conf = null;
try { conf = JSON.parse(j1.data.verify_center_decision_conf); } catch { }
console.log('  fp:', conf?.fp, '| verify_ticket:', conf?.verify_ticket);
const fp = conf?.fp || '';
const vt = conf?.verify_ticket || '';

// 2. 重放：isResend + fp + verifyFp（模仿 SDK 的 successCb 重放）
await postForm('replay with fp', `https://fanqienovel.com/passport/web/send_code/?${Q}`,
  `mix_mode=1&fixed_mix_mode=1&mobile=${E(MOBILE)}&type=${E('24')}&a_region=86&request_id=${Date.now() + 1}&isResend=1&fp=${fp}&verifyFp=${fp}`);
// 3. 重放：带 verify_ticket
await postForm('replay with vt', `https://fanqienovel.com/passport/web/send_code/?${Q}`,
  `mix_mode=1&fixed_mix_mode=1&mobile=${E(MOBILE)}&type=${E('24')}&a_region=86&request_id=${Date.now() + 2}&isResend=1&fp=${fp}&verifyFp=${fp}&verify_ticket=${vt}`);
