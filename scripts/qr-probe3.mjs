// Probe check_qrconnect on reading.snssdk.com (the app's passport mount).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };
const svcE = encodeURIComponent('https://fanqienovel.com/');
const Q = 'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';

// fresh token
const r0 = await fetch(`https://fanqienovel.com/passport/sso/get_qrcode/?service=${svcE}&need_validate=0&${Q}`, { headers: H, signal: AbortSignal.timeout(20000) });
const token = JSON.parse(await r0.text()).data.token;
console.log('token:', token);

async function poll(name, url) {
  try {
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n[poll ${name}] ${r.status} len=${text.length}`);
    if (j) console.log('  ', JSON.stringify(j).slice(0, 350));
    else console.log('  body:', text.slice(0, 100));
  } catch (e) { console.log(`\n[poll ${name}] FAIL ${e.message}`); }
}

// reading.snssdk.com 同源挂载（next_url 揭示的域）
await poll('reading qrcode_token', `https://reading.snssdk.com/passport/sso/check_qrconnect/?service=${svcE}&need_validate=0&qrcode_token=${token}&qr_source_aid=2503`);
await poll('reading token+aid', `https://reading.snssdk.com/passport/sso/check_qrconnect/?service=${svcE}&need_validate=0&token=${token}&qr_source_aid=2503`);
// fanqienovel direct + qr_source_aid
await poll('direct +aid', `https://fanqienovel.com/passport/web/check_qrconnect/?service=${svcE}&need_validate=0&qrcode_token=${token}&qr_source_aid=2503&${Q}`);
// 经典参数名（qr_id/qr_token 双字段）
await poll('classic qr_id+token', `https://fanqienovel.com/passport/sso/check_qrconnect/?service=${svcE}&need_validate=0&qr_id=${token}&qr_token=${token}`);
// reading 域经典
await poll('reading classic', `https://reading.snssdk.com/passport/sso/check_qrconnect/?service=${svcE}&need_validate=0&qr_id=${token}&qr_token=${token}`);
