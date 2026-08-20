/**
 * 轻量 HTTP 客户端：Cookie Jar、手动重定向跟随、超时、JSON 助手。
 * 不依赖任何第三方库，运行于 VS Code 扩展宿主（Node.js）。
 */

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  /** 原始文本（若响应是 JSON，可再用 json() 解析） */
  text: string;
  url: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  body?: string;
  /** 跟随重定向（默认 true，内部手动跟随以捕获每一跳的 Set-Cookie） */
  followRedirects?: boolean;
  /** 最大重定向跳数 */
  maxRedirects?: number;
  timeoutMs?: number;
  /** 对响应内容做简单校验后抛出带上下文的错误 */
  json?: boolean;
}

export class HttpError extends Error {
  status: number;
  url: string;
  body: string;
  constructor(message: string, status: number, url: string, body: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

interface Cookie {
  value: string;
  path: string;
  secure: boolean;
  expires: number | null;
}

/** 简易 Cookie Jar：按域名存储，支持 Path/Secure/Expires，输出 Cookie 头 */
export class CookieJar {
  private store = new Map<string, Map<string, Cookie>>();

  /** 为某个 URL 生成 Cookie 请求头值 */
  cookiesFor(url: string): string {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return '';
    }
    const host = u.hostname;
    const now = Date.now();
    const out: string[] = [];
    for (const [domain, m] of this.store) {
      if (host !== domain && !host.endsWith('.' + domain)) continue;
      for (const [name, c] of m) {
        if (c.expires !== null && c.expires < now) continue;
        if (c.secure && u.protocol !== 'https:') continue;
        if (!u.pathname.startsWith(c.path)) continue;
        out.push(name + '=' + c.value);
      }
    }
    return out.join('; ');
  }

  /** 解析 Set-Cookie 响应头并入库 */
  setFromSetCookie(setCookieHeaders: string[], url: string): void {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return;
    }
    for (const sc of setCookieHeaders) {
      const parts = sc.split(';');
      const first = parts[0].trim();
      const eq = first.indexOf('=');
      if (eq <= 0) continue;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      if (!name) continue;
      let domain = u.hostname;
      let path = '/';
      let secure = false;
      let expires: number | null = null;
      for (const p of parts.slice(1)) {
        const kv = p.trim();
        const eq2 = kv.indexOf('=');
        const k = (eq2 > 0 ? kv.slice(0, eq2) : kv).trim().toLowerCase();
        const v = eq2 > 0 ? kv.slice(eq2 + 1).trim() : '';
        if (k === 'domain' && v) domain = v.replace(/^\./, '').toLowerCase();
        else if (k === 'path') path = v || '/';
        else if (k === 'secure') secure = true;
        else if (k === 'expires') {
          const t = Date.parse(v);
          if (!isNaN(t)) expires = t;
        } else if (k === 'max-age') {
          const n = parseInt(v, 10);
          if (!isNaN(n)) expires = n <= 0 ? 0 : Date.now() + n * 1000;
        }
      }
      if (!this.store.has(domain)) this.store.set(domain, new Map());
      this.store.get(domain)!.set(name, { value, path, secure, expires });
    }
  }

  /** 导出全部 cookie（用于持久化 / 展示） */
  all(): string[] {
    const out: string[] = [];
    for (const [, m] of this.store) {
      for (const [name, c] of m) out.push(name + '=' + c.value);
    }
    return out;
  }

  /** 导入外部 cookie 字符串（手动登录兜底） */
  importCookies(cookieString: string, url: string): number {
    const parts = cookieString.split(';');
    const headers = parts.map(p => p.trim()).filter(Boolean);
    this.setFromSetCookie(headers.map(p => p + '; path=/'), url);
    return headers.length;
  }

  clear(): void {
    this.store.clear();
  }
}

/** 全局共享 Cookie Jar */
export const jar = new CookieJar();

export const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * 发起请求。默认自动携带 jar 中的 Cookie，并把响应 Set-Cookie 写入 jar。
 * 重定向手动跟随，保证每一跳的 Set-Cookie 都能被捕获。
 */
export async function request(url: string, opts: RequestOptions = {}): Promise<HttpResponse> {
  const {
    method = 'GET',
    headers = {},
    body,
    followRedirects = true,
    maxRedirects = 10,
    timeoutMs = 20000,
    json = false,
  } = opts;

  let currentUrl = url;
  let redirects = 0;

  for (;;) {
    const ck = jar.cookiesFor(currentUrl);
    const h: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      Accept: 'application/json, text/plain, */*',
      ...headers,
    };
    if (ck) h['Cookie'] = ck;
    if (body && !h['Content-Type']) h['Content-Type'] = 'application/json; charset=utf-8';

    let resp: Response;
    try {
      resp = await fetch(currentUrl, {
        method,
        headers: h,
        body: body,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const err = e as Error;
      throw new HttpError(`网络请求失败: ${err.message}`, 0, currentUrl, '');
    }

    // 捕获 Set-Cookie（fetch 的 headers 合并了多个同名头）
    const setCookie: string[] = resp.headers.getSetCookie ? resp.headers.getSetCookie() : [];
    if (setCookie.length) jar.setFromSetCookie(setCookie, currentUrl);

    const status = resp.status;
    const isRedirect = status >= 300 && status < 400 && resp.headers.has('location');

    if (isRedirect && followRedirects && redirects < maxRedirects) {
      const loc = resp.headers.get('location')!;
      currentUrl = new URL(loc, currentUrl).toString();
      redirects++;
      continue;
    }

    const text = await resp.text().catch(() => '');
    if (json && !text && status >= 400) {
      throw new HttpError(`HTTP ${status}`, status, currentUrl, '');
    }
    return {
      status,
      statusText: resp.statusText,
      headers: Object.fromEntries(resp.headers.entries()),
      text,
      url: currentUrl,
    };
  }
}

/** 请求并解析 JSON；非 2xx 或 JSON 解析失败时抛 HttpError */
export async function requestJson<T = any>(url: string, opts: RequestOptions = {}): Promise<T> {
  const resp = await request(url, opts);
  if (resp.status >= 400) {
    throw new HttpError(`HTTP ${resp.status} ${resp.statusText}`, resp.status, url, resp.text.slice(0, 500));
  }
  if (!resp.text) {
    throw new HttpError('服务端返回空响应（可能触发风控，可稍后重试）', resp.status, url, '');
  }
  try {
    return JSON.parse(resp.text) as T;
  } catch {
    throw new HttpError('响应不是合法 JSON（可能触发风控）', resp.status, url, resp.text.slice(0, 300));
  }
}

/** 从 JSON 响应中按 code 判断业务成功 */
export function bizOk(j: any): boolean {
  if (!j || typeof j !== 'object') return false;
  if (j.code === undefined) return true;
  return j.code === 0 || j.code === '0';
}
