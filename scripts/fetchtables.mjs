// Fetch romcere/fanqienovel-decryptor + POf-L downloader font tables (best effort).
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36' };
async function getText(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

// 1. romcere README + likely files
for (const f of ['README.md', 'fanqienovel_decryptor/font.py', 'fanqienovel_decryptor/__init__.py', 'main.py', 'src/font.py', 'font.py', 'decryptor.py', 'src/decryptor.py']) {
  try {
    const t = await getText(`https://raw.githubusercontent.com/romcere/fanqienovel-decryptor/main/${f}`);
    console.log(`\n######## romcere/${f} len=${t.length}`);
    const lines = t.split('\n');
    lines.forEach((l, i) => {
      if (/gid|font|字|58620|58589|58593|map|dict|charset/i.test(l)) console.log(String(i + 1).padStart(4) + '| ' + l.trim().slice(0, 160));
    });
  } catch (e) { /* skip */ }
}
