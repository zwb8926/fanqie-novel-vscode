/**
 * 番茄小说网页版接口常量。
 * 端点来源：官网前端 bundle（muye_*.js）与实测验证。
 * 2026-08 实测：目录 /api/reader/directory/detail、排行 /api/rank/category/list、
 * 配置 /api/config/list、用户 /api/user/info/v2、书架 /reading/bookapi/bookshelf/* 可用。
 * 搜索 / 章节 / 书籍详情端点存在，但在部分机房 IP 下会被风控返回空 body（家用 IP 正常）。
 */

export const HOST = 'https://fanqienovel.com';

/** 搜索书籍（官方 web 搜索接口） */
export const SEARCH = '/api/author/search/search_book/v1';
/** 书籍详情 */
export const BOOK_DETAIL = '/api/reader/full/book/detail';
/** 目录 */
export const DIRECTORY = '/api/reader/directory/detail';
/** 章节内容（需要请求头 ismobile: 0/1） */
export const CHAPTER = '/api/reader/full';
/** 排行分类配置 */
export const CONFIG_LIST = '/api/config/list';
/** 排行列表 */
export const RANK_LIST = '/api/rank/category/list';
/** 编辑精选 */
export const EDITOR_LIST = '/api/editor/list';
/** 用户信息 */
export const USER_INFO = '/api/user/info/v2';
/** 阅读进度 */
export const READ_PROGRESS = '/api/reader/book/progress';
export const UPDATE_PROGRESS = '/api/reader/book/update_progress';
/** 书架（同源挂载的 APP 接口，无需签名） */
export const BOOKSHELF_BASE = '/reading/bookapi/bookshelf';
export const BOOKSHELF_MULTIDETAIL = '/api/bookshelf/multidetail';
/** 单条书评（SEO 后端） */
export const BOOK_COMMENT = '/api/comment/get_book_comment';

/** SSR（SEO）页面，可作为任何登录/风控场景的降级数据源 */
export const SSR_BOOK_PAGE = '/page/';
export const SSR_READER_PAGE = '/reader/';
export const SSR_COMMENT_PAGE = '/comment/';

/** 官方 web 阅读器所需的查询参数（同源 APP 接口） */
export function appQuery(extra: Record<string, string> = {}): Record<string, string> {
  return {
    aid: '1967',
    app_name: 'novelapp',
    version_code: '57700',
    update_version_code: '57700',
    device_platform: 'web',
    ...extra,
  };
}

/* --------------------------- 网页端新增（实测可用） --------------------------- */

/** 书籍详情（App 网关同源，字段比 /api/reader/full/book/detail 更全，且不受网页端风控影响） */
export const BOOK_INFO = '/api/book/info';
/** 书库分类树（?gender=1 男生 / 0 女生，返回带封面与简介的分类列表） */
export const LIBRARY_CATEGORY_LIST = '/api/author/book/category_list/v0/';
/** 书库列表（8 个筛选参数必须齐全，否则返回 code=-2 参数有误） */
export const LIBRARY_BOOK_LIST = '/api/author/library/book_list/v0/';
/** 最近更新（返回 itemId/章节标题/更新时间，可做追更） */
export const RANK_RECENT_UPDATE = '/api/rank/recent/update/list';
/** 推荐榜（type=0 男频 / 1 女频） */
export const RANK_RECOMMEND = '/api/rank/recommend/list';
/** 出版好书 / 版权书单 */
export const PUBLICATION_LIST = '/api/node/publication/list';
export const COPYRIGHT_LIST = '/api/node/copyright/list';
/** 轻量目录：只返回 itemId 数组 */
export const DIRECTORY_IID = '/api/reader/directory/iid';

/**
 * 封面 CDN：详情接口只给带签名的 thumb_url（有 x-expires，过期就 403）和
 * 纯路径的 sourceUri，用「CDN/origin/ + sourceUri」可拼出**非签名**的长期地址。
 */
export const COVER_CDN = 'https://p6-novel.byteimg.com/origin/';
export function coverUrlFromPath(path: string | undefined): string {
  const p = String(path ?? '').trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return COVER_CDN + p.replace(/^\/+/, '');
}

/** 书库筛选取值（取自官网 bundle 的枚举，勿随意改动） */
export const LIBRARY_GENDER = { 女生: 0, 男生: 1 } as const;
export const LIBRARY_STATUS = { 全部: -1, 完结: 0, 连载: 1 } as const;
export const LIBRARY_WORD_COUNT = { 全部: -1, '30万以下': 0, '30-50万': 1, '50-100万': 2, '100-200万': 3 } as const;
export const LIBRARY_SORT = { 最热: 0, 最新: 1, 字数: 2 } as const;
export const LIBRARY_ALL = -1;

/* ------------------- App / H5 网关（H5 阅读器与书评页同款） ------------------- */

/**
 * App/H5 网关：H5 阅读器、书评页走的就是这套接口。
 * 两个特点：
 *  1. 返回值**不含 PUA 字体混淆**（网页端书库类接口的书名/摘要是混淆的）；
 *  2. **必须**带 ssdkQuery() 的公共参数，否则统一返回 {"code":0,"message":"invalid client"}。
 * 实测可用：书评分页、评分分布、搜索、分类书单/分类树、榜单、打赏信息。
 */
export const SSDK_HOST = 'https://novel.snssdk.com';

/** 该网关的公共查询参数（缺了会被判为 invalid client） */
export function ssdkQuery(extra: Record<string, string> = {}): Record<string, string> {
  return {
    aid: '1967',
    app_name: 'novelapp',
    device_platform: 'android',
    version_code: '57700',
    update_version_code: '57700',
    channel: '0',
    version_name: '5.7.7',
    ...extra,
  };
}

/** 书评（参数：book_id / page_number 从 1 开始 / page_count，可选 user_id） */
export const SSDK_BOOK_COMMENTS = '/api/novel/book/page/comments/all/info/v1/';
/** 评分概览（参数：book_id） */
export const SSDK_BOOK_SCORE = '/api/novel/book/page/comments/score/summary/v1/';
/** 搜索（参数名是 q，翻页用 count/offset，不是 page_index） */
export const SSDK_SEARCH = '/api/novel/channel/homepage/search/search/v1/';
/**
 * 该搜索接口**忽略 count**，固定每页 10 条，而且相邻两页会有 1 条重叠，
 * 所以：offset 按 10 步进，调用方需要按 book_id 去重。
 */
export const SSDK_SEARCH_PAGE_SIZE = 10;
/** 联想词 / 热搜 */
export const SSDK_SEARCH_SUGGEST = '/api/novel/channel/homepage/search/suggest/v1/';
export const SSDK_SEARCH_HOT = '/api/novel/channel/homepage/search/hot/v1/';
/** 分类树（boy_category / girl_category / publish_category / audio_category） */
export const SSDK_CATEGORY_TREE = '/api/novel/channel/homepage/new_category/page/data/v1/';
/** 分类书单（参数：category_id，固定返回 10 条，page_index 无效） */
export const SSDK_CATEGORY_BOOKS = '/api/novel/channel/homepage/new_category/book_list/v1/';
/** 榜单（明文） */
export const SSDK_RANK_LIST = '/api/novel/channel/homepage/rank/rank_list/v2/';
/** 打赏礼物与作者信息 */
export const SSDK_BOOK_PRAISE = '/api/novel/book/praise/info/v1/';
/** H5 阅读器/书评页所在域名（Referer 用） */
export const SSDK_REFERER = 'https://api.fanqiesdk.com/';

/** 排行接口业务参数 */
export const RANK_APP_ID = '2503';
export const RANK_LIST_TYPES: Record<string, number> = {
  推荐: 3,
  热读: 1,
  完结: 4,
  新书: 6,
  更新: 5,
  收藏: 2,
};
