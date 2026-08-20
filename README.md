# 🍅 番茄小说 · VS Code 阅读器

在 VS Code 里直接阅读[番茄小说](https://fanqienovel.com/)：抖音扫码登录、书城（排行榜/分类）、搜索、书架、阅读器（上下翻页/字号主题）、章评/段评。

## ✨ 功能

| 功能 | 说明 |
| --- | --- |
| 🔑 扫码登录 | 抖音 / 番茄 App 扫码，多策略自动回退；另有「粘贴 Cookie」备用登录 |
| 📚 书城 | 男频/女频 + 推荐/热读/新书/完结/更新榜单 + 37 个分类 |
| 🔍 搜索 | 按书名/作者搜索，分页加载 |
| 📖 书架 | 本地书架（离线可用）+ 登录后云端书架同步 |
| 📄 阅读器 | 上下翻页（键盘 ←/→、PgUp/PgDn、空格）、章节切换（Ctrl+←/→）、字号/行距/主题、目录抽屉、进度记忆 |
| 💬 章评 / 段评 / 书评 | 书评走官网 SEO 评论页（免登录）；章评/段评走番茄 App 接口（尽力而为，受网络环境限制） |
| 🛡️ 数据兜底 | 接口被风控时自动降级到官网静态页（SSR），无需登录也能读到免费章节 |
| 🔓 字体反爬解密 | 章节正文的 PUA 字体加密自动解密（动态字体解析 + 内置字符表） |

## 🚀 快速开始

### 方式一：源码运行（开发调试）

```bash
npm install
npm run compile
```

在 VS Code 中按 `F5`（需要 `.vscode/launch.json`，已内置）启动「扩展开发宿主」，然后：

- 命令面板（`Ctrl+Shift+P`）→ `番茄小说：打开阅读器`
- 或按快捷键 `Ctrl+Alt+Shift+N`

### 方式二：打包安装

```bash
npm install
npm run package        # 生成 fanqie-novel-<版本>.vsix（如 1.0.0）
```

安装生成的 `.vsix`：VS Code 扩展面板 → `...` → 从 VSIX 安装。

## 📖 使用说明

### 登录（推荐扫码登录）

1. 打开面板 → 右上角「登录」→ 默认「扫码登录」；
2. 点击「开始扫码登录」→ 用 **抖音** 或 **番茄小说 App** 扫码 → 在手机上确认；
3. 登录成功后即可同步云端书架与阅读进度。

> 扫码登录走番茄官网**同源 passport** 接口（`/passport/web/get_qrcode/` + `check_qrconnect/`），不经过 sso.douyin.com，不受其风控影响（实测有效）。
> 若扫码不可用，可切换到「手机号登录」（官网同源验证码接口）或「粘贴 Cookie」。

#### 备选：手机号登录

1. 登录页切到「手机号登录」；
2. 输入 11 位手机号 → 发送验证码 → 输入验证码登录。
> 若提示「需要滑块验证」，扩展会**内嵌官方滑块**：直接在登录页拖动滑块完成验证后自动继续发送验证码。

#### 兜底：粘贴 Cookie

> ① 浏览器打开 [fanqienovel.com](https://fanqienovel.com) 并登录；
> ② F12 → 网络（Network）→ 任意请求 → 请求头里复制 `Cookie`；
> ③ 回到扩展的登录页 → 「手动登录：粘贴浏览器 Cookie」→ 粘贴 → 导入。

### 阅读

- 书城/搜索/书架点击书籍 → 详情 → 「开始阅读」；
- **翻页**：按钮、键盘 `←`/`→`、`PageUp`/`PageDown`、`空格`；
- **切换章节**：`Ctrl+←` / `Ctrl+→`，或打开「目录」抽屉点击；
- 点击正文中的**某个段落**可查看该段**段评**；顶部「章评」「书评」查看章节/书籍评论；
- 阅读器右上角「设置」调整字号、行距、主题（羊皮纸/白天/夜间）；
- 阅读进度自动保存在本地书架，登录后同步到云端。

## 🧩 技术说明

- **纯 Node 实现，零运行时依赖**：网络层自带 Cookie Jar（手动跟随重定向、逐跳捕获 Set-Cookie）；
- **数据源分层**（全部为番茄官方接口/页面，非第三方聚合）：
  1. Web API：搜索 `/api/author/search/search_book/v1`、目录 `/api/reader/directory/detail?bookId=`、章节 `/api/reader/full?itemId=`、排行 `/api/rank/category/list`、书架 `/reading/bookapi/bookshelf/*`、用户 `/api/user/info/v2`；
  2. SSR 降级：`/page/{bookId}`、`/reader/{itemId}`、`/comment/{bookId}-{commentId}` 的 `__INITIAL_STATE__`（无需登录、无签名）；
- **登录**：抖音 passport 流程（`get_qrcode` → `check_qrconnect` 轮询 → 跟随 `redirect_url` 捕获 Cookie），同一 Cookie Jar 贯穿登录与业务请求；Cookie 存于 VS Code SecretStorage；
- **字体解密**：解析字体 WOFF2（brotli）+ CFF 字符集，由字形名 `gidXXXXX` 还原虚拟 gid，再查内置字符表（`src/api/fontmap.json`，362 个常用字，源自开源社区对字体字符集顺序的分析）；
- **章评/段评**：番茄 App 接口族（`reading.snssdk.com` 等），携带设备参数尽力请求；网页端未开放章评/段评，若被风控会给出明确提示。

## ⚠️ 已知限制

- 搜索 / 章节 / 详情接口在部分**机房 IP** 下会被官网风控返回空响应（家用宽带正常），此时自动降级到 SSR 页面；
- 章评/段评依赖 App 接口，**不同网络环境可达性不同**；不可用时请直接使用番茄 App；
- 付费章节（`needPay`）需登录并在官方平台购买后方可阅读；
- 本项目仅用于个人学习研究，请遵守番茄小说服务条款，勿用于批量抓取。

## 📁 项目结构

```
src/
  extension.ts          # 扩展入口：命令注册、状态栏
  net/http.ts           # HTTP 客户端 + Cookie Jar
  net/store.ts          # SecretStorage / globalState 持久化
  api/constants.ts      # 接口常量
  api/fanqie.ts         # Web API 封装（搜索/目录/章节/排行/书架/书评）
  api/ssr.ts            # SSR 页面解析（__INITIAL_STATE__）
  api/font.ts           # PUA 字体解密（WOFF2/CFF 解析 + 字符表）
  api/fontmap.json      # 字体字符映射表
  auth/qr.ts            # 抖音扫码登录（多策略）
  webview/panel.ts      # Webview 面板与消息路由
  webview/html.ts       # Webview HTML（CSP）
media/
  app.js                # 前端 SPA（登录/书城/搜索/书架/阅读器/评论）
  style.css             # 样式与主题
  vendor/qrcode.js      # 二维码渲染库（MIT）
scripts/                # 研究/冒烟测试脚本（不打入扩展包）
```

## 🙏 致谢

- 字体字符表参考开源项目 [ying-ck/fanqienovel-downloader](https://github.com/ying-ck/fanqienovel-downloader) 与 [fysh1010/mcp-server-fanqie](https://github.com/fysh1010/mcp-server-fanqie) 的研究成果；
- 接口信息参考 [naiyQAQ/fanqie-assistant](https://github.com/naiyQAQ/fanqie-assistant) 对官网前端 bundle 的分析。

## 📄 License

MIT
