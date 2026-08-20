/**
 * 抖音扫码登录（番茄官网同源 passport，绕开 sso.douyin.com 风控）。
 *
 * 实测（2026-08）：官网登录 SDK 的二维码协议（$ 实例）：
 *  - GET /passport/web/get_qrcode/?next=<next>&aid=2503&... → 返回
 *      { qrcode: base64-PNG, token, expire_time, qrcode_index_url, web_name }
 *  - GET /passport/web/check_qrconnect/?next=<next>&token=<token>&aid=2503&... → 轮询
 *      { data: { status: "new"|..., scan_app_id, error_code } }
 * 关键点：参数用 next（而非 service），aid 必须 2503（1967 会"该应用无权限"）；
 *         两个接口都在 fanqienovel.com 同源，不受 sso.douyin.com 风控影响。
 * 扫码确认后 status 变化，确认成功时返回跳转地址；跟随跳转捕获 Cookie，
 * 最后用 /api/user/info/v2 校验登录态。
 */
import { request, requestJson, jar, HttpError } from '../net/http';
import * as C from '../api/constants';
import { getUserInfo, UserInfo } from '../api/fanqie';
import { saveCookies, setUser } from '../net/store';

export type QrStage = 'getting' | 'waiting' | 'scanned' | 'success' | 'error' | 'imported';

export interface QrStatus {
  stage: QrStage;
  message: string;
  /** 二维码图片（data URL 或 http URL） */
  qrUrl?: string;
  /** 二维码内容字符串（备用） */
  qrText?: string;
}

export type QrStatusCallback = (s: QrStatus) => void;

export interface QrTicket {
  strategy: string;
  /** 轮询地址 */
  pollUrl: string;
  token: string;
  next: string;
  qrUrl?: string;
  qrText?: string;
  /** 过期时间（unix 秒） */
  expireTime?: number;
}

/** 扫码成功后跳转的目标页（next） */
const NEXT_URL = 'https://fanqienovel.com/';

/** passport 公共参数（同源 direct 路径，aid 必须是 2503） */
function passportQuery(): string {
  return new URLSearchParams({
    aid: '2503',
    app_name: 'novelapp',
    version_code: '57700',
    device_platform: 'web',
    channel: 'novel',
    sdk_version: '1.6.1',
    passport_sdk_version: '2.0.0',
    new_user: '0',
  }).toString();
}

function webHeaders(): Record<string, string> {
  return { Referer: C.HOST + '/', Origin: C.HOST, Accept: 'application/json, text/plain, */*' };
}

/**
 * 获取二维码（同源）。qrUrl 为 data URL，webview 可直接显示。
 */
export async function startQrLogin(onStatus: QrStatusCallback): Promise<QrTicket> {
  onStatus({ stage: 'getting', message: '正在获取二维码…' });
  const url = `${C.HOST}/passport/web/get_qrcode/?next=${encodeURIComponent(NEXT_URL)}&${passportQuery()}`;
  const resp = await request(url, { headers: webHeaders(), timeoutMs: 15000 });
  if (!resp.text) throw new HttpError('获取二维码失败：服务端返回空响应', resp.status, url, '');
  let j: any;
  try {
    j = JSON.parse(resp.text);
  } catch {
    throw new HttpError('获取二维码失败：响应解析失败', resp.status, url, resp.text.slice(0, 200));
  }
  const d = j?.data ?? j;
  if (d?.error_code && Number(d.error_code) !== 0) {
    throw new HttpError(`获取二维码失败：${d.description ?? `错误码 ${d.error_code}`}`, 0, url, '');
  }
  const token = String(d.token ?? d.qr_token ?? '');
  if (!token) throw new HttpError('获取二维码失败：缺少 token', 0, url, '');
  const qrB64 = String(d.qrcode ?? '');
  const qrUrl = qrB64 ? `data:image/png;base64,${qrB64}` : String(d.qr_code_url ?? '');
  const ticket: QrTicket = {
    strategy: 'same-origin',
    pollUrl: `${C.HOST}/passport/web/check_qrconnect/`,
    token,
    next: NEXT_URL,
    qrUrl,
    qrText: String(d.qrcode_index_url ?? ''),
    expireTime: Number(d.expire_time ?? 0),
  };
  onStatus({
    stage: 'waiting',
    message: '请使用抖音 / 番茄小说 App 扫码，并在手机上确认登录',
    qrUrl,
    qrText: ticket.qrText,
  });
  return ticket;
}

/** 轮询扫码状态。status: new=等待，scanned/scanning=已扫码，confirmed/success=已确认 */
export async function pollQrLogin(
  ticket: QrTicket,
  onStatus: QrStatusCallback,
  timeoutMs = 180000
): Promise<string> {
  const base = `${ticket.pollUrl}?next=${encodeURIComponent(ticket.next)}&token=${encodeURIComponent(ticket.token)}&${passportQuery()}`;
  const start = Date.now();
  let lastStatus = '';
  for (;;) {
    if (Date.now() - start > timeoutMs) {
      onStatus({ stage: 'error', message: '二维码已过期，请点击「刷新二维码」重试' });
      throw new HttpError('二维码已过期', 0, base, '');
    }
    let j: any = null;
    try {
      const resp = await request(base, { headers: webHeaders(), timeoutMs: 12000 });
      if (resp.text) {
        try {
          j = JSON.parse(resp.text);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* 网络抖动，继续轮询 */
    }

    const d = j?.data ?? j ?? {};
    const status = String(d.status ?? '');
    const redirectUrl = String(d.redirect_url ?? d.redirectUrl ?? d.url ?? d.next_url ?? '');
    const errCode = Number(d.error_code ?? j?.error_code ?? 0);

    if (status !== lastStatus) {
      lastStatus = status;
      onStatus({ stage: 'waiting', message: statusMessage(status), qrUrl: ticket.qrUrl, qrText: ticket.qrText });
    }

    if (/confirm|success|done|ok|scanned-ok|accept/i.test(status) || redirectUrl) {
      onStatus({ stage: 'scanned', message: '已确认，正在完成登录…' });
      return redirectUrl || ticket.next;
    }
    if (/scan/i.test(status) && !/new/.test(status)) {
      onStatus({ stage: 'scanned', message: '扫码成功，请在手机上点击「确认登录」', qrUrl: ticket.qrUrl });
    }
    if (errCode !== 0) {
      onStatus({ stage: 'error', message: `二维码状态异常（${errCode}），请刷新重试` });
      throw new HttpError('二维码状态异常', errCode, base, '');
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

function statusMessage(status: string): string {
  if (/new|init/.test(status)) return '等待扫码…';
  if (/scan/.test(status)) return '已扫码，请在手机上确认…';
  if (/confirm|success|done/.test(status)) return '登录确认中…';
  return '等待扫码…';
}

/**
 * 跟随跳转完成登录（捕获 Set-Cookie），然后校验登录态。
 */
export async function finalizeLogin(redirectUrl: string, onStatus: QrStatusCallback): Promise<UserInfo> {
  onStatus({ stage: 'scanned', message: '正在完成登录…' });
  const urls = [redirectUrl];
  if (!urls.includes(NEXT_URL)) urls.push(NEXT_URL);
  let user: UserInfo | null = null;
  for (const u of urls) {
    try {
      await request(u, {
        headers: { Referer: C.HOST + '/', Origin: C.HOST, Accept: 'text/html,application/json' },
        timeoutMs: 15000,
      });
    } catch {
      /* ignore */
    }
    user = await getUserInfo();
    if (user) break;
  }
  if (!user) user = await getUserInfo();
  if (!user) {
    onStatus({
      stage: 'error',
      message: '扫码已确认，但未能建立会话。请重试，或改用「手机号登录 / 粘贴 Cookie」。',
    });
    throw new HttpError('登录会话建立失败', 0, '', '');
  }
  await saveCookies();
  await setUser(user);
  onStatus({ stage: 'success', message: `登录成功：${user.name}` });
  return user;
}

/** 一键扫码登录流程 */
export async function qrLogin(onStatus: QrStatusCallback): Promise<UserInfo> {
  const ticket = await startQrLogin(onStatus);
  const redirectUrl = await pollQrLogin(ticket, onStatus);
  return finalizeLogin(redirectUrl, onStatus);
}

/** 登出 */
export async function logout(): Promise<void> {
  jar.clear();
  await saveCookies();
  await setUser(null);
}
