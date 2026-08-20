// Smoke test 2: cookie-jar client + endpoint variants.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function makeJar() {
  const store = new Map(); // domain -> Map(name -> {value, path, secure, expires})
  return {
    cookiesFor(url) {
      const u = new URL(url);
      const host = u.hostname;
      const out = [];
      const now = Date.now();
      for (const [dom, m] of store) {
        if (host !== dom && !host.endsWith('.' + dom)) continue;
        for (const [name, c] of m) {
          if (c.expires && c.expires < now) continue;
          if (c.secure && u.protocol !== 'https:') continue;
          out.push(name + '=' + c.value);
        }
      }
      return out.join('; ');
    },
    setFrom(resp, url) {
      const setCookies = resp.headers.getSetCookie ? resp.headers.getSetCookie() : [];
      const u = new URL(url);
      for (const sc of setCookies) {
        const parts = sc.split(';');
        const [name, ...v] = parts[0].trim().split('=');
        if (!name) continue;
        let domain = u.hostname;
        let path = '/';
        let secure = false;
        let expires = null;
        for (const p of parts.slice(1)) {
          const [k, ...vv] = p.trim().split('=');
          const val = vv.join('=');
          if (k.toLowerCase() === 'domain' && val) domain = val.replace(/^\./, '');
          else if (k.toLowerCase() === 'path') path = val || '/';
          else if (k.toLowerCase() === 'secure') secure = true;
          else if (k.toLowerCase() === 'expires') expires = Date.parse(val);
          else if (k.toLowerCase() === 'max-age') expires = Date.now() + parseInt(val || '0') * 1000;
        }
        if (!store.has(domain)) store.set(domain, new Map());
        store.get(domain).set(name, { value: v.join('='), path, secure, expires });
      }
    },
    all() {
      const out = [];
      for (const [, m] of store) for (const [n, c] of m) out.push(n + '=' + c.value);
      return out;
    },
  };
}

const jar = makeJar();
async function req(url, opts = {}) {
  const headers = {
    'User-Agent': UA,
    'Referer': 'https://fanqienovel.com/',
    'Origin': 'https://fanqienovel.com',
    'Accept': 'application/json, text/plain, */*',
    ...opts.headers,
  };
  const ck = jar.cookiesFor(url);
  if (ck) headers['Cookie'] = ck;
  const r = await fetch(url, { ...opts, headers, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  jar.setFrom(r, url);
  return r;
}

async function t(name, url, opts = {}) {
  try {
    const r = await req(url, opts);
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { }
    console.log(`\n==== ${name}\nURL: ${url}\nHTTP: ${r.status} bodyLen=${text.length}`);
    if (j) {
      console.log('code:', j.code, '| message:', j.message);
      const s = JSON.stringify(j).slice(0, 700);
      console.log('json:', s);
    } else {
      console.log('body:', text.slice(0, 250));
    }
  } catch (e) { console.log(`\n==== ${name}\nFAIL: ${e.message}`); }
}

// 0. homepage to get cookies
try {
  const r = await req('https://fanqienovel.com/');
  console.log('homepage status:', r.status, 'cookies now:', jar.all().slice(0, 10).join(', '));
} catch (e) { console.log('homepage FAIL', e.message); }

// 1. search variants
await t('search-A', 'https://fanqienovel.com/api/author/search/search_book/v1?filter=127,121,127&page_count=10&page_index=0&query_type=0&query_word=' + encodeURIComponent('万相之王') + '&rank_type=0');
await t('search-B', 'https://fanqienovel.com/api/search/search_book/v1?filter=127,121,127&page_count=10&page_index=0&query_type=0&query_word=' + encodeURIComponent('万相之王') + '&rank_type=0');
await t('search-C-post', 'https://fanqienovel.com/api/author/search/search_book/v1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query_word: '万相之王', page_index: 0, page_count: 10, filter: [], rank_type: 0, query_type: 0 }),
});
// 2. app search same-origin (no signature attempt)
await t('search-D-app', 'https://fanqienovel.com/reading/bookapi/search/book/v?aid=1967&iid=0&version_code=57700&update_version_code=57700&offset=0&limit=10&query=' + encodeURIComponent('万相之王'));
// 3. SSR book page for a known chapter item id to discover book id
await t('ssr-chapter-page', 'https://fanqienovel.com/reader/7392244682832495129');
