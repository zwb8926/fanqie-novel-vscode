// Research 19: brute-force same-origin passport params + find SDK init config in bundle.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(25000), ...opts });
  return { status: r.status, text: await r.text() };
}
const H = { 'Referer': 'https://fanqienovel.com/', 'Origin': 'https://fanqienovel.com', 'Accept': 'application/json, text/plain, */*' };
const svc = encodeURIComponent('https://fanqienovel.com/api/author/login/url/');

const combos = [
  ['A', `aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&os_version=10&device_type=P30&iid=0&device_id=0&update_version_code=57700&manifest_version_code=57700&new_user=0`],
  ['B', `aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0&is_silent=0`],
  ['C', `aid=1967&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0`],
  ['D', `aid=1967&app_name=novelapp&version_code=57700&device_platform=android&os=android&os_version=10&device_type=P30&channel=43536163a&sdk_version=7.0.1.32&passport_sdk_version=2.0.0&new_user=0`],
  ['E', `aid=1967&app_name=novelapp&version_code=70132&device_platform=android&os=android&channel=43536163a&sdk_version=7.0.1.32&new_user=0`],
  ['F', `aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&new_user=0&need_validate=0`],
];
for (const [name, qs] of combos) {
  const url = `https://fanqienovel.com/passport/web/get_qrcode/?service=${svc}&${qs}`;
  try {
    const { status, text } = await getText(url, { headers: H });
    console.log(`\n[${name}] HTTP ${status}: ${text.slice(0, 400)}`);
  } catch (e) { console.log(`\n[${name}] FAIL ${e.message}`); }
}

// find SDK init config in bundle
const js = (await getText('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js')).text;
function searchKey(key, maxHits = 2, ctx = 600) {
  let idx = js.indexOf(key);
  let n = 0;
  while (idx >= 0 && n < maxHits) {
    console.log(`\n==== "${key}" @${idx}:\n` + js.slice(Math.max(0, idx - ctx), idx + ctx).replace(/\n+/g, ' '));
    idx = js.indexOf(key, idx + 1);
    n++;
  }
  if (n === 0) console.log(`\n==== "${key}": NOT FOUND`);
}
console.log('\n\n######## sdk init config');
searchKey('webmssdk', 1, 300);
searchKey('aid:1967', 2, 300);
searchKey('app_name:"novelapp"', 2, 300);
searchKey('1967,app_name', 2, 300);
searchKey('loginUrl', 2, 300);
searchKey('check_login', 2, 300);
