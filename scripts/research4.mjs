// Research 4: find QR login flow & comment endpoints from the official site JS and small repos.
import fs from 'node:fs';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' };
const TEMP = process.env.TEMP;
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { ...UA, ...opts.headers }, signal: AbortSignal.timeout(30000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
async function getJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}
async function listFiles(repo) {
  const meta = await getJson(`https://api.github.com/repos/${repo}`);
  const tree = await getJson(`https://api.github.com/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`);
  return { branch: meta.default_branch, files: tree.tree.filter(t => t.type === 'blob').map(t => t.path), truncated: tree.truncated };
}

function grepPrint(name, text, patterns, maxLines = 120) {
  const lines = text.split('\n');
  let count = 0;
  lines.forEach((l, i) => {
    if (patterns.some(p => p.test(l))) {
      if (count++ < maxLines) console.log(String(i + 1).padStart(5) + '| ' + l.trim().slice(0, 220));
    }
  });
  console.log(`--- ${name}: ${count} matching lines`);
}

// A. small repos with possible login/comment implementations
for (const repo of ['kailous/fanqienovel-book', 'luochaolun/fanqienovel', 'shing-yu/FanQieNovelDownloadOnWeb', 'rainyautumn1/FanqieNovelDownloader', 'denniemok/fanqie-novel-reader']) {
  console.log('\n######## ' + repo);
  try {
    const { branch, files, truncated } = await listFiles(repo);
    console.log('branch=' + branch + ' truncated=' + truncated + ' files=' + files.length);
    console.log(files.join('\n'));
  } catch (e) { console.log('ERR ' + e.message); }
}

// B. userscript dist bundle — grep for comment endpoints
try {
  const dist = await getText('https://raw.githubusercontent.com/naiyQAQ/fanqie-assistant/main/dist/fanqie-assistant.user.js');
  fs.writeFileSync(TEMP + '/fqa_dist.user.js', dist);
  console.log('\n######## fqa dist len=' + dist.length);
  grepPrint('dist', dist, [/comment|评论|段评|章评/i], 80);
  grepPrint('dist sso', dist, [/sso\.douyin|get_qr_code|check_qrconnect|qrconnect|passport/i], 40);
} catch (e) { console.log('ERR dist: ' + e.message); }

// C. official login page JS chunks — grep for sso/qr
try {
  const loginHtml = await getText('https://fanqienovel.com/login', { headers: { 'Accept': 'text/html' } });
  fs.writeFileSync(TEMP + '/fq_login.html', loginHtml);
  console.log('\n######## login page len=' + loginHtml.length);
  const chunks = [...loginHtml.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]);
  console.log('js chunks:', chunks.slice(0, 30));
  for (const c of chunks.slice(0, 20)) {
    const url = c.startsWith('http') ? c : 'https://fanqienovel.com' + c;
    try {
      const js = await getText(url);
      if (/sso\.douyin|get_qr_code|check_qrconnect|qrconnect/.test(js)) {
        console.log('\n######## chunk with sso: ' + url + ' len=' + js.length);
        grepPrint(url.split('/').pop(), js, [/sso\.douyin|get_qr_code|check_qrconnect|qrconnect|service=/i], 30);
      }
    } catch (e) { /* skip */ }
  }
} catch (e) { console.log('ERR login page: ' + e.message); }
