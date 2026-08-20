// Test aff-channel obfuscated send_code (type=7) — may bypass slide captcha.
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
const MOBILE = '13800138000'; // 已被标记的测试号
const rid = Date.now();

// 1. aff 通道 + 混淆（type=7 混淆）
await postForm('aff obf type7', `https://fanqienovel.com/passport/aff/web/mobile/send_code/?${Q}`,
  `mix_mode=1&fixed_mix_mode=1&mobile=${E(MOBILE)}&type=${E('7')}&a_region=86&request_id=${rid}`);
// 2. aff 通道 + 混淆 + type=24（试探）
await postForm('aff obf type24', `https://fanqienovel.com/passport/aff/web/mobile/send_code/?${Q}`,
  `mix_mode=1&fixed_mix_mode=1&mobile=${E(MOBILE)}&type=${E('24')}&a_region=86&request_id=${rid + 1}`);
// 3. web 通道再看一次完整 1105 响应（抓 verify_center_decision_conf 全文）
const resp = await fetch(`https://fanqienovel.com/passport/web/send_code/?${Q}`, {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
  body: `mix_mode=1&fixed_mix_mode=1&mobile=${E(MOBILE)}&type=${E('24')}&a_region=86&request_id=${rid + 2}`,
  signal: AbortSignal.timeout(20000),
});
const full = JSON.parse(await resp.text());
console.log('\n[web 1105 full]');
console.log('error_code:', full.data.error_code, '| desc:', full.data.description);
const conf = full.data.verify_center_decision_conf;
console.log('verify_center_decision_conf:', conf);
if (conf) {
  try { console.log('parsed:', JSON.stringify(JSON.parse(conf), null, 1).slice(0, 800)); } catch { /* raw */ }
}
