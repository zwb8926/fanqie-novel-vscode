/**
 * 番茄小说网页版 Web API 封装。
 * 每类数据都提供「API 主路径 + SSR 降级」两层实现。
 */
import { request, requestJson, HttpError, DEFAULT_UA } from '../net/http';
import * as C from './constants';
import {
  fetchBookPageState,
  fetchReaderPageState,
  extractInitialState,
  fetchCommentPageData,
  collectCommentLinks,
  extractFontUrls,
  fetchPage,
} from './ssr';
import { decryptHtmlPua, decryptTextStatic } from './font';

/** 解密可能含 PUA 字体加密的普通文本（书名/作者/摘要/标题等） */
function dec(s: any): string {
  if (typeof s !== 'string' || !s) return String(s ?? '');
  return decryptTextStatic(s);
}

/* ---------------------------------- 类型 ---------------------------------- */

export interface SearchBook {
  book_id: string;
  book_name: string;
  author: string;
  abstract: string;
  thumb_url: string;
  category: string;
  word_number: number;
  serial_count: number;
  creation_status: string;
  last_chapter_title: string;
  last_publish_time: number;
  score: string;
}

export interface ChapterItem {
  itemId: string;
  title: string;
  volume_name?: string;
  realChapterOrder?: string;
  firstPassTime?: string;
  needPay?: number;
}

export interface Volume {
  volume_name: string;
  chapters: ChapterItem[];
}

export interface Directory {
  bookId: string;
  volumes: Volume[];
  allItemIds: string[];
  chapterTotal: number;
}

export interface ChapterData {
  itemId: string;
  bookId: string;
  bookName: string;
  title: string;
  author: string;
  preItemId: string;
  nextItemId: string;
  needPay: number;
  isChapterLock: boolean;
  /** 章节正文（HTML <p> 段落，可能含 PUA 字体加密字符，已尝试解密） */
  content: string;
  paragraphs: string[];
  chapterWordNumber: string;
  realChapterOrder?: string;
  serialCount?: string;
  source: 'api' | 'ssr';
}

export interface BookInfo {
  book_id: string;
  book_name: string;
  author: string;
  abstract: string;
  thumb_url: string;
  creation_status: string;
  word_number: number;
  serial_count: number;
  last_chapter_item_id: string;
  last_chapter_title: string;
  category: string;
  score: string;
  read_count: number;
}

export interface RankCategory {
  id: string;
  name: string;
  group: string[];
}

export interface RankBook {
  bookId: string;
  bookName: string;
  author: string;
  abstract: string;
  thumbUri: string;
  readCount: string;
  currentPos: number;
  rankPosDiff: number;
  lastChapterTitle: string;
}

export interface RankResult {
  book_list: RankBook[];
  total_num: number;
  rankTypeText: string;
}

export interface UserInfo {
  id: string;
  name: string;
  avatar: string;
  desc: string;
  isVip: boolean;
}

export interface BookshelfEntry {
  book_id: string;
  group_name?: string;
  add_shelf_time?: number;
  last_operate_time?: number;
  /** 以下为增强字段（simple/info + multidetail 补充） */
  title?: string;
  author?: string;
  cover_url?: string;
  current_chapter_title?: string;
  last_read_item_id?: string;
  serial_count?: number;
  creation_status?: string;
}

export interface BookComment {
  comment_id: string;
  user_id: string;
  nick_name: string;
  avatar: string;
  text: string;
  create_time: number;
  digg_count: number;
  reply_count: number;
  score: number;
  /** 评论所属书籍（书评可能来自相似书籍推荐位） */
  book_title?: string;
}

/* ------------------------------ 通用请求助手 ------------------------------ */

function webHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Referer: C.HOST + '/',
    Origin: C.HOST,
    Accept: 'application/json, text/plain, */*',
    ...extra,
  };
}

/** 统一业务错误 */
export class ApiError extends Error {
  code: number | string;
  constructor(message: string, code: number | string = -1) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

function checkBiz(j: any, what: string): void {
  if (!j || typeof j !== 'object') throw new ApiError(`${what}：响应异常`);
  if (j.code !== undefined && j.code !== 0) {
    const msg = j.message || `code=${j.code}`;
    throw new ApiError(`${what}失败：${msg}`, j.code);
  }
}

/* ---------------------------------- 搜索 ---------------------------------- */

export async function searchBooks(query: string, page = 0, pageSize = 10): Promise<{ books: SearchBook[]; total: number }> {
  const q = new URLSearchParams({
    query_word: query,
    page_index: String(page),
    page_count: String(pageSize),
    filter: '127,121,127',
    rank_type: '0',
    query_type: '0',
  });
  const j = await requestJson<any>(`${C.HOST}${C.SEARCH}?${q.toString()}`, {
    headers: webHeaders(),
    timeoutMs: 20000,
  });
  checkBiz(j, '搜索');
  const list: any[] = j.data?.search_book_data_list ?? [];
  const books = list.map((b: any) => ({
    book_id: String(b.book_id ?? ''),
    book_name: dec(b.book_name ?? b.original_book_name ?? ''),
    author: dec(b.author ?? ''),
    abstract: dec(b.abstract ?? ''),
    thumb_url: b.thumb_url ?? b.audio_thumb_url_hd ?? '',
    category: dec(b.category ?? ''),
    word_number: Number(b.word_number ?? 0),
    serial_count: Number(b.serial_count ?? 0),
    creation_status: String(b.creation_status ?? ''),
    last_chapter_title: dec(b.last_chapter_title ?? ''),
    last_publish_time: Number(b.last_publish_time ?? 0) * 1000,
    score: Number(b.score ?? 0) > 0 ? String(b.score) : '',
  }));
  return { books, total: Number(j.data?.total_count ?? books.length) };
}

/* -------------------------------- 书籍详情 -------------------------------- */

export async function getBookDetail(bookId: string): Promise<BookInfo> {
  try {
    const j = await requestJson<any>(`${C.HOST}${C.BOOK_DETAIL}?bookId=${encodeURIComponent(bookId)}`, {
      headers: webHeaders(),
    });
    checkBiz(j, '获取书籍详情');
    const d = j.data;
    if (!d) throw new ApiError('书籍详情为空');
    return {
      book_id: String(d.book_id ?? bookId),
      book_name: dec(d.book_name ?? ''),
      author: dec(d.author ?? ''),
      abstract: dec(d.abstract ?? ''),
      thumb_url: d.thumb_url ?? d.thumbUri ?? '',
      creation_status: String(d.creation_status ?? ''),
      word_number: Number(d.word_number ?? 0),
      serial_count: Number(d.serial_count ?? d.chapter_count ?? 0),
      last_chapter_item_id: String(d.last_chapter_item_id ?? ''),
      last_chapter_title: dec(d.last_chapter_title ?? ''),
      category: dec(d.category ?? ''),
      score: String(d.score ?? ''),
      read_count: Number(d.read_count ?? 0),
    };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // 降级：SSR 书籍页
    const p = await fetchBookPageState(bookId);
    if (!p) throw new ApiError('获取书籍详情失败（接口与网页均不可用）');
    return {
      book_id: String(p.bookId ?? bookId),
      book_name: dec(p.bookName ?? ''),
      author: dec(p.author ?? ''),
      abstract: dec(p.abstract ?? ''),
      thumb_url: p.thumbUri ?? '',
      creation_status: String(p.creationStatus ?? ''),
      word_number: Number(p.wordNumber ?? 0),
      serial_count: Number(p.chapterTotal ?? 0),
      last_chapter_item_id: String(p.lastChapterItemId ?? ''),
      last_chapter_title: dec(p.lastChapterTitle ?? ''),
      category: dec(p.category ?? ''),
      score: '',
      read_count: Number(p.readCount ?? 0),
    };
  }
}

/* ---------------------------------- 目录 ---------------------------------- */

export async function getDirectory(bookId: string): Promise<Directory> {
  try {
    const j = await requestJson<any>(
      `${C.HOST}${C.DIRECTORY}?bookId=${encodeURIComponent(bookId)}&enter_from=0`,
      { headers: webHeaders() }
    );
    checkBiz(j, '获取目录');
    return normalizeDirectory(j.data, bookId);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // 降级：SSR 书籍页
    const p = await fetchBookPageState(bookId);
    if (!p) throw new ApiError('获取目录失败（接口与网页均不可用）');
    const volumes: Volume[] = (p.chapterListWithVolume ?? []).map((v: any) => ({
      volume_name: v.volume_name ?? v.name ?? '',
      chapters: (v.chapterList ?? []).map((c: any) => ({
        itemId: String(c.itemId ?? ''),
        title: dec(c.title ?? ''),
        volume_name: v.volume_name ?? '',
        realChapterOrder: String(c.realChapterOrder ?? ''),
        firstPassTime: String(c.firstPassTime ?? ''),
        needPay: Number(c.needPay ?? 0),
      })),
    }));
    return {
      bookId,
      volumes,
      allItemIds: (p.itemIds ?? []).map(String),
      chapterTotal: Number(p.chapterTotal ?? volumes.reduce((s, v) => s + v.chapters.length, 0)),
    };
  }
}

function normalizeDirectory(d: any, bookId: string): Directory {
  if (!d) throw new ApiError('目录数据为空');
  const volumes: Volume[] = [];
  const withVol = Array.isArray(d.chapterListWithVolume) ? d.chapterListWithVolume : [];
  const volNames: string[] = Array.isArray(d.volumeNameList) ? d.volumeNameList.map(String) : [];
  if (withVol.length) {
    const first = withVol[0];
    if (Array.isArray(first)) {
      // 结构：数组的数组，每卷一个章节数组（卷名在 volumeNameList 或章节的 volume_name）
      withVol.forEach((volChapters: any[], i: number) => {
        if (!Array.isArray(volChapters) || !volChapters.length) return;
        const name = volNames[i] ?? String(volChapters[0]?.volume_name ?? '') ?? '';
        volumes.push({
          volume_name: dec(name),
          chapters: volChapters.map((c: any) => ({
            itemId: String(c.itemId ?? c.item_id ?? ''),
            title: dec(c.title ?? ''),
            volume_name: dec(name),
            realChapterOrder: String(c.realChapterOrder ?? ''),
            firstPassTime: String(c.firstPassTime ?? ''),
            needPay: Number(c.needPay ?? 0),
          })),
        });
      });
    } else if (first && first.itemId !== undefined) {
      // 扁平章节数组：每个元素带 volume_name，按卷分组
      const byVol = new Map<string, ChapterItem[]>();
      for (const c of withVol) {
        const name = String(c.volume_name ?? '');
        if (!byVol.has(name)) byVol.set(name, []);
        byVol.get(name)!.push({
          itemId: String(c.itemId ?? ''),
          title: dec(c.title ?? ''),
          volume_name: dec(name),
          realChapterOrder: String(c.realChapterOrder ?? ''),
          firstPassTime: String(c.firstPassTime ?? ''),
          needPay: Number(c.needPay ?? 0),
        });
      }
      for (const [name, chapters] of byVol) {
        volumes.push({ volume_name: dec(name), chapters });
      }
    } else {
      for (const v of withVol) {
        const name = v.volume_name ?? v.name ?? '';
        const chapters: ChapterItem[] = Array.isArray(v.chapterList) || Array.isArray(v.chapter_list)
          ? (v.chapterList ?? v.chapter_list).map((c: any) => ({
              itemId: String(c.itemId ?? c.item_id ?? ''),
              title: dec(c.title ?? ''),
              volume_name: dec(name),
              realChapterOrder: String(c.realChapterOrder ?? ''),
              firstPassTime: String(c.firstPassTime ?? ''),
              needPay: Number(c.needPay ?? 0),
            }))
          : [];
        if (chapters.length) volumes.push({ volume_name: dec(name), chapters });
      }
    }
  }
  if (!volumes.length) {
    const flat = Array.isArray(d.chapterList) ? d.chapterList : [];
    volumes.push({
      volume_name: '',
      chapters: flat.map((c: any) => ({
        itemId: String(c.itemId ?? c.item_id ?? ''),
        title: dec(c.title ?? ''),
        realChapterOrder: String(c.realChapterOrder ?? ''),
        firstPassTime: String(c.firstPassTime ?? ''),
        needPay: Number(c.needPay ?? 0),
      })),
    });
  }
  const all = Array.isArray(d.allItemIds) ? d.allItemIds.map(String) : [];
  return {
    bookId,
    volumes,
    allItemIds: all,
    chapterTotal: Number(d.chapterTotal ?? all.length),
  };
}

/* ---------------------------------- 章节 ---------------------------------- */

/** 把正文 HTML 拆成段落数组，并做 PUA 字体解密 */
export function htmlToParagraphs(content: string): string[] {
  if (!content) return [];
  const withoutTags = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<em>/gi, '');
  const paras = withoutTags
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean);
  return paras.length ? paras : [withoutTags.trim()].filter(Boolean);
}

export async function getChapter(itemId: string): Promise<ChapterData> {
  try {
    const resp = await request(`${C.HOST}${C.CHAPTER}?itemId=${encodeURIComponent(itemId)}`, {
      headers: webHeaders({ ismobile: '0' }),
      timeoutMs: 20000,
    });
    if (!resp.text) throw new HttpError('章节接口返回空（风控）', resp.status, resp.url, '');
    const j = JSON.parse(resp.text);
    checkBiz(j, '获取章节');
    const d = j.data?.chapterData ?? j.data;
    if (!d?.content) throw new ApiError('章节数据为空');
    return normalizeChapter(d, itemId, 'api');
  } catch (e) {
    // 降级：SSR 阅读页（内容为 PUA 字体加密，需解密）
    const p = await fetchReaderPageState(itemId);
    if (!p) throw new ApiError('获取章节失败（接口与网页均不可用）');
    return normalizeChapter(p, itemId, 'ssr');
  }
}

async function normalizeChapter(d: any, itemId: string, source: 'api' | 'ssr'): Promise<ChapterData> {
  let content: string = d.content ?? '';
  const paragraphs = htmlToParagraphs(content);
  // 若存在 PUA 字体加密字符，则解密（优先用页面字体做动态映射）
  const hasPua = /[\uE000-\uF8FF]/.test(content);
  if (hasPua) {
    try {
      const fontUrl = d._html ? extractFontUrls(d._html)[0] : undefined;
      const decrypted = await decryptHtmlPua(content, fontUrl);
      if (decrypted !== content) {
        return {
          itemId: String(d.itemId ?? itemId),
          bookId: String(d.bookId ?? d.book_id ?? ''),
          bookName: dec(d.bookName ?? d.book_name ?? ''),
          title: dec(d.title ?? ''),
          author: dec(d.author ?? ''),
          preItemId: String(d.preItemId ?? d.pre_item_id ?? ''),
          nextItemId: String(d.nextItemId ?? d.next_item_id ?? ''),
          needPay: Number(d.needPay ?? 0),
          isChapterLock: Boolean(d.isChapterLock ?? false),
          content: decrypted,
          paragraphs: htmlToParagraphs(decrypted),
          chapterWordNumber: String(d.chapterWordNumber ?? d.chapter_word_number ?? ''),
          realChapterOrder: String(d.realChapterOrder ?? d.order ?? ''),
          serialCount: String(d.serialCount ?? d.serial_count ?? ''),
          source,
        };
      }
    } catch {
      // 解密失败则保留原文
    }
  }
  return {
    itemId: String(d.itemId ?? itemId),
    bookId: String(d.bookId ?? d.book_id ?? ''),
    bookName: dec(d.bookName ?? d.book_name ?? ''),
    title: dec(d.title ?? ''),
    author: dec(d.author ?? ''),
    preItemId: String(d.preItemId ?? d.pre_item_id ?? ''),
    nextItemId: String(d.nextItemId ?? d.next_item_id ?? ''),
    needPay: Number(d.needPay ?? 0),
    isChapterLock: Boolean(d.isChapterLock ?? false),
    content,
    paragraphs,
    chapterWordNumber: String(d.chapterWordNumber ?? d.chapter_word_number ?? ''),
    realChapterOrder: String(d.realChapterOrder ?? d.order ?? ''),
    serialCount: String(d.serialCount ?? d.serial_count ?? ''),
    source,
  };
}

/* ---------------------------------- 书城 ---------------------------------- */

export async function getRankCategories(): Promise<RankCategory[]> {
  const j = await requestJson<any>(
    `${C.HOST}${C.CONFIG_LIST}?config_key=${encodeURIComponent('serial_rank_category_list_common')}`,
    { headers: webHeaders() }
  );
  checkBiz(j, '获取排行分类');
  const list: any[] = j.data?.list ?? [];
  return list.map((c: any) => ({
    id: String(c.id ?? ''),
    name: c.name ?? '',
    group: Array.isArray(c.group) ? c.group.map(String) : [],
  }));
}

export async function getRankList(opts: {
  rankListType?: number;
  categoryId?: string;
  gender?: string;
  offset?: number;
  limit?: number;
}): Promise<RankResult> {
  const { rankListType = 3, categoryId = '', gender = '', offset = 0, limit = 20 } = opts;

  // 「全部」分类：接口的 category_id 不支持空值（返回分类类型错误），
  // 改走官网 /rank 页的服务端渲染数据（始终可用）
  if (!categoryId) {
    return getRankAllList();
  }

  const q = new URLSearchParams({
    app_id: C.RANK_APP_ID,
    rank_list_type: String(rankListType),
    offset: String(offset),
    limit: String(limit),
    category_id: categoryId,
    rank_version: '',
    gender,
    rankMold: '',
  });
  const j = await requestJson<any>(`${C.HOST}${C.RANK_LIST}?${q.toString()}`, { headers: webHeaders() });
  checkBiz(j, '获取排行榜');
  const list: any[] = j.data?.book_list ?? [];
  return {
    book_list: list.map(normalizeRankBook),
    total_num: Number(j.data?.total_num ?? list.length),
    rankTypeText: j.data?.rankTypeText ?? '',
  };
}

/** 「全部」排行：读取 /rank 页 SSR 状态中的服务端渲染榜单 */
export async function getRankAllList(): Promise<RankResult> {
  const r = await fetchPage(`${C.HOST}/rank`);
  const rank = r?.state?.rank;
  const list: any[] = Array.isArray(rank?.book_list) ? rank.book_list : [];
  return {
    book_list: list.map(normalizeRankBook),
    total_num: Number(rank?.total_num ?? list.length),
    rankTypeText: rank?.rankTypeText ?? '',
  };
}

function normalizeRankBook(b: any): RankBook {
  return {
    bookId: String(b.bookId ?? b.book_id ?? ''),
    bookName: dec(b.bookName ?? b.book_name ?? ''),
    author: dec(b.author ?? ''),
    abstract: dec(b.abstract ?? ''),
    thumbUri: b.thumbUri ?? b.thumb_url ?? '',
    readCount: String(b.readCount ?? b.read_count ?? ''),
    currentPos: Number(b.currentPos ?? 0),
    rankPosDiff: Number(b.rankPosDiff ?? 0),
    lastChapterTitle: dec(b.lastChapterTitle ?? ''),
  };
}

export async function getEditorList(): Promise<any[]> {
  const j = await requestJson<any>(`${C.HOST}${C.EDITOR_LIST}`, { headers: webHeaders() });
  checkBiz(j, '获取编辑精选');
  return j.data?.list ?? [];
}

/* ---------------------------------- 用户 ---------------------------------- */

export async function getUserInfo(): Promise<UserInfo | null> {
  try {
    const j = await requestJson<any>(`${C.HOST}${C.USER_INFO}`, { headers: webHeaders() });
    const d = j?.data;
    if (d && Number(d.id) > 1) {
      return {
        id: String(d.id),
        name: d.name ?? '',
        avatar: d.avatar ?? '',
        desc: d.desc ?? '',
        isVip: Boolean(d.isVip),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/* ---------------------------------- 书架 ---------------------------------- */

export async function getRemoteBookshelf(): Promise<BookshelfEntry[]> {
  const q = new URLSearchParams(C.appQuery({ iid: '0' }));
  const j = await requestJson<any>(`${C.HOST}${C.BOOKSHELF_BASE}/info/v:version/?${q.toString()}`, {
    headers: webHeaders(),
  });
  if (j.code !== 0) throw new ApiError(j.message ?? '获取书架失败', j.code);
  const list: any[] = j.data?.book_shelf_info ?? [];
  const entries: BookshelfEntry[] = list.map((b: any) => ({
    book_id: String(b.book_id ?? ''),
    group_name: b.group_name ?? '',
    add_shelf_time: Number(b.add_shelf_time ?? 0),
    last_operate_time: Number(b.last_operate_time ?? 0),
  }));
  if (!entries.length) return entries;

  // 0) 阅读进度（multidetail 需要真实的 item_id 才能返回当前章节）
  const progressMap = new Map<string, string>();
  try {
    const p = await requestJson<any>(`${C.HOST}${C.READ_PROGRESS}`, { headers: webHeaders() });
    if (p.code === 0 && Array.isArray(p.data)) {
      for (const x of p.data) {
        if (x.book_id) progressMap.set(String(x.book_id), String(x.item_id ?? ''));
      }
    }
  } catch {
    /* 可选步骤 */
  }
  for (const e of entries) {
    e.last_read_item_id = progressMap.get(e.book_id) ?? '';
  }

  // 1) 简单信息：书名/作者/封面（官网同款接口）
  try {
    const s = await requestJson<any>(`${C.HOST}/api/book/simple/info`, {
      method: 'POST',
      headers: webHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ book_ids: entries.map(e => e.book_id) }),
    });
    const bookList: any[] = s.data?.bookList ?? [];
    for (const e of entries) {
      const b = bookList.find((x: any) => String(x.book_id) === e.book_id);
      if (b) {
        e.title = dec(b.book_name ?? '');
        e.author = dec(b.author_name ?? '');
        e.cover_url = b.thumb_url ?? '';
        e.serial_count = Number(b.serial_count ?? 0);
        e.creation_status = String(b.creation_status ?? '');
      }
    }
  } catch {
    /* 可选步骤，失败不影响条目 */
  }

  // 2) 书架详情：阅读进度/当前章节（官网同款接口）
  try {
    const m = await requestJson<any>(`${C.HOST}/api/bookshelf/multidetail`, {
      method: 'POST',
      headers: webHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        books: entries.map(e => ({ book_id: e.book_id, item_id: e.last_read_item_id ?? '0' })),
      }),
    });
    const detailList: any[] = m.data?.detail_list ?? [];
    for (const e of entries) {
      const d = detailList.find((x: any) => String(x.book_id) === e.book_id);
      if (d) {
        e.title = dec(d.book_name ?? e.title ?? '');
        e.author = dec(d.author_name ?? e.author ?? '');
        e.cover_url = d.thumb_url ?? e.cover_url ?? '';
        e.current_chapter_title = dec(d.item_show_title ?? '');
        e.last_read_item_id = String(d.item_id ?? e.last_read_item_id ?? '');
        e.serial_count = Number(d.serial_count ?? e.serial_count ?? 0);
        e.creation_status = String(d.creation_status ?? e.creation_status ?? '');
      }
    }
  } catch {
    /* 可选步骤 */
  }
  return entries;
}

export async function addToRemoteBookshelf(bookId: string): Promise<void> {
  const j = await requestJson<any>(`${C.HOST}${C.BOOKSHELF_BASE}/add/v?aid=1967`, {
    method: 'POST',
    headers: webHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      add_book_source: 0,
      identify_data: [{ asterisked: false, book_id: bookId, book_type: 0, modify_time: Date.now() }],
    }),
  });
  if (j.code !== 0 && j.code !== undefined) throw new ApiError(j.message ?? '加入书架失败', j.code);
}

export async function removeFromRemoteBookshelf(bookId: string): Promise<void> {
  const j = await requestJson<any>(`${C.HOST}${C.BOOKSHELF_BASE}/delete/v?aid=1967`, {
    method: 'POST',
    headers: webHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      identify_data: [{ asterisked: false, book_id: bookId, book_type: 0, modify_time: Date.now() }],
    }),
  });
  if (j.code !== 0 && j.code !== undefined) throw new ApiError(j.message ?? '移出书架失败', j.code);
}

export async function getReadProgress(): Promise<Array<{ book_id: string; item_id: string; read_timestamp: number }>> {
  try {
    const j = await requestJson<any>(`${C.HOST}${C.READ_PROGRESS}`, { headers: webHeaders() });
    if (j.code !== 0) return [];
    const list: any[] = Array.isArray(j.data) ? j.data : [];
    return list.map((p: any) => ({
      book_id: String(p.book_id ?? ''),
      item_id: String(p.item_id ?? ''),
      read_timestamp: Number(p.read_timestamp ?? 0),
    }));
  } catch {
    return [];
  }
}

/** 上报阅读进度（官网同款参数：read_progress/index/genre_type，失败静默） */
export async function updateReadProgress(bookId: string, itemId: string, order = 0): Promise<void> {
  try {
    await request(`${C.HOST}${C.UPDATE_PROGRESS}`, {
      method: 'POST',
      headers: webHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        book_id: bookId,
        item_id: itemId,
        read_progress: Number(order || 0),
        index: Number(order || 0),
        read_timestamp: Math.floor(Date.now() / 1000),
        genre_type: 0,
      }),
      timeoutMs: 8000,
    });
  } catch {
    /* ignore */
  }
}

/* ---------------------------------- 书评 ---------------------------------- */

/** 从书籍页 HTML 收集 SEO 评论链接 */
export async function collectBookCommentLinks(bookId: string): Promise<Array<{ bookId: string; commentId: string }>> {
  const page = await fetchBookPageState(bookId, true);
  if (!page) return [];
  return collectCommentLinks(page.html);
}

/** 获取单条书评详情（SEO 评论页 SSR，无需登录） */
export async function getBookComment(bookId: string, commentId: string): Promise<BookComment | null> {
  const data = await fetchCommentPageData(bookId, commentId);
  if (!data) return null;
  const c = data.comments?.[0];
  if (!c) return null;
  return {
    comment_id: String(c.info?.comment_id ?? commentId),
    user_id: String(c.user?.user_id ?? c.info?.user_id ?? ''),
    nick_name: dec(c.user?.nick_name ?? '匿名'),
    avatar: c.user?.avatar ?? '',
    text: dec(c.info?.text ?? ''),
    create_time: Number(c.info?.create_time ?? 0) * 1000,
    digg_count: Number(c.info?.digg_count ?? 0),
    reply_count: Number(c.info?.reply_count ?? 0),
    score: Number(c.info?.score ?? 0),
    book_title: dec(data.novel?.title ?? ''),
  };
}

/* ------------------------------ 章评/段评（APP 接口，尽力而为） ------------------------------ */

/**
 * 章评：番茄 APP 的章节评论接口（web 端未暴露章评列表）。
 * 走红烛/APP 同源接口族，需携带设备参数；不同网络环境可达性不同。
 */
export async function getChapterComments(
  bookId: string,
  itemId: string,
  page = 0,
  pageSize = 20
): Promise<{ comments: BookComment[]; total: number }> {
  const dev = await import('../net/store').then(m => m.getDevice());
  const q = new URLSearchParams({
    book_id: bookId,
    item_id: itemId,
    page_index: String(page),
    page_size: String(pageSize),
    sort_type: '1',
    aid: '1967',
    app_name: 'novelapp',
    device_platform: 'android',
    device_id: dev.deviceId,
    iid: dev.installId,
  });
  const candidates = [
    `https://reading.snssdk.com/reading/comment/list/v?${q.toString()}`,
    `https://reading.snssdk.com/reading/comment/list_comment/v?${q.toString()}`,
    `https://api5-normal-sinfonlineb.fqnovel.com/reading/comment/list/v?${q.toString()}`,
    `https://api5-sinfonlinec.jxbhmy.com/reading/comment/list/v?${q.toString()}`,
  ];
  let lastErr: Error | null = null;
  for (const url of candidates) {
    try {
      const j = await requestJson<any>(url, {
        headers: { 'User-Agent': 'com.dragon.read', Referer: C.HOST + '/', Accept: 'application/json' },
        timeoutMs: 12000,
      });
      const list = extractComments(j);
      if (list.length || j.code === 0) {
        return { comments: list, total: Number(j.data?.total ?? list.length) };
      }
      lastErr = new ApiError(j.message ?? '空评论', j.code);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw new ApiError(
    `章评接口暂不可用（${lastErr?.message ?? '未知错误'}）。网页端未开放章评，可在番茄小说 App 内查看本章评论。`
  );
}

/**
 * 段评：按段落索引获取该段落的评论（App 专属功能）。
 */
export async function getParagraphComments(
  bookId: string,
  itemId: string,
  paragraphIndex: number
): Promise<BookComment[]> {
  const dev = await import('../net/store').then(m => m.getDevice());
  const q = new URLSearchParams({
    book_id: bookId,
    item_id: itemId,
    paragraph_index: String(paragraphIndex),
    aid: '1967',
    app_name: 'novelapp',
    device_platform: 'android',
    device_id: dev.deviceId,
    iid: dev.installId,
  });
  const candidates = [
    `https://reading.snssdk.com/reading/comment/paragraph/list/v?${q.toString()}`,
    `https://reading.snssdk.com/reading/comment/paragraph_comment/v?${q.toString()}`,
    `https://api5-normal-sinfonlineb.fqnovel.com/reading/comment/paragraph/list/v?${q.toString()}`,
  ];
  let lastErr: Error | null = null;
  for (const url of candidates) {
    try {
      const j = await requestJson<any>(url, {
        headers: { 'User-Agent': 'com.dragon.read', Referer: C.HOST + '/', Accept: 'application/json' },
        timeoutMs: 12000,
      });
      const list = extractComments(j);
      if (list.length || j.code === 0) return list;
      lastErr = new ApiError(j.message ?? '空评论', j.code);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw new ApiError(
    `段评接口暂不可用（${lastErr?.message ?? '未知错误'}）。段评为番茄小说 App 专属功能，网页端未开放。`
  );
}

function extractComments(j: any): BookComment[] {
  try {
    const data = j?.data;
    const list = Array.isArray(data) ? data : data?.comment_list ?? data?.comments ?? [];
    return list
      .map((c: any) => {
        const info = c?.info ?? c;
        const user = c?.user ?? {};
        return {
          comment_id: String(info?.comment_id ?? c?.comment_id ?? ''),
          user_id: String(user?.user_id ?? info?.user_id ?? ''),
          nick_name: dec(user?.nick_name ?? user?.user_name ?? '匿名'),
          avatar: user?.avatar ?? '',
          text: dec(info?.text ?? c?.text ?? ''),
          create_time: Number(info?.create_time ?? 0) * 1000,
          digg_count: Number(info?.digg_count ?? 0),
          reply_count: Number(info?.reply_count ?? 0),
          score: Number(info?.score ?? 0),
        };
      })
      .filter((c: BookComment) => c.comment_id);
  } catch {
    return [];
  }
}

/* ---------------------------------- 杂项 ---------------------------------- */

export function fmtTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtWord(n: number): string {
  if (!n) return '';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万字';
  return n + '字';
}

export { extractInitialState };
export const ssrUserAgent = DEFAULT_UA;
