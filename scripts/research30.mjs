// Research 30: fysh fontDecrypt + FanQieApi source, SEO comment page structure.
import fs from 'node:fs';
const TEMP = process.env.TEMP;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: AbortSignal.timeout(30000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}

// A. fysh files
for (const f of ['src/FanQieApi.ts', 'build/fontDecrypt.js', 'build/FanQieApi.js']) {
  try {
    const t = await getText(`https://raw.githubusercontent.com/fysh1010/mcp-server-fanqie/main/${f}`);
    fs.writeFileSync(TEMP + '/fysh_' + f.replace(/[\\/]/g, '_'), t);
    console.log(`\n######## fysh ${f} len=${t.length}`);
    const lines = t.split('\n');
    lines.forEach((l, i) => {
      if (/https?:|api|comment|font|decrypt|url|endpoint|item|directory/i.test(l)) console.log(String(i + 1).padStart(4) + '| ' + l.trim().slice(0, 200));
    });
  } catch (e) { console.log('ERR', f, e.message); }
}

// B. SEO comment page
function extractState(text) {
  const tag = '__INITIAL_STATE__=';
  const start = text.indexOf(tag);
  if (start < 0) return null;
  let i = start + tag.length;
  while (text[i] === ' ' || text[i] === '\n') i++;
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let k = i; k < text.length; k++) {
    const c = text[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  if (end <= 0) return null;
  try { return JSON.parse(text.slice(i, end)); } catch { return null; }
}
for (const url of [
  'https://fanqienovel.com/comment/7405108467217746969-7457186143312872217',
  'https://fanqienovel.com/comment/7576659101376072728',
]) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' }, signal: AbortSignal.timeout(30000) });
    const text = await r.text();
    console.log(`\n[${url}] HTTP ${r.status} len=${text.length}`);
    if (r.status === 200) {
      const st = extractState(text);
      if (st) {
        fs.writeFileSync(TEMP + '/fq_comment_page_state.json', JSON.stringify(st));
        console.log('comment state:', JSON.stringify(st.comment || {}).slice(0, 1800));
      }
    }
  } catch (e) { console.log('ERR', url, e.message); }
}
