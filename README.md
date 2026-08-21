# 🍅 番茄小说 · VS Code 阅读器

在 VS Code 里直接阅读[番茄小说](https://fanqienovel.com/)：抖音扫码登录、书城（排行榜/分类）、搜索、书架、历史记录、沉浸式阅读器（上下翻页/字号主题/工具栏显隐）、书评。

🌐 项目地址  https://github.com/zwb8926/fanqie-novel-vscode


## 📖 使用说明

### 登录（推荐扫码登录）

1. 打开面板 → 右上角「登录」→ 默认「扫码登录」；
2. 点击「开始扫码登录」→ 用 **抖音** 或 **番茄小说 App** 扫码 → 在手机上确认；
3. 登录成功后即可同步云端书架与阅读进度。

> 扫码登录走番茄官网**同源 passport** 接口（`/passport/web/get_qrcode/` + `check_qrconnect/`），不经过 sso.douyin.com，不受其风控影响（实测有效）。

### 阅读

- 书城/搜索/书架点击书籍 → 详情 → 「开始阅读」；
- **沉浸阅读**：默认隐藏导航/工具栏，**点击正文左侧/右侧快速翻页、点击中间切换工具栏显隐**（或右上角「设置」→「工具栏」）；
- **翻页**：按钮、键盘 `←`/`→`、`PageUp`/`PageDown`、`空格`；
- **切换章节**：`Ctrl+←` / `Ctrl+→`，或打开「目录」抽屉点击；
- 顶部「书评」查看书籍评论；
- 阅读器右上角「设置」调整字号、行距、主题（羊皮纸/白天/夜间）；
- 阅读进度自动保存在本地书架，登录后同步到云端；
- **历史记录**自动记录最近读过的书（本地保存，无需登录），在「个人信息」页可查看、点击续读。

## ⚠️ 已知限制

- 搜索 / 章节 / 详情接口在部分**机房 IP** 下会被官网风控返回空响应（家用宽带正常），此时自动降级到 SSR 页面；
- 章评/段评为番茄 **App 专属**功能（网页端无接口，App 接口需签名），本扩展不提供；
- 付费章节（`needPay`）需登录并在官方平台购买后方可阅读；
- 本项目仅用于个人学习研究，请遵守番茄小说服务条款，勿用于批量抓取。

## 🙏 致谢

- 字体字符表参考开源项目 [ying-ck/fanqienovel-downloader](https://github.com/ying-ck/fanqienovel-downloader) 与 [fysh1010/mcp-server-fanqie](https://github.com/fysh1010/mcp-server-fanqie) 的研究成果；
- 接口信息参考 [naiyQAQ/fanqie-assistant](https://github.com/naiyQAQ/fanqie-assistant) 对官网前端 bundle 的分析。

## 📄 License

MIT
