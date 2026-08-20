// Research script part 2: fetch key source files and extract API endpoints.
import fs from 'node:fs';
const base = 'https://api.github.com';
const UA = { 'User-Agent': 'dsh-research', 'Accept': 'application/vnd.github+json' };
const TEMP = process.env.TEMP;

async function getJson(url, opts = {}) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
async function listFiles(repo) {
  const meta = await getJson(`${base}/repos/${repo}`);
  const tree = await getJson(`${base}/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`);
  return { branch: meta.default_branch, files: tree.tree.filter(t => t.type === 'blob').map(t => t.path) };
}

// 1. list files of extra repos
for (const repo of ['ying-ck/fanqienovel-downloader', 'POf-L/Fanqie-novel-Downloader', 'naiyQAQ/fanqie-assistant', 'MeoProject/PyFQWeb']) {
  console.log('\n######## ' + repo);
  try {
    const { files } = await listFiles(repo);
    console.log(files.join('\n'));
  } catch (e) { console.log('ERR ' + e.message); }
}

// 2. fetch specific implementation files
const targets = [
  ['lemnt-ai/fanqie-mcp-server', 'master', 'utils/fanqie_client.py'],
  ['lemnt-ai/fanqie-mcp-server', 'master', 'tools/comments.py'],
  ['fysh1010/mcp-server-fanqie', 'main', 'src/FanQieApi.ts'],
  ['wzcv/FQWeb', 'main', 'src/main.js'],
  ['wzcv/FQWeb', 'main', 'src/utils.js'],
  ['MeoProject/PyFQWeb', 'main', 'fanqie.py'],
];
for (const [repo, branch, path] of targets) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  console.log('\n######## fetch ' + repo + '/' + path);
  try {
    const text = await getText(url);
    const safe = repo.replace('/', '-') + '__' + path.replace(/[\\/]/g, '_');
    fs.writeFileSync(`${TEMP}/${safe}`, text);
    console.log('saved ' + safe + ' len=' + text.length);
    // print endpoint lines
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      if (/api\/|fanqienovel\.com|sso\.douyin|login|qr/i.test(l)) {
        console.log(String(i + 1).padStart(4) + '| ' + l.trim().slice(0, 200));
      }
    });
  } catch (e) { console.log('ERR ' + e.message); }
}
