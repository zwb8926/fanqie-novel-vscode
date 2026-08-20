// Test rank API with the exact params the extension sends (empty category + each rank type).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' };
async function t(name, url) {
  try {
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch { }
    console.log(`[${name}] ${r.status} len=${text.length} code=${j?.code} msg=${j?.message} books=${j?.data?.book_list?.length ?? 'n/a'}`);
    if (j && j.code !== 0) console.log('   body:', text.slice(0, 200));
  } catch (e) { console.log(`[${name}] FAIL ${e.message}`); }
}
// 扩展当前发送的参数（category_id 为空字符串）
for (const type of [3, 1, 6, 4, 5]) {
  await t(`type=${type} cat=''`, `https://fanqienovel.com/api/rank/category/list?app_id=2503&rank_list_type=${type}&offset=0&limit=24&category_id=&rank_version=&gender=male&rankMold=`);
}
// category_id=0 对比
for (const type of [3, 1, 6]) {
  await t(`type=${type} cat=0`, `https://fanqienovel.com/api/rank/category/list?app_id=2503&rank_list_type=${type}&offset=0&limit=24&category_id=0&rank_version=&gender=male&rankMold=`);
}
// 不带空参数（完全省略）
await t(`type=3 no-empty-params`, `https://fanqienovel.com/api/rank/category/list?app_id=2503&rank_list_type=3&offset=0&limit=24&gender=male`);
// 女频
await t(`type=3 female cat=0`, `https://fanqienovel.com/api/rank/category/list?app_id=2503&rank_list_type=3&offset=0&limit=24&category_id=0&rank_version=&gender=female&rankMold=`);
