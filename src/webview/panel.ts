/**
 * Webview 面板：加载 media/index.html，处理前端消息，转发到 API / 认证层。
 */
import * as vscode from 'vscode';
import { buildHtml } from './html';
import { attachRouter, broadcast } from './router';

let panel: vscode.WebviewPanel | undefined;

export function openPanel(context: vscode.ExtensionContext, view?: string): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Active);
    if (view) {
      panel.webview.postMessage({ type: 'nav', view });
    }
    return;
  }
  panel = vscode.window.createWebviewPanel('fanqie', '番茄小说', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
  });
  panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
  panel.webview.html = buildHtml(panel.webview, context.extensionUri, 'panel');
  panel.onDidDispose(() => {
    panel = undefined;
  });

  const disp = attachRouter(panel.webview);
  panel.onDidDispose(() => disp.dispose());
}

export function disposePanel(): void {
  panel?.dispose();
  panel = undefined;
}

/** 面板/侧边栏就绪后，让前端打开指定书籍（mode: modal=详情弹窗，reader=直接进入阅读器，itemId=续读章节） */
export function openBookInPanel(bookId: string, mode: 'modal' | 'reader' = 'modal', itemId?: string): void {
  broadcast({ type: mode === 'reader' ? 'open-book-reader' : 'open-book', bookId, itemId });
}
