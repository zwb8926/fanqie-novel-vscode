// Robust state extraction + comment-0 page list check.
const UA = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
  return { status: r.status, text: await r.text() };
}
function extract(html) {
  const idx = html.lastIndexOf('__INITIAL_STATE__=');
  if (idx < 0) return null;
  let i = idx + 19;
  while (i < html.length && (html[i] === ' ' || html[i] === '\n' || html[i] === '\r' || html[i] === '\t')) i++;
  if (html[i] === '"') {
    // quoted (double-encoded) JSON string
    let k = i + 1, esc = false;
    for (; k < html.length; k++) {
      const c = html[k];
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') break;
    }
    try {
      const inner = JSON.parse(html.slice(i, k + 1));
      return typeof inner === 'string' ? JSON.parse(inner) : inner;
    } catch { return null; }
  }
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let k = i; k < html.length; k++) {
    const c = html[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  if (end <= 0) return null;
  try { return JSON.parse(html.slice(i, end)); } catch { return null; }
}

for (const url of [
  'https://fanqienovel.com/comment/7405108467217746969-0',
  'https://fanqienovel.com/comment/7405108467217746969-7457186143312872217',
]) {
  const { status, text } = await getText(url);
  const st = extract(text);
  const c = st?.comment || {};
  console.log(`\n[${url}] ${status} len=${text.length}`);
  console.log('comment.data:', JSON.stringify(c.data).slice(0, 1600));
}
