/**
 * 生成 Webview HTML：CSP 严格限制，仅允许本地脚本/样式与 HTTPS 图片。
 */
import * as vscode from 'vscode';

export function buildHtml(webview: vscode.Webview, extensionUri: vscode.Uri, host: 'panel' | 'sidebar' = 'panel'): string {
  const media = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', file));
  // 滑块验证需要加载字节验证中心 SDK 与其 iframe 资源
  const captchaScriptSrc = [
    'https://lf-rc1.yhgfb-cn-static.com',
    'https://lf-rc2.yhgfb-cn-static.com',
    'https://lf-cdn-tos.bytescm.com',
    'https://lf3-cdn-tos.bytescm.com',
    'https://lf-rc1.yhgfb-static.com',
  ].join(' ');
  const csp = [
    "default-src 'none'",
    `script-src ${webview.cspSource} ${captchaScriptSrc}`,
    `style-src ${webview.cspSource} https: 'unsafe-inline'`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource} https: data:`,
    `connect-src https:`,
    `frame-src https:`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>番茄小说</title>
<link rel="stylesheet" href="${media('style.css')}">
</head>
<body data-host="${host}">
<div id="app">
  <div id="loading" class="loading">加载中…</div>
</div>
<script src="${media('vendor/qrcode.js')}"></script>
<script src="${media('app.js')}"></script>
</body>
</html>`;
}
