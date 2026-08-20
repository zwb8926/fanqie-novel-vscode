// Find X.smsLogin full definition (params + type + encryption list).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const js = await (await fetch('https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_5a5ed207.js', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })).text();
// X instance around 3007110
console.log(js.slice(3007110, 3009000).replace(/\n+/g, ' '));
