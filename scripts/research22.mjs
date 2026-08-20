// Research 22: test the same-origin /passport/sso/ proxy mount for QR login!
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(25000), ...opts });
  const text = await r.text();
  return { status: r.status, text, headers: Object.fromEntries(r.headers.entries()) };
}
async function t(name, url, opts = {}) {
  try {
    const { status, text, headers } = await getText(url, opts);
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nURL: ${url}\nHTTP: ${status} len=${text.length}`);
    if (j) console.log('json:', JSON.stringify(j).slice(0, 900));
    else console.log('body:', text.slice(0, 250));
  } catch (e) { console.log(`\n==== ${name} FAIL: ${e.message}`); }
}
const svc = encodeURIComponent('https://fanqienovel.com/api/author/login/url/');
const svc2 = encodeURIComponent('https://fanqienovel.com/');

// classic QR path through proxy
await t('proxy-get_qr_code', `https://fanqienovel.com/passport/sso/get_qr_code/?service=${svc}&need_validate=0`, { headers: H });
await t('proxy-get_qr_code2', `https://fanqienovel.com/passport/sso/get_qr_code/?service=${svc2}&need_validate=0`, { headers: H });
// new passport path through proxy
await t('proxy-get_qrcode', `https://fanqienovel.com/passport/sso/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=1967&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0`, { headers: H });
await t('proxy-get_qrcode-2503', `https://fanqienovel.com/passport/sso/passport/web/get_qrcode/?service=${svc}&need_validate=0&aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1`, { headers: H });
// maybe it's sso path style: /passport/sso/web/get_qrcode/
await t('proxy-alt', `https://fanqienovel.com/passport/sso/web/get_qrcode/?service=${svc}&need_validate=0&aid=1967`, { headers: H });
