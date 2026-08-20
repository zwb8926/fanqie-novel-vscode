// Smoke test the compiled extension core modules against live fanqienovel endpoints.
import { getDirectory, getRankList, getRankCategories, getBookDetail, getChapter, searchBooks, getUserInfo, collectBookCommentLinks, getBookComment } from '../out/api/fanqie.js';
import { fetchBookPageState, fetchReaderPageState, extractInitialState } from '../out/api/ssr.js';
import { decryptHtmlPua } from '../out/api/font.js';

const BOOK = '7576659101376072728';
const CH = '7576659313758831128';

async function step(name, fn) {
  try {
    const r = await fn();
    console.log(`✔ ${name}`);
    return r;
  } catch (e) {
    console.log(`✘ ${name}: ${e.message}`);
    return null;
  }
}

// 1. directory (web API)
const dir = await step('directory API', () => getDirectory(BOOK));
if (dir) console.log('   volumes:', dir.volumes.length, 'chapters:', dir.chapters ? dir.volumes.reduce((s, v) => s + v.chapters.length, 0) : 'n/a', 'total:', dir.chapterTotal, 'first:', dir.volumes[0]?.chapters[0]?.title);

// 2. rank categories + list
const cats = await step('rank categories', () => getRankCategories());
if (cats) console.log('   cats:', cats.length, 'sample:', JSON.stringify(cats.slice(0, 3)));
const rank = await step('rank list', () => getRankList({ rankListType: 3, categoryId: '1140', gender: 'male', limit: 5 }));
if (rank) console.log('   books:', rank.book_list.length, 'first:', rank.book_list[0]?.bookName, rank.book_list[0]?.bookId);

// 3. book detail (expect SSR fallback from datacenter IP)
const detail = await step('book detail', () => getBookDetail(BOOK));
if (detail) console.log('   name:', detail.book_name, 'author:', detail.author, 'chapters:', detail.serial_count);

// 4. chapter (API likely empty from this IP -> SSR fallback + font decrypt)
const ch = await step('chapter (api->ssr fallback)', () => getChapter(CH));
if (ch) {
  console.log('   title:', ch.title, 'source:', ch.source, 'paras:', ch.paragraphs.length);
  console.log('   first para:', (ch.paragraphs[0] || '').slice(0, 60));
  const hasPua = /[\uE000-\uF8FF]/.test(ch.paragraphs.join(''));
  console.log('   remaining PUA chars:', hasPua);
}

// 5. search (may be WAF-empty from this IP)
const s = await step('search', () => searchBooks('灵根', 0, 5));
if (s) console.log('   results:', s.books.length, s.books[0]?.book_name);

// 6. user info (not logged in)
const u = await step('user info', () => getUserInfo());
console.log('   user:', u);

// 7. SSR comment links + first comment
const links = await step('book comment links', () => collectBookCommentLinks('7405108467217746969'));
if (links) {
  console.log('   links:', links.length, 'first:', JSON.stringify(links[0]));
  const c = await step('comment detail', () => getBookComment(links[0].bookId, links[0].commentId));
  if (c) console.log('   comment:', c.nick_name, '|', c.text.slice(0, 50), '| score', c.score);
}
