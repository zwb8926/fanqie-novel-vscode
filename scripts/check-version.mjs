// 打包前置校验：package.json 的 version 必须与当前 git 分支名一致（版本跟随分支）。
// 不一致时终止打包，避免产出与分支不匹配的 VSIX。
// 读取 .git/HEAD 获取分支名（纯文件操作，不依赖外部命令）。
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

function currentBranch() {
  try {
    const head = fs.readFileSync(path.join('.git', 'HEAD'), 'utf8').trim();
    const m = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (m) return m[1].trim();
    return ''; // detached HEAD（内容是 commit SHA）
  } catch {
    return '';
  }
}

const branch = currentBranch();
if (!branch) {
  console.error('✘ 无法获取当前 git 分支（请确认在 git 仓库内，且已切换到目标版本分支）');
  process.exit(1);
}
if (pkg.version !== branch) {
  console.error(
    `✘ 版本号 ${pkg.version} 与当前分支 ${branch} 不一致。\n` +
      `  请先修改 package.json 的 "version" 为 "${branch}" 后重新打包。`
  );
  process.exit(1);
}
console.log(`✔ 版本 ${pkg.version} 与分支 ${branch} 一致，开始打包…`);
