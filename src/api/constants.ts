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
