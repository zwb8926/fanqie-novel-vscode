// 打包前清理旧的 .vsix 产物，避免目录里堆积旧版本包。
import { readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.cwd();
let removed = 0;
for (const f of readdirSync(dir)) {
  if (f.endsWith('.vsix')) {
    unlinkSync(join(dir, f));
    console.log('已删除旧包:', f);
    removed++;
  }
}
if (!removed) console.log('没有旧包需要清理');
