/**
 * 手机号验证码登录（番茄官网同源 passport，绕开 sso.douyin.com 风控）。
 *
 * 实测（2026-08）：官方 web 登录（muye bundle 中 passport SDK 的 X 实例）：
 *  - POST /passport/web/send_code/ ：发送验证码
 *      body: mix_mode=1&fixed_mix_mode=1&mobile=<混淆>&type=<混淆'24'>&a_region=86&request_id=...
 *  - POST /passport/web/sms_login/ ：验证码登录（aid=2503，aid=1967 会被判"该应用无权限"）
 *      body: mix_mode=1&fixed_mix_mode=1&mobile=<混淆>&code=<混淆>&a_region=86
 * 关键点：mobile/type/code 必须经过 SDK 的混淆（每字节 ^5 转 hex），
 *        明文请求会被风控要求滑块验证（1105）或直接参数错误（3052）。
 * 登录成功后 Cookie（web_session 等）由 Cookie Jar 捕获，落在 fanqienovel.com 域名。
 */
import { request } from '../net/http';
import { getUserInfo, UserInfo } from '../api/fanqie';
import { saveCookies, setUser } from '../net/store';
import * as C from '../api/constants';

const PASSPORT_BASE = 'https://fanqienovel.com/passport/web/';

const COMMON_QUERY =
  'aid=2503&app_name=novelapp&version_code=57700&device_platform=web&channel=novel&sdk_version=1.6.1&passport_sdk_version=2.0.0&new_user=0';

export interface SmsSendResult {
  mobileTicket: string;
}

export class SmsError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = 'SmsError';
    this.code = code;
  }
}

/** 需要滑块验证：携带服务端挑战配置，前端渲染滑块完成后重放 */
export class SmsCaptchaError extends Error {
  verifyConf: any;
  constructor(verifyConf: any) {
    super('need-captcha');
    this.name = 'SmsCaptchaError';
    this.verifyConf = verifyConf;
  }
}

/** SDK 混淆：字符串逐字节 ^5 后转 hex（passport SDK 的 E 函数） */
export function obfuscate(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = '';
  for (const b of bytes) out += (5 ^ b).toString(16);
  return out;
}

/** 校验中国大陆手机号 */
export function isValidMobile(mobile: string): boolean {
  return /^1[3-9]\d{9}$/.test(mobile.trim());
}

async function postForm(url: string, body: string): Promise<any> {
  const resp = await request(url, {
    method: 'POST',
    headers: {
      Referer: C.HOST + '/',
      Origin: C.HOST,
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body,
    timeoutMs: 15000,
  });
  if (!resp.text) throw new SmsError('服务端返回空响应（可能触发风控）', -1);
  try {
    return JSON.parse(resp.text);
  } catch {
    throw new SmsError('响应解析失败', -1);
  }
}

function describeError(errCode: number, desc: string): string {
  switch (errCode) {
    case 1105:
      return '该手机号需要滑块安全验证，请在浏览器打开 fanqienovel.com 登录页完成验证，或改用扫码/粘贴 Cookie 登录';
    case 1202:
      return '验证码错误，请重新输入';
    case 1203:
      return '验证码已过期或错误次数过多，请重新获取';
    case 1204:
      return '手机号无效或已被限制，请检查号码';
    case 1205:
      return '发送过于频繁，请稍后再试';
    case 3052:
      return '请求参数错误，请重试';
    default:
      return desc || `错误码 ${errCode}`;
  }
}

/** 发送验证码。成功返回 mobile_ticket（用于 smsLogin）。 */
export async function sendSmsCode(mobile: string, region = '86'): Promise<SmsSendResult> {
  const m = mobile.trim();
  if (!isValidMobile(m)) throw new SmsError('请输入正确的 11 位手机号', -1);

  const body =
    `mix_mode=1&fixed_mix_mode=1&mobile=${encodeURIComponent(obfuscate(m))}` +
    `&type=${encodeURIComponent(obfuscate('24'))}&a_region=${encodeURIComponent(region)}` +
    `&request_id=${Date.now()}`;
  const j = await postForm(`${PASSPORT_BASE}send_code/?${COMMON_QUERY}`, body);

  const errCode = j?.error_code ?? j?.data?.error_code;
  const desc = j?.data?.description ?? j?.message ?? '';
  if (errCode === 0 || (j?.code === 0 && !errCode)) {
    const ticket = String(j?.data?.mobile_ticket ?? j?.mobile_ticket ?? '');
    if (!ticket) throw new SmsError('验证码已发送，但缺少票据，请重试', -1);
    return { mobileTicket: ticket };
  }
  if (errCode === 1105) {
    // 滑块验证：把挑战配置抛给前端
    let conf = j?.data?.verify_center_decision_conf ?? null;
    if (typeof conf === 'string') {
      try {
        conf = JSON.parse(conf);
      } catch {
        conf = null;
      }
    }
    if (conf) throw new SmsCaptchaError(conf);
    throw new SmsError('需要滑块安全验证，请稍后重试', 1105);
  }
  if (errCode) throw new SmsError(describeError(Number(errCode), String(desc)), Number(errCode));
  throw new SmsError(`发送验证码失败：${desc || '未知错误'}`, -1);
}

/**
 * 滑块验证完成后的重放（服务端要求携带设备指纹 fp）。
 * fp 由验证中心 SDK 生成/写入，与挑战绑定。
 */
export async function resendSmsCode(mobile: string, fp: string, region = '86'): Promise<SmsSendResult> {
  const m = mobile.trim();
  if (!isValidMobile(m)) throw new SmsError('请输入正确的 11 位手机号', -1);
  if (!fp) throw new SmsError('缺少验证指纹，请重新完成滑块验证', -1);

  const body =
    `mix_mode=1&fixed_mix_mode=1&mobile=${encodeURIComponent(obfuscate(m))}` +
    `&type=${encodeURIComponent(obfuscate('24'))}&a_region=${encodeURIComponent(region)}` +
    `&request_id=${Date.now()}&isResend=1&fp=${encodeURIComponent(fp)}&verifyFp=${encodeURIComponent(fp)}`;
  const j = await postForm(`${PASSPORT_BASE}send_code/?${COMMON_QUERY}`, body);

  const errCode = j?.error_code ?? j?.data?.error_code;
  const desc = j?.data?.description ?? j?.message ?? '';
  if (errCode === 0 || (j?.code === 0 && !errCode)) {
    const ticket = String(j?.data?.mobile_ticket ?? j?.mobile_ticket ?? '');
    if (!ticket) throw new SmsError('验证码已发送，但缺少票据，请重试', -1);
    return { mobileTicket: ticket };
  }
  if (errCode === 1105) {
    throw new SmsError('滑块验证未通过，请重新验证', 1105);
  }
  if (errCode) throw new SmsError(describeError(Number(errCode), String(desc)), Number(errCode));
  throw new SmsError(`发送验证码失败：${desc || '未知错误'}`, -1);
}

/** 验证码登录。成功后在 jar 中已有会话 Cookie，并校验用户信息。 */
export async function smsLogin(mobile: string, code: string, mobileTicket: string, region = '86'): Promise<UserInfo> {
  const m = mobile.trim();
  if (!isValidMobile(m)) throw new SmsError('请输入正确的 11 位手机号', -1);
  if (!/^\d{4,8}$/.test(code.trim())) throw new SmsError('请输入正确的验证码', -1);

  const body =
    `mix_mode=1&fixed_mix_mode=1&mobile=${encodeURIComponent(obfuscate(m))}` +
    `&code=${encodeURIComponent(obfuscate(code.trim()))}&a_region=${encodeURIComponent(region)}`;
  const j = await postForm(`${PASSPORT_BASE}sms_login/?${COMMON_QUERY}`, body);

  const errCode = j?.error_code ?? j?.data?.error_code;
  const desc = j?.data?.description ?? j?.message ?? '';
  if (errCode === 0 || (j?.code === 0 && !errCode)) {
    // 成功：Cookie 已入 jar
    const user = await getUserInfo();
    if (!user) {
      throw new SmsError('登录成功但会话建立失败，请重试或改用其他方式', -1);
    }
    await saveCookies();
    await setUser(user);
    return user;
  }
  if (errCode) throw new SmsError(describeError(Number(errCode), String(desc)), Number(errCode));
  throw new SmsError(`登录失败：${desc || '未知错误'}`, -1);
}
