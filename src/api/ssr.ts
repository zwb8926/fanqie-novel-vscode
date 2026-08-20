/**
 * SSR（SEO）页面解析层：番茄官网对搜索引擎渲染静态页面，
 * 页面内嵌 window.__INITIAL_STATE__，无需登录、无需签名即可拿到完整数据。
 * 作为 Web API 的风控/失败降级数据源。
 *
 * 使用蜘蛛 UA 抓取：爬虫页面包含完整的书籍/章节状态与 SEO 评论链接。
 */
import { request } from '../net/http';
import * as C from './constants';

const SSR_UA =
  'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';

export interface PageResult {
  html: string;
  state: any;
}

/** 从 HTML 中稳健地提取 __INITIAL_STATE__ JSON。
 *  官网不同后端会返回三种形态：
 *   A. 标准对象：`={"common":{...}};`
 *   B. 双重编码字符串：`="{\"common\":{...}}";`
 *   C. 损坏形态：`="common":{"id":...}};`（丢开头的 `{` 与引号，引号未转义）
 */
export function extractInitialState(html: string): any {
  const idx = html.lastIndexOf('__INITIAL_STATE__=');
  if (idx < 0) return null;
  let i = idx + '__INITIAL_STATE__='.length;
  while (i < html.length && (html[i] === ' ' || html[i] === '\n' || html[i] === '\r' || html[i] === '\t')) i++;
  const scriptEnd = html.indexOf('</script>', i);
  const limit = scriptEnd > 0 ? scriptEnd : html.length;

  // 1) 标准对象形态：`=` 后紧跟 `{`，做括号配平解析
  const open = html.indexOf('{', i);
  if (open >= 0 && open < limit && /^\s*$/.test(html.slice(i, open))) {
    const close = scanBalanced(html, open, limit);
    if (close > 0) {
      try {
        return JSON.parse(html.slice(open, close + 1));
      } catch {
        /* fall through */
      }
    }
  }

  // 2) 双重编码字符串形态（B）：转义感知地扫描闭合引号
  if (html[i] === '"') {
    let k = i + 1;
    let esc = false;
    for (; k < limit; k++) {
      const c = html[k];
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') break;
    }
    if (k < limit) {
      try {
        const inner = JSON.parse(html.slice(i, k + 1));
        if (typeof inner === 'string') {
          try {
            return JSON.parse(inner);
          } catch {
            /* fall through */
          }
        } else {
          return inner;
        }
      } catch {
        /* fall through */
      }
    }
  }

  // 3) 损坏形态（C）：`"common":{...}};`，用 `}}` 定位结尾并重建 `{"` 前缀
  if (html[i] === '"') {
    let searchFrom = limit;
    for (;;) {
      const tail = html.lastIndexOf('}}', searchFrom);
      if (tail < i || tail - i > 500000) break;
      try {
        return JSON.parse('{"' + html.slice(i + 1, tail + 2));
      } catch {
        /* try earlier */
      }
      searchFrom = tail - 1;
      if (searchFrom <= i) break;
    }
  }
  return null;
}

/** 括号配平扫描：从 open 位置起，找到配对的 `}`（跳过字符串与转义） */
function scanBalanced(html: string, open: number, limit: number): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let k = open; k < limit; k++) {
    const c = html[k];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

/** 抓取页面并提取状态（蜘蛛 UA） */
export async function fetchPage(url: string): Promise<PageResult | null> {
  try {
    const resp = await request(url, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': SSR_UA },
      timeoutMs: 20000,
    });
    if (resp.status !== 200 || !resp.text) return null;
    const state = extractInitialState(resp.text);
    return { html: resp.text, state };
  } catch {
    return null;
  }
}

/** 书籍页 /page/{bookId} -> state.page（书籍信息 + 完整目录） */
export async function fetchBookPageState(bookId: string, withHtml = false): Promise<any | null> {
  const r = await fetchPage(`${C.HOST}${C.SSR_BOOK_PAGE}${encodeURIComponent(bookId)}`);
  if (!r) return null;
  const page = r.state?.page ?? null;
  if (!page) return null;
  if (withHtml) page.html = r.html;
  return page;
}

/** 章节页 /reader/{itemId} -> state.reader.chapterData + 页面中的字体 URL */
export async function fetchReaderPageState(itemId: string): Promise<any | null> {
  const r = await fetchPage(`${C.HOST}${C.SSR_READER_PAGE}${encodeURIComponent(itemId)}`);
  if (!r) return null;
  const data = r.state?.reader?.chapterData ?? null;
  if (!data) return null;
  data._html = r.html;
  return data;
}

/** 评论页 /comment/{bookId}-{commentId} -> state.comment.data */
export async function fetchCommentPageData(bookId: string, commentId: string): Promise<any | null> {
  const r = await fetchPage(`${C.HOST}${C.SSR_COMMENT_PAGE}${encodeURIComponent(bookId)}-${encodeURIComponent(commentId)}`);
  if (!r) return null;
  return r.state?.comment?.data ?? null;
}

/** 从 HTML 中收集 /comment/{bookId}-{commentId} 链接 */
export function collectCommentLinks(html: string): Array<{ bookId: string; commentId: string }> {
  const out: Array<{ bookId: string; commentId: string }> = [];
  const re = /\/comment\/(\d{10,})-(\d{10,})/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html)) !== null) {
    const key = m[1] + '-' + m[2];
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ bookId: m[1], commentId: m[2] });
    }
  }
  return out;
}

/** 从章节页 HTML 中提取 @font-face 字体 URL（PUA 字体解密用） */
export function extractFontUrls(html: string): string[] {
  const urls: string[] = [];
  const re = /@font-face\s*\{[^}]*?src:\s*url\(([^)]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const u = m[1].replace(/['"]/g, '').trim();
    if (u && (u.endsWith('.woff') || u.endsWith('.woff2') || u.endsWith('.ttf') || u.includes('font'))) {
      urls.push(u.startsWith('http') ? u : C.HOST + u);
    }
  }
  return urls;
}
