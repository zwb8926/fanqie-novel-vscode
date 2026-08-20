/**
 * 番茄小说 VS Code 扩展入口。
 */
import * as vscode from 'vscode';
import { initStore, loadPersisted, getUser } from './net/store';
import { openPanel, disposePanel, openBookInPanel } from './webview/panel';
import { FanqieSidebarProvider } from './webview/sidebar';
import { setOpenBookInEditorHandler } from './webview/router';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initStore(context);
  await loadPersisted();

  // 侧边栏请求打开书籍时，转到编辑器标签页（面板）
  setOpenBookInEditorHandler((bookId, mode) => {
    openPanel(context);
    setTimeout(() => openBookInPanel(bookId, mode), 350);
  });

  // 侧边栏（活动栏入口）
  const sidebarProvider = new FanqieSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FanqieSidebarProvider.viewType, sidebarProvider)
  );

  const register = (cmd: string, fn: (...args: any[]) => any) => {
    context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));
  };

  register('fanqie.open', () => openPanel(context));

  register('fanqie.search', () => openPanel(context, 'search'));

  register('fanqie.login', () => openPanel(context, 'login'));

  register('fanqie.openBook', async () => {
    const bookId = await vscode.window.showInputBox({
      prompt: '输入番茄小说书籍 ID（书籍链接 https://fanqienovel.com/page/{bookId} 中的数字）',
      placeHolder: '例如 7576659101376072728',
      validateInput: v => (v && /^\d{10,}$/.test(v.trim()) ? undefined : '请输入合法的书籍 ID（纯数字）'),
    });
    if (!bookId) return;
    openPanel(context);
    setTimeout(() => openBookInPanel(bookId.trim()), 400);
  });

  // 状态栏：登录状态
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.command = 'fanqie.open';
  context.subscriptions.push(statusItem);
  const refreshStatus = async () => {
    const user = await getUser();
    if (user) {
      statusItem.text = `$(book) 番茄 · ${user.name}`;
      statusItem.tooltip = '番茄小说：已登录（点击打开）';
    } else {
      statusItem.text = '$(book) 番茄小说';
      statusItem.tooltip = '番茄小说（点击打开，未登录）';
    }
    statusItem.show();
  };
  void refreshStatus();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(() => void refreshStatus()),
    vscode.window.onDidChangeWindowState(() => void refreshStatus())
  );

  context.subscriptions.push({ dispose: disposePanel });
}

export function deactivate(): void {
  disposePanel();
}
