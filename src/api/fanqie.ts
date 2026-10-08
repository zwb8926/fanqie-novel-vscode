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
  /** 数据来源：app=App 网关详情接口，web=旧网页详情接口，ssr=SEO 页面降级 */
  source?: 'app' | 'web' | 'ssr';
  /** 非签名封面地址（可长期缓存/存书架；接口给的 thumb_url 是带过期时间的签名地址） */
  thumb_source_url?: string;
  /* 以下为 App 详情接口（/api/book/info）独有的增强字段 */
  author_id?: string;
  author_avatar?: string;
  author_desc?: string;
  /** 完整分类路径，如「女生/古代言情/宫闱宅斗」 */
  complete_category?: string;
  last_publish_time?: number;
  /** 0 未关注 / 1 已关注 */
  follow_status?: number;
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

/** 一页书评（App 网关可翻页；SSR 降级只有首页） */
export interface BookCommentPage {
  comments: BookComment[];
  /** 该书评论文总数 */
  total: number;
  hasMore: boolean;
  /** 当前页码，从 1 开始 */
  page: number;
  /** 评分均值（来自评分接口，失败时为空） */
  averageScore?: string;
  scoreCount?: number;
  source: 'ssdk' | 'ssr';
}

/** 书籍评分概览 */
export interface BookScore {
  /** 平均分，如 "8.5"；无评分时为空串 */
  average_score: string;
  score_count: number;
  /** 各星级人数分布 */
  rank: number[];
  my_score: number;
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

/**
 * App/H5 网关（novel.snssdk.com）请求助手。
 * 该网关的坑：公共参数（aid/app_name/...）缺失时**不报错码**，而是返回
 * `{"code":0,"data":null,"message":"invalid client"}`，所以这里额外校验 data 是否存在。
 */
async function ssdkJson<T = any>(path: string, params: Record<string, string>, what: string): Promise<T> {
  const q = new URLSearchParams(C.ssdkQuery(params));
  const j = await requestJson<any>(`${C.SSDK_HOST}${path}?${q.toString()}`, {
    headers: {
      Referer: C.SSDK_REFERER,
      Accept: 'application/json, text/plain, */*',
    },
    timeoutMs: 20000,
  });
  if (!j || typeof j !== 'object') throw new ApiError(`${what}：响应异常`);
  if (j.code !== undefined && j.code !== 0) throw new ApiError(`${what}失败：${j.message || `code=${j.code}`}`, j.code);
  if (j.data === null || j.data === undefined) throw new ApiError(`${what}失败：${j.message || '空数据'}`, j.code ?? -1);
  return j.data as T;
}

/* ---------------------------------- 搜索 ---------------------------------- */

/** 归一化书籍对象：网页端（book_name/thumb_url）与 App 网关（title）字段名不同，统一在这里兼容 */
function normalizeSearchBook(b: any): SearchBook {
  return {
    book_id: String(b.book_id ?? ''),
    book_name: dec(b.book_name ?? b.title ?? b.original_book_name ?? ''),
    author: dec(b.author ?? ''),
    abstract: dec(b.abstract ?? ''),
    thumb_url: b.thumb_url ?? b.audio_thumb_url_hd ?? b.audio_thumb_uri ?? b.thumb_url_hd ?? '',
    category: dec(b.category ?? ''),
    word_number: Number(b.word_number ?? 0),
    serial_count: Number(b.serial_count ?? 0),
    creation_status: String(b.creation_status ?? ''),
    last_chapter_title: dec(b.last_chapter_title ?? ''),
    last_publish_time: Number(b.last_publish_time ?? 0) * 1000,
    score: Number(b.score ?? 0) > 0 ? String(b.score) : '',
  };
}

/** 网页端搜索接口（机房 IP 下会被风控返回空响应，所以外面还有 App 网关兜底） */
async function searchBooksWeb(
  query: string,
  page: number,
  pageSize: number
): Promise<{ books: SearchBook[]; total: number }> {
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
  const books = list.map(normalizeSearchBook);
  return { books, total: Number(j.data?.total_count ?? books.length) };
}

/**
 * App/H5 网关搜索（参数名是 q，翻页用 offset）。
 * 注意两点（实测）：
 *  - count 被忽略，固定每页 10 条 → offset 按 SSDK_SEARCH_PAGE_SIZE 步进；
 *  - 相邻两页有 1 条重叠 → 调用方按 book_id 去重。
 */
async function searchBooksSsdk(
  query: string,
  page: number,
  pageSize: number
): Promise<{ books: SearchBook[]; total: number }> {
  const size = C.SSDK_SEARCH_PAGE_SIZE;
  const offset = Math.max(page, 0) * size;
  const d = await ssdkJson<any>(
    C.SSDK_SEARCH,
    { q: query, count: String(pageSize), offset: String(offset) },
    '搜索'
  );
  const list: any[] = Array.isArray(d.ret_data) ? d.ret_data : [];
  const books = list.map(normalizeSearchBook);
  const nextOffset = Number(d.offset ?? offset + size);
  const hasMore = Boolean(d.has_more);
  // 前端用「已加载条数 < total」决定要不要显示「加载更多」，
  // 所以有下一页时 total 要给的比已加载量大（取下一页起点 + 一页）
  const total = hasMore ? nextOffset + size : Math.max(nextOffset, books.length);
  return { books, total };
}

export async function searchBooks(
  query: string,
  page = 0,
  pageSize = 10
): Promise<{ books: SearchBook[]; total: number }> {
  const q = String(query ?? '').trim();
  if (!q) return { books: [], total: 0 };

  let webError: unknown = null;
  try {
    const r = await searchBooksWeb(q, page, pageSize);
    // 首页有结果就直接用；首页为空（可能是风控，也可能是真没结果）再走兜底
    if (r.books.length || page > 0) return r;
  } catch (e) {
    webError = e;
  }

  try {
    return await searchBooksSsdk(q, page, pageSize);
  } catch (e) {
    if (webError) throw webError;
    throw e;
  }
}

/* -------------------------------- 书籍详情 -------------------------------- */

/**
 * 书籍详情（App 网关同源接口 /api/book/info）。
 * 相比旧的 /api/reader/full/book/detail：字段更全（作者 id/头像/简介、完整分类路径、
 * 更新时间、关注状态），且实测在机房 IP 下依然可用（旧接口会被风控返回空响应）。
 */
export async function getBookInfo(bookId: string): Promise<BookInfo> {
  const j = await requestJson<any>(`${C.HOST}${C.BOOK_INFO}?bookId=${encodeURIComponent(bookId)}`, {
    headers: webHeaders(),
  });
  checkBiz(j, '获取书籍详情');
  const d = j.data;
  if (!d) throw new ApiError('书籍详情为空');
  return {
    book_id: String(d.bookId ?? bookId),
    book_name: dec(d.bookName ?? d.book_name ?? ''),
    author: dec(d.author ?? d.authorName ?? ''),
    abstract: dec(d.abstract ?? ''),
    thumb_url: d.thumbUrl ?? d.thumbUri ?? '',
    creation_status: String(d.creationStatus ?? ''),
    word_number: Number(d.wordNumber ?? 0),
    serial_count: Number(d.serialCount ?? d.chapterCount ?? 0),
    last_chapter_item_id: String(d.lastChapterItemId ?? ''),
    last_chapter_title: dec(d.lastChapterTitle ?? ''),
    category: dec(d.category ?? d.completeCategory ?? ''),
    score: '',
    read_count: Number(d.readCount ?? 0),
    source: 'app',
    author_id: String(d.authorId ?? ''),
    author_avatar: d.avatarUri ?? '',
    author_desc: dec(d.description ?? ''),
    complete_category: dec(d.completeCategory ?? ''),
    last_publish_time: Number(d.lastPublishTime ?? 0) * 1000,
    follow_status: Number(d.followStatus ?? 0),
    thumb_source_url: C.coverUrlFromPath(d.sourceUri),
  };
}

/** 旧网页详情接口（机房 IP 下会被风控，保留作为第二层） */
async function getBookDetailWeb(bookId: string): Promise<BookInfo> {
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
    source: 'web',
  };
}

/**
 * 章节总数：走轻量目录接口（只回 itemId 数组，约 20KB，比目录详情小一个数量级）。
 * 新的详情接口不带章节总数，用它补。
 */
export async function getChapterCount(bookId: string): Promise<number> {
  try {
    const j = await requestJson<any>(`${C.HOST}${C.DIRECTORY_IID}?bookId=${encodeURIComponent(bookId)}`, {
      headers: webHeaders(),
    });
    if (j?.code !== 0 || !Array.isArray(j.data)) return 0;
    return j.data.length;
  } catch {
    return 0;
  }
}

/** 并行为详情补「评分 + 章节总数」（都是可选增强，任一失败都不影响详情） */
async function attachExtras(info: BookInfo): Promise<void> {
  const jobs: Array<Promise<void>> = [];
  if (!info.score) {
    jobs.push(
      getBookScore(info.book_id).then(
        s => {
          if (s.average_score) info.score = s.average_score;
        },
        () => undefined
      )
    );
  }
  if (!info.serial_count) {
    jobs.push(
      getChapterCount(info.book_id).then(
        n => {
          if (n > 0) info.serial_count = n;
        },
        () => undefined
      )
    );
  }
  if (jobs.length) await Promise.all(jobs);
}

/**
 * 书籍详情：App 网关详情 → 旧网页详情 → SSR 书籍页，三层依次降级。
 * 拿到的详情会并行补评分与章节总数（都可选，失败静默）。
 */
export async function getBookDetail(bookId: string): Promise<BookInfo> {
  const failures: string[] = [];
  for (const attempt of [getBookInfo, getBookDetailWeb]) {
    try {
      const info = await attempt(bookId);
      await attachExtras(info);
      return info;
    } catch (e) {
      failures.push(e instanceof Error ? e.message : String(e));
    }
  }

  // 最后一层：SSR 书籍页（无需登录，永不风控）
  const p = await fetchBookPageState(bookId);
  if (!p) throw new ApiError(`获取书籍详情失败（${failures.join('；')}）`);
  const info: BookInfo = {
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
    source: 'ssr',
  };
  await attachExtras(info);
  return info;
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

/** 把正文 HTML 拆成段落数组，并做 PUA 字体解密。
 *  设计目标：兼容风控接口、SSR 阅读页、第三方源对正文的多种“半结构化”返回。
 *  - 块级标签（p, div, h1-h6, li, blockquote, pre, hr）作为段落分隔
 *  - br 视为换行（不再把整章压成一段）
 *  - 容忍标签属性里的空白、大小写、孤立 lt/gt 字符、HTML 注释、PI
 *  - 数字/十六进制实体也解码
 */
export function htmlToParagraphs(content: string): string[] {
  if (!content) return [];
  // 1) 先把块级开始/结束/自闭标签统一为 \n；br 也换行
  let txt = content
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li|blockquote|pre|tr|td|th|section|article)\s*>/gi, '\n')
    .replace(/<\s*(p|div|h[1-6]|li|blockquote|pre|hr|tr|td|th|section|article)[^>]*>/gi, '\n')
    // 2) 删掉剩余所有标签（含未配对的碎片）
    .replace(/<[^>]*>/g, '')
    // 3) 删掉 HTML 注释 / 处理指令
    .replace(/<![\s\S]*?>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    // 4) 实体解码（注意顺序：&amp; 必须先解，否则后续会把别人的 &lt; 变成 <<）
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCharCode(code) : '';
    });
  // 5) 兜底：删掉任何残留的孤立 lt（异常输入下正则没匹配干净时不再让标签进文本）；gt 保留（可能出现在正常文本里，如 1>0）
  txt = txt.replace(/<\s*$/gm, '').replace(/<\s*[a-zA-Z!/][^\n]{0,200}$/gm, '');
  const paras = txt
    .split(/\n+/)
    .map(s => s.replace(/<+/g, '').trim()) // 再清一次残留 lt 链
    .filter(Boolean);
  return paras.length ? paras : [txt.trim()].filter(Boolean);
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
  // readCount 与 read_count 都可能返回 "0"，取非零的那个
  let readCount = '';
  for (const v of [b.read_count, b.readCount]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) {
      readCount = String(n);
      break;
    }
  }
  return {
    bookId: String(b.bookId ?? b.book_id ?? ''),
    bookName: dec(b.bookName ?? b.book_name ?? ''),
    author: dec(b.author ?? ''),
    abstract: dec(b.abstract ?? ''),
    thumbUri: b.thumbUri ?? b.thumb_url ?? '',
    readCount,
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
    const bookList = await getBookSimpleInfo(entries.map(e => e.book_id));
    for (const e of entries) {
      const b = bookList.find((x: any) => String(x.book_id) === e.book_id);
      if (b) {
        e.title = b.book_name;
        e.author = b.author_name;
        e.cover_url = b.thumb_url;
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
  const q = new URLSearchParams(C.appQuery({ iid: '0' }));
  const j = await requestJson<any>(`${C.HOST}${C.BOOKSHELF_BASE}/add/v?${q.toString()}`, {
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
  const q = new URLSearchParams(C.appQuery({ iid: '0' }));
  const j = await requestJson<any>(`${C.HOST}${C.BOOKSHELF_BASE}/delete/v?${q.toString()}`, {
    method: 'POST',
    headers: webHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      identify_data: [{ asterisked: false, book_id: bookId, book_type: 0, modify_time: Date.now() }],
    }),
  });
  if (j.code !== 0 && j.code !== undefined) throw new ApiError(j.message ?? '移出书架失败', j.code);
}

/**
 * 批量书籍简单信息（官网同款：书名/作者/封面），比详情接口更稳定，
 * 封面是常规 CDN 图（非签名 URL），书架/封面展示用。
 */
export async function getBookSimpleInfo(
  bookIds: string[]
): Promise<Array<{ book_id: string; book_name: string; author_name: string; thumb_url: string; serial_count: number; creation_status: string }>> {
  try {
    const s = await requestJson<any>(`${C.HOST}/api/book/simple/info`, {
      method: 'POST',
      headers: webHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ book_ids: bookIds }),
    });
    const list: any[] = s.data?.bookList ?? [];
    return list.map((b: any) => ({
      book_id: String(b.book_id ?? ''),
      book_name: dec(b.book_name ?? ''),
      author_name: dec(b.author_name ?? ''),
      thumb_url: b.thumb_url ?? '',
      serial_count: Number(b.serial_count ?? 0),
      creation_status: String(b.creation_status ?? ''),
    }));
  } catch {
    return [];
  }
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

/**
 * 书评列表（App/H5 网关，**可翻页**）。
 * 实测参数：book_id + page_number（从 1 开始）+ page_count，返回 total_mark_num/has_more/comment_list。
 * 注意：item_id 会被忽略（该接口是书籍维度的"全部评价"，不是按段落的段评）。
 */
export async function getBookComments(bookId: string, page = 1, pageCount = 20): Promise<BookCommentPage> {
  const p = Math.max(1, page);
  const d = await ssdkJson<any>(
    C.SSDK_BOOK_COMMENTS,
    { book_id: bookId, page_number: String(p), page_count: String(Math.max(1, pageCount)) },
    '获取书评'
  );
  const list: any[] = Array.isArray(d.comment_list) ? d.comment_list : [];
  return {
    comments: list.map(normalizeComment),
    total: Number(d.total_mark_num ?? list.length),
    hasMore: Number(d.has_more ?? 0) > 0,
    page: p,
    source: 'ssdk',
  };
}

function normalizeComment(c: any): BookComment {
  return {
    comment_id: String(c.comment_id ?? ''),
    user_id: String(c.user_id ?? ''),
    nick_name: dec(c.user_screen_name ?? '') || '匿名',
    avatar: c.user_avatar ?? '',
    text: dec(c.content ?? ''),
    create_time: Number(c.create_time ?? 0) * 1000,
    digg_count: Number(c.thumbsup_count ?? 0),
    reply_count: Number(c.reply_count ?? 0),
    score: Number(c.score ?? 0),
    book_title: '',
  };
}

/** 书籍评分概览（App 网关）：平均分、评分人数、星级分布 */
export async function getBookScore(bookId: string): Promise<BookScore> {
  const d = await ssdkJson<any>(C.SSDK_BOOK_SCORE, { book_id: bookId }, '获取评分');
  return {
    average_score: String(d.average_score ?? ''),
    score_count: Number(d.score_count ?? 0),
    rank: Array.isArray(d.score_rank) ? d.score_rank.map((n: any) => Number(n) || 0) : [],
    my_score: Number(d.my_score ?? -1),
  };
}

/** 书评降级路径：从 SEO 页面收集评论链接后逐条抓取（只有首页，条数有限） */
export async function getBookCommentsSsr(bookId: string, limit = 12): Promise<BookCommentPage> {
  const links = await collectBookCommentLinks(bookId);
  const comments: BookComment[] = [];
  for (const link of links.slice(0, Math.max(0, limit))) {
    try {
      const c = await getBookComment(link.bookId, link.commentId);
      if (c && c.text) comments.push(c);
    } catch {
      /* 单条失败不影响其它 */
    }
  }
  return { comments, total: comments.length, hasMore: false, page: 1, source: 'ssr' };
}

/**
 * 书评统一入口：App 网关优先（可翻页、明文），失败降级 SEO 页面。
 * 首页会并行补一个评分（失败忽略，不影响书评）。
 */
export async function getBookCommentsWithFallback(
  bookId: string,
  page = 1,
  pageCount = 20
): Promise<BookCommentPage> {
  const first = Math.max(1, page);

  let score: BookScore | null = null;
  try {
    const [main, s] = await Promise.all([
      getBookComments(bookId, first, pageCount),
      first === 1 ? getBookScore(bookId).catch(() => null) : Promise.resolve(null),
    ]);
    score = s;
    if (score) {
      main.averageScore = score.average_score;
      main.scoreCount = score.score_count;
    }
    return main;
  } catch (e) {
    // 翻页失败就如实报错，不要退回只有首页的 SSR 结果
    if (first > 1) throw e;
    const ssr = await getBookCommentsSsr(bookId, pageCount);
    try {
      score = await getBookScore(bookId);
    } catch {
      score = null;
    }
    if (score) {
      ssr.averageScore = score.average_score;
      ssr.scoreCount = score.score_count;
    }
    return ssr;
  }
}

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
