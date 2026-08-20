// Verify fix 1: rank all-category via SSR (repeat fetches to hit both serialization forms) + other SSR pages.
import { getRankList, getRankAllList, getDirectory, getChapter, getBookDetail } from '../out/api/fanqie.js';
import { extractInitialState } from '../out/api/ssr.js';
import { request } from '../out/net/http.js';

// A. 全部 → SSR 榜单（重复 5 次，覆盖 A/B/C 三种序列化形态）
let ok = 0, fail = 0;
for (let n = 0; n < 5; n++) {
  try {
    const r = await getRankAllList();
    const first = r.book_list[0];
    console.log(`✔ rank-all #${n + 1}: books=${r.book_list.length} total=${r.total_num} first=${first?.bookName}(${first?.bookId})`);
    ok++;
  } catch (e) {
    console.log(`✘ rank-all #${n + 1}: ${e.message.slice(0, 80)}`);
    fail++;
  }
}
console.log(`rank-all: ${ok} ok, ${fail} fail`);

// B. getRankList 空分类（走 SSR 分支）
try {
  const r = await getRankList({ rankListType: 3, categoryId: '', gender: 'male', limit: 20 });
  console.log('✔ getRankList(全部):', r.book_list.length, 'books');
} catch (e) { console.log('✘ getRankList(全部):', e.message.slice(0, 100)); }

// C. 指定分类仍走 API
try {
  const r = await getRankList({ rankListType: 3, categoryId: '1140', gender: 'male', limit: 5 });
  console.log('✔ getRankList(东方仙侠):', r.book_list.length, 'books, first:', r.book_list[0]?.bookName);
} catch (e) { console.log('✘ getRankList(分类):', e.message.slice(0, 100)); }

// D. extractInitialState 直接对 /rank 原始 HTML 测试（多形态）
for (let n = 0; n < 4; n++) {
  const resp = await request('https://fanqienovel.com/rank', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)', Accept: 'text/html' },
  });
  const st = extractInitialState(resp.text);
  const rank = st?.rank;
  console.log(`extract #${n + 1}:`, st ? `OK top=${Object.keys(st).slice(0, 4).join(',')} rankBooks=${rank?.book_list?.length ?? '-'}` : 'null');
}

// E. 其他 SSR 页面回归
const dir = await getDirectory('7576659101376072728');
console.log('✔ directory:', dir.volumes.length, 'vols,', dir.chapterTotal, 'chapters');
const ch = await getChapter('7576659313758831128');
console.log('✔ chapter:', ch.title, 'paras:', ch.paragraphs.length, 'pua:', /[\uE000-\uF8FF]/.test(ch.paragraphs.join('')));
