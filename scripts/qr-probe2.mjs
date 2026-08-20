// Full QR response + probe check_qrconnect polling param names.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };
const svc = 'https://fanqienovel.com/';
const svcE = encodeURIComponent(svc);
const Q = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';

// 1. full response
const r1 = await fetch(`https://fanqienovel.com/passport/sso/get_qrcode/?service=${svcE}&need_validate=0&${Q}`, { headers: H, signal: AbortSignal.timeout(20000) });
const j1 = JSON.parse(await r1.text());
const d = j1.data || {};
console.log('token:', d.token);
console.log('web_name:', d.web_name);
console.log('is_frontier:', d.is_frontier);
console.log('qrcode_index_url:', d.qrcode_index_url);
console.log('copywriting:', d.copywriting);
console.log('qrcode len:', (d.qrcode || '').length);

// 2. poll with different param names
async function poll(name, extra) {
  try {
    const r = await fetch(`https://fanqienovel.com/passport/sso/check_qrconnect/?service=${svcE}&need_validate=0&${Q}&${extra}`, { headers: H, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n[poll ${name}] ${r.status}`);
    if (j) console.log('  ', JSON.stringify(j).slice(0, 300));
    else console.log('  body:', text.slice(0, 100));
  } catch (e) { console.log(`\n[poll ${name}] FAIL ${e.message}`); }
}
const t = d.token || '';
await poll('qrcode_token', `qrcode_token=${t}`);
await poll('qr_token', `qr_token=${t}`);
await poll('token', `token=${t}`);
await poll('qr_id', `qr_id=${t}`);
// also try the direct /passport/web/check_qrconnect/ path
try {
  const r = await fetch(`https://fanqienovel.com/passport/web/check_qrconnect/?service=${svcE}&need_validate=0&${Q}&qrcode_token=${t}`, { headers: H, signal: AbortSignal.timeout(20000) });
  console.log('\n[direct check_qrconnect]', r.status, (await r.text()).slice(0, 200));
} catch (e) { console.log('\n[direct check_qrconnect] FAIL', e.message); }
