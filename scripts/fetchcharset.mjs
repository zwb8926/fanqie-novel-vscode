// Fetch ying-ck charset.json — possibly a fuller font map.
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36' };
async function getText(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
try {
  const t = await getText('https://raw.githubusercontent.com/ying-ck/fanqienovel-downloader/main/src/charset.json');
  console.log('charset.json len:', t.length);
  let j;
  try { j = JSON.parse(t); } catch { console.log('not json:', t.slice(0, 200)); process.exit(0); }
  console.log('type:', Array.isArray(j) ? 'array len ' + j.length : 'object keys ' + Object.keys(j).length);
  const s = JSON.stringify(j);
  const has58620 = s.includes('58620');
  const has58589 = s.includes('58589');
  console.log('has 58620:', has58620, '| has 58589:', has58589);
  // print a sample
  if (Array.isArray(j)) console.log('sample:', JSON.stringify(j.slice(0, 30)));
  else console.log('sample:', JSON.stringify(Object.entries(j).slice(0, 30)));
} catch (e) { console.log('FAIL', e.message); }
