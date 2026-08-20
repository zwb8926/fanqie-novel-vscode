// Research script: fetch fanqienovel API knowledge from open-source projects.
import fs from 'node:fs';
const base = 'https://api.github.com';
const UA = { 'User-Agent': 'dsh-research', 'Accept': 'application/vnd.github+json' };

async function getJson(url, opts = {}) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000), ...opts });
  if (!r.ok) throw new Error(url + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}

async function repoFiles(repo) {
  const meta = await getJson(`${base}/repos/${repo}`);
  const tree = await getJson(`${base}/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`);
  return { branch: meta.default_branch, files: tree.tree.filter(t => t.type === 'blob').map(t => t.path) };
}

const repos = ['lemnt-ai/fanqie-mcp-server', 'fysh1010/mcp-server-fanqie', 'wzcv/FQWeb'];

for (const repo of repos) {
  console.log('\n######## ' + repo);
  try {
    const { branch, files } = await repoFiles(repo);
    console.log('FILES:');
    console.log(files.join('\n'));
    // save file list for later
    fs.writeFileSync(process.env.TEMP + '/fq-' + repo.replace('/', '-') + '.txt', files.join('\n'));
  } catch (e) { console.log('ERR ' + e.message); }
}

console.log('\n######## repo search fanqienovel');
try {
  const s = await getJson(`${base}/search/repositories?q=fanqienovel&sort=stars&order=desc&per_page=15`);
  for (const it of s.items) console.log(it.full_name + ' | stars:' + it.stargazers_count + ' | ' + (it.description || ''));
} catch (e) { console.log('ERR ' + e.message); }
