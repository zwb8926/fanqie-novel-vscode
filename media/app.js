/* =========================================================
 * 番茄小说 Webview 前端（纯 JS，无框架）
 * 所有网络请求都通过 postMessage 转发到扩展宿主执行。
 * ========================================================= */
(function () {
  'use strict';

  var vscode = acquireVsCodeApi();
  /** 宿主类型：'panel'=编辑器标签页，'sidebar'=侧边栏视图 */
  var IS_SIDEBAR = document.body && document.body.dataset.host === 'sidebar';

  /** 侧边栏点击书籍 → 在编辑器标签页中打开阅读器（itemId 可选：续读历史章节） */
  function openBookInEditor(bookId, itemId) {
    var payload = { bookId: bookId, mode: 'reader' };
    if (itemId) payload.itemId = itemId;
    call('open-editor-book', payload).catch(function () { /* ignore */ });
  }

  /* ---------------- 消息封装 ---------------- */
  var msgId = 0;
  var pending = new Map();
  function call(type, payload) {
    return new Promise(function (resolve, reject) {
      var id = ++msgId;
      pending.set(id, { resolve: resolve, reject: reject });
      var m = { type: type, id: id };
      if (payload) Object.keys(payload).forEach(function (k) { m[k] = payload[k]; });
      vscode.postMessage(m);
      setTimeout(function () {
        if (pending.has(id)) { pending.delete(id); reject(new Error('请求超时，请重试')); }
      }, 90000);
    });
  }

  /* ---------------- 状态 ---------------- */
  var state = {
    view: 'bookstore',
    user: null,
    loggedIn: false,
    settings: { fontSize: 19, lineHeight: 1.9, theme: 'night', showBars: false, barsTouched: false },
    // 书城
    rankCats: [],
    rankCatsLoaded: false,
    rankType: 3,
    rankGender: 'male',
    rankCat: '',
    rankBooks: [],
    rankOffset: 0,
    rankLoading: false,
    rankHasMore: false,
    // 搜索
    query: '',
    searchPage: 0,
    searchBooks: [],
    searchTotal: 0,
    searching: false,
    // 书籍
    book: null,
    directory: null,
    // 阅读器
    inReader: false,
    readerBookId: null,
    readerBookTitle: '',
    chapters: [],
    chapterIdx: -1,
    chapter: null,
    pages: [],
    pageIdx: 0,
    readerLoading: false,
    readerError: null,
    // 抽屉
    drawer: null, // 'catalog' | 'comments' | null
    commentsKind: 'book',
    comments: [],
    commentsLoading: false,
    commentsError: null,
    settingsOpen: false,
    // 书架
    shelfLocal: [],
    shelfRemote: [],
    shelfLoading: false,
    // 登录
    qrSession: 0,
    qrUrl: null,
    qrText: null,
    qrStatusText: '未登录',
    qrStatusClass: '',
    qrWorking: false,
  };


  function saveState() {
    try { vscode.setState(state); } catch (e) { /* ignore */ }
  }
  var prevState = vscode.getState();
  // 只恢复安全的标量字段（settings），避免旧结构覆盖新结构
  if (prevState && prevState.settings) {
    state.settings = Object.assign(state.settings, prevState.settings);
  }

  /* ---------------- DOM 工具 ---------------- */
  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtWord(n) {
    n = Number(n || 0);
    if (!n) return '';
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万字';
    return n + '字';
  }
  function fmtCount(n) {
    n = Number(n || 0);
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return String(n);
  }
  function coverFallback(e) {
    e.onerror = null;
    e.src = '';
    e.style.background = 'linear-gradient(135deg,#ff6b3d,#ff3d2e)';
  }
  function statusText(cs) {
    if (cs === '0') return '完结';
    if (cs === '1') return '连载';
    if (cs === '4') return '断更';
    return '';
  }

  /* ---------------- 全局渲染 ---------------- */
  var app = document.getElementById('app');

  function applySettings() {
    document.documentElement.dataset.theme = state.settings.theme;
    var root = document.documentElement;
    root.style.setProperty('--reader-font-size', state.settings.fontSize + 'px');
    root.style.setProperty('--reader-line-height', String(state.settings.lineHeight));
  }

  function render() {
    applySettings();
    if (state.view === 'reader') {
      renderReader();
      return;
    }
    var nav = el('div', 'navbar');
    nav.appendChild(el('span', 'brand', '🍅 番茄小说'));
    var tab = function (id, label) {
      var b = el('button', 'nav-tab' + (state.view === id ? ' active' : ''), label);
      b.dataset.nav = id;
      return b;
    };
    nav.appendChild(tab('bookstore', '书城'));
    nav.appendChild(tab('search', '搜索'));
    nav.appendChild(tab('shelf', '书架'));
    nav.appendChild(el('span', 'spacer'));
    var userBtn = el('div', 'nav-user');
    userBtn.dataset.nav = 'login';
    if (state.user) {
      if (state.user.avatar) {
        var img = el('img');
        img.src = state.user.avatar;
        img.onerror = function () { img.style.display = 'none'; };
        userBtn.appendChild(img);
      } else {
        userBtn.appendChild(el('span', 'avatar-fallback', (state.user.name || '?').slice(0, 1)));
      }
      userBtn.appendChild(el('span', null, state.user.name || '已登录'));
    } else {
      userBtn.appendChild(el('span', 'avatar-fallback', '登'));
      userBtn.appendChild(el('span', null, '登录'));
    }
    nav.appendChild(userBtn);

    app.innerHTML = '';
    app.appendChild(nav);
    var view = el('div', 'view');
    view.id = 'view';
    app.appendChild(view);

    renderView();
  }


  function rerenderLogin() {
    var v = $('#view');
    if (v) v.innerHTML = '';
    renderView();
  }
  function renderView() {
    var view = $('#view');
    if (!view) return;
    view.innerHTML = '';
    switch (state.view) {
      case 'bookstore': renderBookstore(view); break;
      case 'search': renderSearch(view); break;
      case 'shelf': renderShelf(view); break;
      case 'login': renderLogin(view); break;
    }
  }

  /* ---------------- 书城 ---------------- */
  function renderBookstore(view) {
    if (!state.rankCatsLoaded) {
      view.appendChild(el('div', 'loading', '加载中…'));
      call('rank-categories', {}).then(function (cats) {
        state.rankCats = cats || [];
        state.rankCatsLoaded = true;
        renderView();
      }).catch(function (e) {
        view.innerHTML = '';
        view.appendChild(errBox(e.message));
      });
      return;
    }
    // 性别与榜单类型
    var genders = [{ v: 'male', l: '男频' }, { v: 'female', l: '女频' }];
    var types = [{ v: 3, l: '推荐' }, { v: 1, l: '热读' }, { v: 6, l: '新书' }, { v: 4, l: '完结' }, { v: 5, l: '更新' }];
    var chips = el('div', 'chips');
    genders.forEach(function (g) {
      var c = el('button', 'chip' + (state.rankGender === g.v ? ' active' : ''), g.l);
      c.dataset.gender = g.v;
      chips.appendChild(c);
    });
    chips.appendChild(el('span', 'spacer'));
    types.forEach(function (t) {
      var c = el('button', 'chip' + (state.rankType === t.v ? ' active' : ''), t.l);
      c.dataset.rankType = String(t.v);
      chips.appendChild(c);
    });
    view.appendChild(chips);
    // 分类
    var cats = state.rankCats.filter(function (c) { return c.group && c.group.indexOf(state.rankGender) >= 0; });
    if (cats.length) {
      var catChips = el('div', 'chips');
      var all = el('button', 'chip' + (!state.rankCat ? ' active' : ''), '全部');
      all.dataset.cat = '';
      catChips.appendChild(all);
      cats.slice(0, 24).forEach(function (c) {
        var b = el('button', 'chip' + (state.rankCat === c.id ? ' active' : ''), c.name);
        b.dataset.cat = c.id;
        catChips.appendChild(b);
      });
      view.appendChild(catChips);
    }
    var title = el('div', 'section-title', '排行榜');
    view.appendChild(title);
    var grid = el('div', 'book-grid');
    grid.id = 'rankGrid';
    view.appendChild(grid);
    renderRankGrid(grid);
    if (state.rankHasMore) {
      var more = el('button', 'btn secondary load-more', '加载更多');
      more.id = 'rankMore';
      view.appendChild(more);
    }
  }

  function renderRankGrid(grid) {
    if (state.rankLoading) {
      grid.innerHTML = '';
      grid.appendChild(el('div', 'loading', '加载中…'));
      return;
    }
    if (!state.rankBooks.length) {
      grid.innerHTML = '';
      grid.appendChild(el('div', 'empty', '暂无书籍'));
      return;
    }
    grid.innerHTML = '';
    state.rankBooks.forEach(function (b) {
      var card = el('div', 'book-card');
      card.dataset.bookId = b.bookId;
      var img = el('img', 'cover');
      img.loading = 'lazy';
      if (b.thumbUri) { img.src = b.thumbUri; img.onerror = coverFallback; }
      else img.style.background = 'linear-gradient(135deg,#ff6b3d,#ff3d2e)';
      var info = el('div', 'info');
      info.appendChild(el('div', 'title', b.bookName || '未知书名'));
      info.appendChild(el('div', 'meta', (b.author || '') + (Number(b.readCount) > 0 ? ' · ' + fmtCount(b.readCount) + '人在读' : '')));
      card.appendChild(img);
      card.appendChild(info);
      grid.appendChild(card);
    });
  }

  function loadRank(reset) {
    if (state.rankLoading) return;
    if (reset) { state.rankBooks = []; state.rankOffset = 0; }
    state.rankLoading = true;
    renderView();
    call('rank-list', {
      rankListType: state.rankType,
      categoryId: state.rankCat,
      gender: state.rankGender,
      offset: state.rankOffset,
      limit: 24,
    }).then(function (r) {
      var list = (r && r.book_list) || [];
      state.rankBooks = reset ? list : state.rankBooks.concat(list);
      state.rankOffset = state.rankBooks.length;
      state.rankHasMore = list.length >= 24;
      state.rankLoading = false;
      renderView();
    }).catch(function (e) {
      state.rankLoading = false;
      var grid = $('#rankGrid');
      if (grid) { grid.innerHTML = ''; grid.appendChild(errBox(e.message)); }
    });
  }

  /* ---------------- 搜索 ---------------- */
  function renderSearch(view) {
    var bar = el('div', 'search-bar');
    var input = el('input');
    input.id = 'searchInput';
    input.placeholder = '输入书名 / 作者，回车搜索';
    input.value = state.query;
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') doSearch(true);
    });
    var btn = el('button', 'btn', '搜索');
    btn.addEventListener('click', function () { doSearch(true); });
    bar.appendChild(input);
    bar.appendChild(btn);
    view.appendChild(bar);

    if (state.searching) {
      view.appendChild(el('div', 'loading', '搜索中…'));
      return;
    }
    if (state.searchBooks.length) {
      var list = el('div', 'search-list');
      state.searchBooks.forEach(function (b) {
        var row = el('div', 'row');
        row.dataset.bookId = b.book_id;
        var img = el('img', 'cover');
        if (b.thumb_url) { img.src = b.thumb_url; img.onerror = coverFallback; }
        else img.style.background = 'linear-gradient(135deg,#ff6b3d,#ff3d2e)';
        var right = el('div');
        right.style.flex = '1';
        right.style.minWidth = '0';
        var t = el('div', 't', b.book_name);
        var tags = el('div');
        var st = statusText(b.creation_status);
        if (st) tags.appendChild(el('span', 'tag', st));
        if (b.score) tags.appendChild(el('span', 'tag', '评分 ' + b.score));
        if (b.category) tags.appendChild(el('span', 'tag', b.category));
        var a = el('div', 'a', (b.author || '') + (fmtWord(b.word_number) ? ' · ' + fmtWord(b.word_number) : '') + (b.serial_count ? ' · ' + b.serial_count + '章' : ''));
        right.appendChild(t);
        right.appendChild(tags);
        right.appendChild(a);
        if (b.abstract) right.appendChild(el('div', 'abs', b.abstract));
        row.appendChild(img);
        row.appendChild(right);
        list.appendChild(row);
      });
      view.appendChild(list);
      if (state.searchBooks.length < state.searchTotal) {
        var more = el('button', 'btn secondary load-more', '加载更多');
        more.id = 'searchMore';
        view.appendChild(more);
      }
    } else if (state.query) {
      view.appendChild(el('div', 'empty', '没有找到相关书籍'));
    } else {
      view.appendChild(el('div', 'empty', '输入关键词开始搜索'));
    }
  }

  function doSearch(reset) {
    var input = $('#searchInput');
    if (input) state.query = input.value.trim();
    if (!state.query) return;
    if (reset) { state.searchPage = 0; state.searchBooks = []; }
    state.searching = true;
    renderView();
    call('search', { query: state.query, page: state.searchPage, pageSize: 10 }).then(function (r) {
      state.searchBooks = reset ? r.books : state.searchBooks.concat(r.books);
      state.searchTotal = r.total;
      state.searchPage = reset ? 1 : state.searchPage + 1;
      state.searching = false;
      renderView();
    }).catch(function (e) {
      state.searching = false;
      var view = $('#view');
      if (view) { view.innerHTML = ''; view.appendChild(errBox(e.message)); }
    });
  }

  /* ---------------- 书架 ---------------- */
  function renderShelf(view) {
    state.shelfLoading = true;
    Promise.all([
      call('shelf-local-get', {}),
      call('shelf-remote-get', {}),
    ]).then(function (rs) {
      state.shelfLocal = rs[0] || [];
      state.shelfRemote = (rs[1] && rs[1].entries) || [];
      state.shelfLoading = false;
      view.innerHTML = '';
      var sec = el('div', 'section-title', '本地书架');
      view.appendChild(sec);
      var grid = el('div', 'shelf-grid');
      if (state.shelfLocal.length) {
        state.shelfLocal.forEach(function (it) {
          var item = el('div', 'shelf-item');
          item.dataset.bookId = it.bookId;
          item.dataset.itemId = it.lastReadItemId || '';
          var img = el('img', 'cover');
          if (it.coverUrl) { img.src = it.coverUrl; img.onerror = coverFallback; }
          else img.style.background = 'linear-gradient(135deg,#ff6b3d,#ff3d2e)';
          img.dataset.bookId = it.bookId;
          var rm = el('button', 'remove', '✕');
          rm.dataset.remove = it.bookId;
          var title = el('div', 'title', it.title || it.bookId);
          title.dataset.bookId = it.bookId;
          item.appendChild(rm);
          item.appendChild(img);
          item.appendChild(title);
          if (it.lastReadChapterTitle) {
            var rd = el('div', 'reading', '读到：' + it.lastReadChapterTitle);
            rd.dataset.bookId = it.bookId;
            item.appendChild(rd);
          } else {
            item.appendChild(el('div', 'meta', it.author || ''));
          }
          grid.appendChild(item);
        });
      } else {
        grid.appendChild(el('div', 'empty', '书架为空，在书城或搜索中添加书籍'));
      }
      view.appendChild(grid);
      if (state.loggedIn) {
        view.appendChild(el('div', 'section-title', '云端书架'));
        var grid2 = el('div', 'shelf-grid');
        if (state.shelfRemote.length) {
          state.shelfRemote.forEach(function (it) {
            var item = el('div', 'shelf-item');
            item.dataset.bookId = it.book_id;
            item.dataset.itemId = it.last_read_item_id || '';
            var img = el('img', 'cover');
            if (it.cover_url) { img.src = it.cover_url; img.onerror = coverFallback; }
            else img.style.background = 'linear-gradient(135deg,#888,#aaa)';
            img.dataset.bookId = it.book_id;
            var t = el('div', 'title', it.title || it.book_id);
            t.dataset.bookId = it.book_id;
            item.appendChild(img);
            item.appendChild(t);
            if (it.current_chapter_title) {
              var rd = el('div', 'reading', '读到：' + it.current_chapter_title);
              rd.dataset.bookId = it.book_id;
              item.appendChild(rd);
            } else if (it.author) {
              item.appendChild(el('div', 'meta', it.author));
            }
            grid2.appendChild(item);
          });
        } else {
          grid2.appendChild(el('div', 'empty', '云端书架为空'));
        }
        view.appendChild(grid2);
      } else {
        view.appendChild(el('div', 'section-title', '云端书架'));
        view.appendChild(el('div', 'empty', '登录后可同步云端书架'));
      }
    }).catch(function (e) {
      view.innerHTML = '';
      view.appendChild(errBox(e.message));
    });
  }

  /* ---------------- 登录 / 个人信息 ---------------- */
  function renderLogin(view) {
    var wrap = el('div', 'login-wrap');
    wrap.appendChild(el('h2', null, state.loggedIn ? '个人信息' : '登录番茄小说'));
    if (state.loggedIn && state.user) {
      var card = el('div', 'user-card');
      if (state.user.avatar) {
        var img = el('img');
        img.src = state.user.avatar;
        img.onerror = function () { img.style.display = 'none'; };
        card.appendChild(img);
      }
      var right = el('div');
      right.appendChild(el('div', 'name', state.user.name || '已登录'));
      if (state.user.desc) right.appendChild(el('div', 'desc', state.user.desc));
      card.appendChild(right);
      wrap.appendChild(card);
      var logout = el('button', 'btn secondary', '退出登录');
      logout.id = 'logoutBtn';
      wrap.appendChild(logout);
    } else {
      wrap.appendChild(renderQrLogin());
    }
    view.appendChild(wrap);
    renderHistory(view);
  }

  /* ---------------- 历史记录（本地） ---------------- */
  function renderHistory(view) {
    var sec = el('div', 'history-sec');
    sec.appendChild(el('div', 'section-title', '历史记录'));
    var box = el('div', 'history-list');
    box.id = 'historyList';
    box.appendChild(el('div', 'loading', '加载中…'));
    sec.appendChild(box);
    view.appendChild(sec);
    call('history-get', {}).then(function (items) {
      box.innerHTML = '';
      if (!items || !items.length) {
        box.appendChild(el('div', 'empty', '暂无历史记录，打开一本书开始记录'));
        return;
      }
      items.forEach(function (h) {
        var row = el('div', 'history-item');
        var img = el('img', 'cover');
        if (h.coverUrl) { img.src = h.coverUrl; img.onerror = coverFallback; }
        else img.style.background = 'linear-gradient(135deg,#ff6b3d,#ff3d2e)';
        var info = el('div', 'hi-info');
        info.appendChild(el('div', 'title', h.title || h.bookId));
        if (h.chapterTitle) info.appendChild(el('div', 'chap', '读到：' + h.chapterTitle));
        else if (h.author) info.appendChild(el('div', 'meta', h.author));
        var time = el('div', 'time', fmtTime(h.readAt));
        row.appendChild(img);
        row.appendChild(info);
        row.appendChild(time);
        row.dataset.bookId = h.bookId;
        row.dataset.itemId = h.itemId || '';
        box.appendChild(row);
      });
    }).catch(function (e) {
      box.innerHTML = '';
      box.appendChild(errBox(e.message));
    });
  }

  /* ---------------- 扫码登录 ---------------- */
  function renderQrLogin() {
    var box = el('div');
    var sub = el('div', 'sub', '使用抖音 / 番茄小说 App 扫码，即可同步书架与阅读进度');
    box.appendChild(sub);
    var qrBox = el('div', 'qr-box');
    qrBox.id = 'qrBox';
    if (state.qrUrl) {
      var img = el('img');
      img.id = 'qrImg';
      img.src = state.qrUrl;
      img.onerror = function () { img.style.display = 'none'; showQrFallback(qrBox); };
      qrBox.appendChild(img);
    } else if (state.qrText) {
      renderQrText(qrBox, state.qrText);
    } else {
      qrBox.appendChild(el('div', 'placeholder', '点击下方按钮生成二维码'));
    }
    box.appendChild(qrBox);
    var status = el('div', 'qr-status' + (state.qrStatusClass ? ' ' + state.qrStatusClass : ''), state.qrStatusText);
    status.id = 'qrStatus';
    box.appendChild(status);
    var actions = el('div');
    var startBtn = el('button', 'btn', state.qrWorking ? '生成中…' : '开始扫码登录');
    startBtn.id = 'qrStart';
    if (state.qrWorking) startBtn.disabled = true;
    var refreshBtn = el('button', 'btn ghost', '刷新二维码');
    refreshBtn.id = 'qrRefresh';
    actions.appendChild(startBtn);
    actions.appendChild(refreshBtn);
    box.appendChild(actions);
    return box;
  }

  function renderQrText(box, text) {
    try {
      if (typeof qrcode !== 'function') throw new Error('no qrcode lib');
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      var img = el('img');
      img.src = qr.createDataURL(8, 8);
      box.appendChild(img);
    } catch (e) {
      box.appendChild(el('div', 'placeholder', '二维码内容：' + text));
    }
  }
  function showQrFallback(box) {
    if (state.qrText) renderQrText(box, state.qrText);
    else {
      box.innerHTML = '';
      box.appendChild(el('div', 'placeholder', '二维码图片加载失败，请刷新'));
    }
  }

  function startQr() {
    state.qrWorking = true;
    state.qrUrl = null;
    state.qrText = null;
    state.qrStatusText = '正在获取二维码…';
    state.qrStatusClass = '';
    renderView();
    call('qr-start', {}).then(function (r) {
      state.qrSession = r.session || (state.qrSession || 0) + 1;
      state.qrWorking = false;
      state.qrUrl = r.qrUrl || null;
      state.qrText = r.qrText || null;
      state.qrStatusText = '请使用抖音 / 番茄小说 App 扫码，并在手机上确认登录';
      renderView();
    }).catch(function (e) {
      state.qrWorking = false;
      state.qrStatusText = e.message;
      state.qrStatusClass = 'err';
      renderView();
    });
  }

  /* ---------------- 书籍详情 ---------------- */
  function showBookModal(bookId) {
    var mask = el('div', 'modal-mask');
    mask.id = 'bookModal';
    var modal = el('div', 'modal');
    modal.appendChild(el('div', 'loading', '加载中…'));
    mask.appendChild(modal);
    document.body.appendChild(mask);
    call('book-detail', { bookId: bookId }).then(function (b) {
      modal.innerHTML = '';
      var top = el('div', 'top');
      var img = el('img', 'cover');
      if (b.thumb_url) { img.src = b.thumb_url; img.onerror = coverFallback; }
      else img.style.background = 'linear-gradient(135deg,#ff6b3d,#ff3d2e)';
      var right = el('div');
      right.style.flex = '1';
      right.style.minWidth = '0';
      right.appendChild(el('div', 'title', b.book_name));
      var meta = el('div', 'meta');
      var st = statusText(b.creation_status);
      var parts = [];
      if (st) parts.push('状态：' + st);
      if (b.author) parts.push('作者：' + b.author);
      if (fmtWord(b.word_number)) parts.push(fmtWord(b.word_number));
      if (b.serial_count) parts.push(b.serial_count + '章');
      if (b.score) parts.push('评分：' + b.score);
      meta.textContent = parts.join(' · ');
      right.appendChild(meta);
      top.appendChild(img);
      top.appendChild(right);
      modal.appendChild(top);
      if (b.abstract) modal.appendChild(el('div', 'abstract', b.abstract));
      var actions = el('div', 'actions');
      var read = el('button', 'btn', '开始阅读');
      read.id = 'readBtn';
      read.dataset.bookId = b.book_id;
      var shelfBtn = el('button', 'btn secondary', '加入书架');
      shelfBtn.id = 'shelfAddBtn';
      shelfBtn.dataset.bookId = b.book_id;
      actions.appendChild(read);
      actions.appendChild(shelfBtn);
      modal.appendChild(actions);
      state.bookCoverUrl = b.thumb_url || '';
    }).catch(function (e) {
      modal.innerHTML = '';
      modal.appendChild(errBox(e.message));
    });
  }

  /* ---------------- 阅读器 ---------------- */
  function enterReader(bookId, bookTitle, resumeItemId) {
    state.view = 'reader';
    state.inReader = true;
    state.readerBookId = bookId;
    state.readerBookTitle = bookTitle || state.readerBookTitle || '';
    state.chapter = null;
    state.pages = [];
    state.pageIdx = 0;
    state.chapters = [];
    state.chapterIdx = -1;
    state.readerError = null;
    state.drawer = null;
    state.settingsOpen = false;
    render();
    // 加载目录
    call('directory', { bookId: bookId }).then(async function (d) {
      state.directory = d;
      var chapters = [];
      (d.volumes || []).forEach(function (v) {
        (v.chapters || []).forEach(function (c) {
          c.volume_name = v.volume_name;
          chapters.push(c);
        });
      });
      if (!chapters.length) {
        (d.allItemIds || []).forEach(function (id, i) { chapters.push({ itemId: id, title: '第' + (i + 1) + '章' }); });
      }
      state.chapters = chapters;
      // 刷新本地书架，保证续读数据最新
      try {
        var freshShelf = await call('shelf-local-get', {});
        state.shelfLocal = freshShelf || [];
      } catch (e) { /* 失败继续用旧数据 */ }
      // 恢复进度：历史续读优先，其次本地书架，再本地历史记录
      var resume = null;
      if (resumeItemId) {
        var hidx = chapters.findIndex(function (c) { return c.itemId === resumeItemId; });
        if (hidx >= 0) resume = { idx: hidx, itemId: resumeItemId };
      }
      if (!resume) {
        var shelfItem = state.shelfLocal.find(function (i) { return i.bookId === bookId; });
        if (shelfItem && shelfItem.lastReadItemId) {
          var idx = chapters.findIndex(function (c) { return c.itemId === shelfItem.lastReadItemId; });
          if (idx >= 0) resume = { idx: idx, itemId: shelfItem.lastReadItemId };
        }
      }
      if (!resume) {
        try {
          var hist = await call('history-get', {});
          var h = (hist || []).find(function (x) { return x.bookId === bookId; });
          if (h && h.itemId) {
            var hidx2 = chapters.findIndex(function (c) { return c.itemId === h.itemId; });
            if (hidx2 >= 0) resume = { idx: hidx2, itemId: h.itemId };
          }
        } catch (e) { /* 可选兜底 */ }
      }
      if (resume) {
        state.chapterIdx = resume.idx;
        openChapter(resume.itemId, resume.idx, false);
      } else if (chapters.length) {
        state.chapterIdx = 0;
        openChapter(chapters[0].itemId, 0, false);
      } else {
        state.readerError = '目录为空';
        renderReader();
      }
    }).catch(function (e) {
      state.readerError = e.message;
      renderReader();
    });
  }

  var chapterCache = new Map();

  function openChapter(itemId, idx, needRender) {
    state.readerLoading = true;
    state.readerError = null;
    if (needRender !== false) renderReader();
    var cached = chapterCache.get(itemId);
    var p = cached ? Promise.resolve(cached) : call('chapter', { itemId: itemId }).then(function (c) {
      chapterCache.set(itemId, c);
      return c;
    });
    p.then(function (c) {
      state.chapter = c;
      if (idx >= 0) state.chapterIdx = idx;
      state.pages = paginate(c.paragraphs || []);
      state.pageIdx = 0;
      state.readerLoading = false;
      saveReadingProgress(c);
      renderReader();
      prefetchNext(c);
    }).catch(function (e) {
      state.readerLoading = false;
      state.readerError = e.message;
      renderReader();
    });
  }

  function prefetchNext(c) {
    if (c && c.nextItemId && !chapterCache.has(c.nextItemId)) {
      setTimeout(function () {
        call('chapter', { itemId: c.nextItemId }).then(function (nc) { chapterCache.set(nc.itemId, nc); }).catch(function () { /* ignore */ });
      }, 2500);
    }
  }

  function saveReadingProgress(c) {
    if (!state.readerBookId) return;
    var idx = state.shelfLocal.findIndex(function (i) { return i.bookId === state.readerBookId; });
    var cover = state.bookCoverUrl || (idx >= 0 ? state.shelfLocal[idx].coverUrl : '') || '';
    var item = {
      bookId: state.readerBookId,
      title: state.readerBookTitle || c.bookName || state.readerBookId,
      author: c.author || '',
      coverUrl: cover,
      addedAt: idx >= 0 ? state.shelfLocal[idx].addedAt : Date.now(),
      lastReadItemId: c.itemId,
      lastReadChapterTitle: c.title,
      lastReadAt: Date.now(),
    };
    if (idx >= 0) state.shelfLocal[idx] = item;
    else state.shelfLocal.unshift(item);
    call('shelf-local-set', { items: state.shelfLocal }).catch(function () { /* ignore */ });
    // 记录历史（本地，无需登录）
    call('history-record', {
      bookId: state.readerBookId,
      title: state.readerBookTitle || c.bookName || state.readerBookId,
      author: c.author || '',
      coverUrl: cover,
      itemId: c.itemId,
      chapterTitle: c.title,
      order: Number(c.realChapterOrder || c.order || 0),
    }).catch(function () { /* ignore */ });
    if (state.loggedIn) {
      call('progress-update', {
        bookId: state.readerBookId,
        itemId: c.itemId,
        order: Number(c.realChapterOrder || c.order || 0),
      }).catch(function () { /* ignore */ });
    }
  }

  function renderReader() {
    applySettings();
    var showBars = state.settings.showBars !== false;
    app.innerHTML = '';
    if (showBars) {
      var nav = el('div', 'navbar');
      var back = el('button', 'btn ghost', '‹ 返回');
      back.id = 'readerBack';
      nav.appendChild(back);
      nav.appendChild(el('span', 'brand', '🍅 阅读'));
      nav.appendChild(el('span', 'spacer'));
      var catalogBtn = el('button', 'nav-tab', '目录');
      catalogBtn.id = 'catalogBtn';
      nav.appendChild(catalogBtn);
      var bookCmtBtn = el('button', 'nav-tab', '书评');
      bookCmtBtn.id = 'bookCommentsBtn';
      nav.appendChild(bookCmtBtn);
      var settingsBtn = el('button', 'nav-tab', '设置');
      settingsBtn.id = 'settingsBtn';
      nav.appendChild(settingsBtn);
      app.appendChild(nav);
    }
    var reader = el('div', 'reader');
    reader.id = 'reader';
    reader.classList.toggle('immersive', !showBars);
    // 标题栏
    if (showBars) {
      var bar = el('div', 'reader-bar');
      var titles = el('div', 'titles');
      titles.appendChild(el('div', 'bt', (state.chapter && state.chapter.title) || state.readerBookTitle || '加载中…'));
      titles.appendChild(el('div', 'bs',
        (state.readerBookTitle || '') +
        (state.chapter && state.chapter.realChapterOrder ? ' · 第' + state.chapter.realChapterOrder + '章' : '') +
        (state.chapter && state.chapter.chapterWordNumber ? ' · ' + fmtWord(state.chapter.chapterWordNumber) : '')));
      bar.appendChild(titles);
      reader.appendChild(bar);
    }
    // 内容
    var content = el('div', 'reader-content');
    content.id = 'readerContent';
    reader.appendChild(content);
    // 底部
    if (showBars) {
      var footer = el('div', 'reader-footer');
      var prevC = el('button', 'btn ghost', '上一章');
      prevC.id = 'prevChapter';
      var prevP = el('button', 'btn', '‹ 上一页');
      prevP.id = 'prevPage';
      var info = el('div', 'page-info');
      info.id = 'pageInfo';
      var nextP = el('button', 'btn', '下一页 ›');
      nextP.id = 'nextPage';
      var nextC = el('button', 'btn ghost', '下一章');
      nextC.id = 'nextChapter';
      footer.appendChild(prevC);
      footer.appendChild(prevP);
      footer.appendChild(info);
      footer.appendChild(nextP);
      footer.appendChild(nextC);
      reader.appendChild(footer);
    }
    app.appendChild(reader);
    renderPage();

    if (state.readerLoading) {
      var ld = el('div', 'reader-loading', '加载中…');
      ld.id = 'readerLoading';
      content.appendChild(ld);
    } else if (state.readerError) {
      var eb = errBox(state.readerError);
      eb.className = 'err-box reader-loading';
      eb.style.position = 'absolute';
      content.appendChild(eb);
    }
    // 目录抽屉
    if (state.drawer === 'catalog') renderCatalogDrawer(reader);
    if (state.drawer === 'comments') renderCommentsDrawer(reader);
    if (state.settingsOpen) renderSettingsPop(reader);
  }

  /** 分页：把段落列表切分为适合一屏的页 */
  function paginate(paragraphs) {
    if (!paragraphs || !paragraphs.length) return [];
    var content = $('#readerContent');
    if (!content) return [paragraphs.map(function (p, i) { return { text: p, idx: i }; })];
    var pageH = content.clientHeight - 22;
    if (pageH < 100) pageH = 400;
    // 测量容器：与真实页同宽同样式
    var wrap = el('div', 'page-wrap');
    wrap.style.position = 'absolute';
    wrap.style.visibility = 'hidden';
    wrap.style.pointerEvents = 'none';
    wrap.style.left = '0';
    wrap.style.right = '0';
    wrap.style.top = '0';
    var page = el('div', 'page');
    page.style.minHeight = '0';
    page.style.height = 'auto';
    wrap.appendChild(page);
    content.appendChild(wrap);

    var paras = paragraphs.map(function (t, i) { return { text: t, idx: i }; });
    var pages = [];
    var fits = function (list) {
      page.innerHTML = '';
      list.forEach(function (p) {
        var pe = el('p', 'para-click');
        pe.textContent = p.text;
        page.appendChild(pe);
      });
      return page.scrollHeight <= pageH;
    };
    var fitsChar = function (text) {
      page.innerHTML = '';
      var pe = el('p', 'para-click');
      pe.textContent = text;
      page.appendChild(pe);
      return page.scrollHeight <= pageH;
    };
    var i = 0;
    var n = paras.length;
    while (i < n) {
      var lo = i + 1, hi = n, best = i;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (fits(paras.slice(i, mid))) { best = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      if (best > i) {
        pages.push(paras.slice(i, best));
        i = best;
      } else {
        // 单个段落超长：按字符切分
        var text = paras[i].text;
        var idx = paras[i].idx;
        var start = 0;
        while (start < text.length) {
          var a = start + 1, b = text.length, bestC = start;
          while (a <= b) {
            var midc = (a + b) >> 1;
            if (fitsChar(text.slice(start, midc))) { bestC = midc; a = midc + 1; }
            else b = midc - 1;
          }
          if (bestC <= start) bestC = start + 1;
          pages.push([{ text: text.slice(start, bestC), idx: idx }]);
          start = bestC;
        }
        i++;
      }
    }
    wrap.remove();
    return pages;
  }

  function renderPage() {
    var content = $('#readerContent');
    if (!content) return;
    // 清除非页面元素
    $$('.page-wrap', content).forEach(function (w) { w.remove(); });
    $$('.reader-loading', content).forEach(function (w) { w.remove(); });
    var pages = state.pages;
    if (!pages.length) {
      var eb = errBox('章节内容为空');
      eb.className = 'err-box reader-loading';
      eb.style.position = 'absolute';
      content.appendChild(eb);
      return;
    }
    var pIdx = Math.max(0, Math.min(state.pageIdx, pages.length - 1));
    state.pageIdx = pIdx;
    var wrap = el('div', 'page-wrap');
    wrap.id = 'pageWrap';
    var page = el('div', 'page');
    var cur = pages[pIdx] || [];
    cur.forEach(function (p) {
      var pe = el('p', 'para-click');
      pe.textContent = p.text;
      pe.dataset.paraIdx = String(p.idx);
      page.appendChild(pe);
    });
    wrap.appendChild(page);
    content.appendChild(wrap);
    wrap.scrollTop = 0;
    var info = $('#pageInfo');
    if (info) info.textContent = (pIdx + 1) + ' / ' + pages.length;
  }

  function navPage(delta) {
    if (state.readerLoading || !state.pages.length) return;
    var next = state.pageIdx + delta;
    if (next < 0) {
      prevChapter();
      return;
    }
    if (next >= state.pages.length) {
      nextChapter();
      return;
    }
    state.pageIdx = next;
    renderPage();
  }

  function prevChapter() {
    if (state.chapterIdx > 0 && state.chapters.length) {
      state.chapterIdx--;
      openChapter(state.chapters[state.chapterIdx].itemId, state.chapterIdx);
    } else if (state.chapter && state.chapter.preItemId) {
      openChapter(state.chapter.preItemId, -1);
    }
  }

  function nextChapter() {
    if (state.chapterIdx >= 0 && state.chapterIdx < state.chapters.length - 1) {
      state.chapterIdx++;
      openChapter(state.chapters[state.chapterIdx].itemId, state.chapterIdx);
    } else if (state.chapter && state.chapter.nextItemId) {
      openChapter(state.chapter.nextItemId, -1);
    }
  }

  /* ---------------- 目录抽屉 ---------------- */
  function renderCatalogDrawer(root) {
    var drawer = el('div', 'drawer');
    drawer.id = 'catalogDrawer';
    var head = el('div', 'drawer-head');
    head.appendChild(el('span', null, '目录（' + (state.chapters.length || 0) + '章）'));
    var close = el('button', null, '✕');
    close.id = 'closeDrawer';
    head.appendChild(close);
    drawer.appendChild(head);
    var body = el('div', 'drawer-body');
    var vols = state.directory ? state.directory.volumes : [];
    if (vols.length) {
      vols.forEach(function (v) {
        body.appendChild(el('div', 'volume', v.volume_name || '正文'));
        v.chapters.forEach(function (c) {
          var d = el('div', 'chap' + (c.itemId === (state.chapter && state.chapter.itemId) ? ' active' : ''),
            (c.needPay ? '🔒 ' : '') + c.title);
          d.dataset.itemId = c.itemId;
          body.appendChild(d);
        });
      });
    } else {
      state.chapters.forEach(function (c) {
        var d = el('div', 'chap' + (c.itemId === (state.chapter && state.chapter.itemId) ? ' active' : ''), c.title);
        d.dataset.itemId = c.itemId;
        body.appendChild(d);
      });
    }
    drawer.appendChild(body);
    root.appendChild(drawer);
    requestAnimationFrame(function () { drawer.classList.add('open'); });
  }

  /* ---------------- 书评 ---------------- */
  function loadBookComments() {
    var p = call('book-comments', { bookId: state.readerBookId, limit: 12 });
    p.then(function (r) {
      state.comments = (r && r.comments) || [];
      state.commentsLoading = false;
      renderCommentsDrawer($('#reader'));
    }).catch(function (e) {
      state.commentsLoading = false;
      state.commentsError = e.message;
      renderCommentsDrawer($('#reader'));
    });
  }

  function renderCommentsDrawer(root) {
    if (!root) return;
    var old = $('#commentsDrawer');
    if (old) old.remove();
    var drawer = el('div', 'drawer comment-drawer');
    drawer.id = 'commentsDrawer';
    var head = el('div', 'drawer-head');
    head.appendChild(el('span', null, '书评'));
    var close = el('button', null, '✕');
    close.id = 'closeDrawer';
    head.appendChild(close);
    drawer.appendChild(head);
    var body = el('div', 'drawer-body');
    if (state.commentsLoading) {
      body.appendChild(el('div', 'loading', '加载评论中…'));
    } else if (state.commentsError) {
      var eb = errBox(state.commentsError);
      body.appendChild(eb);
    } else if (!state.comments.length) {
      body.appendChild(el('div', 'empty', '暂无评论'));
    } else {
      state.comments.forEach(function (c) {
        var item = el('div', 'comment-item');
        var head2 = el('div', 'c-head');
        if (c.avatar) {
          var av = el('img', 'c-avatar');
          av.src = c.avatar;
          av.onerror = function () { av.style.display = 'none'; };
          head2.appendChild(av);
        }
        head2.appendChild(el('span', 'c-name', c.nick_name || '匿名'));
        head2.appendChild(el('span', 'c-time', fmtTime(c.create_time)));
        item.appendChild(head2);
        item.appendChild(el('div', 'c-text', c.text));
        var stat = [];
        if (c.book_title) stat.push('评论《' + c.book_title + '》');
        if (c.score) stat.push('评分 ' + c.score);
        if (c.digg_count) stat.push('👍 ' + fmtCount(c.digg_count));
        if (c.reply_count) stat.push('💬 ' + fmtCount(c.reply_count));
        if (stat.length) item.appendChild(el('div', 'c-stat', stat.join(' · ')));
        body.appendChild(item);
      });
    }
    drawer.appendChild(body);
    root.appendChild(drawer);
    requestAnimationFrame(function () { drawer.classList.add('open'); });
  }

  /* ---------------- 设置 ---------------- */
  function renderSettingsPop(root) {
    var old = $('#settingsPop');
    if (old) old.remove();
    var pop = el('div', 'settings-pop');
    pop.id = 'settingsPop';
    var s = state.settings;
    var row1 = el('div', 'row');
    row1.appendChild(el('span', null, '字号'));
    var fs = el('input');
    fs.type = 'range';
    fs.min = '13';
    fs.max = '28';
    fs.step = '1';
    fs.value = String(s.fontSize);
    fs.id = 'fontSizeRange';
    row1.appendChild(fs);
    pop.appendChild(row1);
    var row2 = el('div', 'row');
    row2.appendChild(el('span', null, '行距'));
    var lh = el('input');
    lh.type = 'range';
    lh.min = '1.4';
    lh.max = '2.6';
    lh.step = '0.1';
    lh.value = String(s.lineHeight);
    lh.id = 'lineHeightRange';
    row2.appendChild(lh);
    pop.appendChild(row2);
    var row3 = el('div', 'row');
    row3.appendChild(el('span', null, '主题'));
    var sw = el('div', 'theme-switch');
    [['sepia', '羊皮纸'], ['day', '白天'], ['night', '夜间']].forEach(function (t) {
      var c = el('button', 'chip' + (s.theme === t[0] ? ' active' : ''), t[1]);
      c.dataset.theme = t[0];
      sw.appendChild(c);
    });
    row3.appendChild(sw);
    pop.appendChild(row3);
    var row4 = el('div', 'row');
    row4.appendChild(el('span', null, '工具栏'));
    var swB = el('div', 'theme-switch');
    var on = el('button', 'chip' + (s.showBars !== false ? ' active' : ''), '显示');
    on.dataset.showBars = '1';
    var off = el('button', 'chip' + (s.showBars === false ? ' active' : ''), '隐藏');
    off.dataset.showBars = '0';
    swB.appendChild(on);
    swB.appendChild(off);
    row4.appendChild(swB);
    pop.appendChild(row4);
    var hint = el('div', 'key-hint', '键盘：←/→ 翻页 · Ctrl+←/→ 切换章节 · 点击正文：左右翻页、中间切换工具栏');
    pop.appendChild(hint);
    root.appendChild(pop);
  }

  /* ---------------- 事件委托 ---------------- */
  function removeReaderOverlays() {
    ['#catalogDrawer', '#commentsDrawer', '#settingsPop'].forEach(function (sel) {
      var e = $(sel);
      if (e) e.remove();
    });
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var nav = t.closest ? t.closest('[data-nav]') : null;
    if (nav) {
      var target = nav.dataset.nav;
      if (target === 'login') {
        state.view = 'login';
        render();
        return;
      }
      if (state.view === 'reader' && target !== 'bookstore') {
        // 阅读器内切换到其他视图
        state.inReader = false;
        state.view = target;
        render();
        return;
      }
      state.view = target;
      // 用 render() 全量重建（含 navbar），保证选中状态同步切换
      render();
      if (target === 'shelf') renderShelf($('#view'));
      if (target === 'bookstore' && !state.rankBooks.length && !state.rankLoading) loadRank(true);
      return;
    }
    var gender = t.closest ? t.closest('[data-gender]') : null;
    if (gender) {
      state.rankGender = gender.dataset.gender;
      state.rankCat = '';
      loadRank(true);
      return;
    }
    var rankType = t.closest ? t.closest('[data-rankType]') : null;
    if (rankType) {
      state.rankType = Number(rankType.dataset.rankType);
      loadRank(true);
      return;
    }
    var cat = t.closest ? t.closest('[data-cat]') : null;
    if (cat) {
      state.rankCat = cat.dataset.cat;
      loadRank(true);
      return;
    }
    var more = t.closest ? t.closest('#rankMore') : null;
    if (more) { loadRank(false); return; }
    var searchMore = t.closest ? t.closest('#searchMore') : null;
    if (searchMore) { doSearch(false); return; }
    var card = t.closest ? t.closest('.book-card') : null;
    if (card) {
      if (IS_SIDEBAR) { openBookInEditor(card.dataset.bookId); } else { showBookModal(card.dataset.bookId); }
      return;
    }
    var row = t.closest ? t.closest('.search-list .row') : null;
    if (row) {
      if (IS_SIDEBAR) { openBookInEditor(row.dataset.bookId); } else { showBookModal(row.dataset.bookId); }
      return;
    }
    var shelfCover = t.closest ? t.closest('.shelf-item [data-bookId]') : null;
    if (shelfCover && state.view === 'shelf') {
      var bookId = shelfCover.dataset.bookId;
      var resumeId = shelfCover.closest('.shelf-item').dataset.itemId || '';
      if (IS_SIDEBAR) { openBookInEditor(bookId, resumeId); return; }
      var local = state.shelfLocal.find(function (i) { return i.bookId === bookId; });
      enterReader(bookId, local ? local.title : bookId, resumeId);
      return;
    }
    var rm = t.closest ? t.closest('[data-remove]') : null;
    if (rm && state.view === 'shelf') {
      ev.stopPropagation();
      call('shelf-remove', { bookId: rm.dataset.remove }).then(function () {
        state.shelfLocal = state.shelfLocal.filter(function (i) { return i.bookId !== rm.dataset.remove; });
        renderShelf($('#view'));
      });
      return;
    }
    // 历史记录：点击条目续读
    var histItem = t.closest ? t.closest('.history-item') : null;
    if (histItem && state.view === 'login') {
      var hBookId = histItem.dataset.bookId;
      var hItemId = histItem.dataset.itemId;
      if (IS_SIDEBAR) {
        openBookInEditor(hBookId, hItemId);
      } else {
        enterReader(hBookId, '', hItemId);
      }
      return;
    }
    // 书籍弹窗
    if (t.id === 'readBtn') {
      document.getElementById('bookModal') && document.getElementById('bookModal').remove();
      if (IS_SIDEBAR) {
        openBookInEditor(t.dataset.bookId);
      } else {
        enterReader(t.dataset.bookId, '');
      }
      return;
    }
    if (t.id === 'shelfAddBtn') {
      t.disabled = true;
      t.textContent = '添加中…';
      call('shelf-add', { bookId: t.dataset.bookId }).then(function (r) {
        t.textContent = r.remoteOk ? '已加入（含云端）' : '已加入本地书架';
        refreshShelfCache();
      }).catch(function (e) {
        t.textContent = '添加失败：' + e.message;
      });
      return;
    }
    var modalMask = t.closest ? t.closest('#bookModal') : null;
    if (modalMask && t === modalMask) modalMask.remove();

    // 阅读器
    if (state.view === 'reader') {
      if (t.id === 'readerBack') {
        state.inReader = false;
        state.view = 'bookstore';
        render();
        if (!state.rankBooks.length && !state.rankLoading) loadRank(true);
        return;
      }
      if (t.id === 'catalogBtn') {
        // 局部开合目录抽屉，不重建阅读器（避免闪烁）
        if (state.drawer === 'catalog') { state.drawer = null; removeReaderOverlays(); }
        else {
          state.drawer = 'catalog';
          state.settingsOpen = false;
          removeReaderOverlays();
          renderCatalogDrawer($('#reader'));
        }
        return;
      }
      if (t.id === 'bookCommentsBtn') {
        // 局部开合书评抽屉
        if (state.drawer === 'comments') { state.drawer = null; removeReaderOverlays(); }
        else {
          state.drawer = 'comments';
          state.settingsOpen = false;
          removeReaderOverlays();
          state.comments = [];
          state.commentsLoading = true;
          state.commentsError = null;
          renderCommentsDrawer($('#reader'));
          loadBookComments();
        }
        return;
      }
      if (t.id === 'settingsBtn') {
        // 局部开合设置面板
        if (state.settingsOpen) { state.settingsOpen = false; removeReaderOverlays(); }
        else {
          state.settingsOpen = true;
          state.drawer = null;
          removeReaderOverlays();
          renderSettingsPop($('#reader'));
        }
        return;
      }
      if (t.id === 'closeDrawer') {
        state.drawer = null;
        state.settingsOpen = false;
        removeReaderOverlays();
        return;
      }
      var chap = t.closest ? t.closest('.drawer .chap') : null;
      if (chap) {
        var itemId = chap.dataset.itemId;
        var idx = state.chapters.findIndex(function (c) { return c.itemId === itemId; });
        state.chapterIdx = idx;
        state.drawer = null;
        state.pageIdx = 0;
        openChapter(itemId, idx);
        return;
      }
      if (t.id === 'prevPage') { navPage(-1); return; }
      if (t.id === 'nextPage') { navPage(1); return; }
      if (t.id === 'prevChapter') { prevChapter(); return; }
      if (t.id === 'nextChapter') { nextChapter(); return; }
      var themeChip = t.closest ? t.closest('[data-theme]') : null;
      if (themeChip) {
        state.settings.theme = themeChip.dataset.theme;
        saveSettings();
        renderReader();
        return;
      }
      var showBarsChip = t.closest ? t.closest('[data-showBars]') : null;
      if (showBarsChip) {
        state.settings.showBars = showBarsChip.dataset.showBars === '1';
        state.settings.barsTouched = true;
        saveSettings();
        renderReader();
        return;
      }
      // 点击正文：左右两侧翻页，中间切换工具栏显隐（沉浸式快速翻页，不占界面）
      var bodyWrap = t.closest ? t.closest('.page-wrap') : null;
      if (bodyWrap && !t.closest('.drawer') && !t.closest('.settings-pop') && !t.closest('.reader-bar') && !t.closest('.reader-footer')) {
        var rect = bodyWrap.getBoundingClientRect();
        var x = ev.clientX - rect.left;
        var w = rect.width || 1;
        if (x < w * 0.3) { navPage(-1); return; }
        if (x > w * 0.7) { navPage(1); return; }
        state.settings.showBars = !state.settings.showBars;
        state.settings.barsTouched = true;
        saveSettings();
        renderReader();
        return;
      }
    }

    // 登录
    if (t.id === 'qrStart') { startQr(); return; }
    if (t.id === 'qrRefresh') { startQr(); return; }
    // 登录
    if (t.id === 'logoutBtn') {
      call('logout', {}).then(function () {
        state.user = null;
        state.loggedIn = false;
        render();
      });
      return;
    }
  });

  // 设置控件 & 登录输入
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.id === 'fontSizeRange') {
      state.settings.fontSize = Number(t.value);
      saveSettings();
      if (state.view === 'reader') {
        // 只更新字体与分页，不重建阅读器（避免面板闪烁）
        applySettings();
        state.pages = paginate(state.chapter ? state.chapter.paragraphs : []);
        state.pageIdx = Math.min(state.pageIdx, Math.max(0, state.pages.length - 1));
        renderPage();
      }
    }
    if (t.id === 'lineHeightRange') {
      state.settings.lineHeight = Number(t.value);
      saveSettings();
      if (state.view === 'reader') {
        applySettings();
        state.pages = paginate(state.chapter ? state.chapter.paragraphs : []);
        state.pageIdx = Math.min(state.pageIdx, Math.max(0, state.pages.length - 1));
        renderPage();
      }
    }
  });

  function saveSettings() {
    call('settings-set', { settings: state.settings }).catch(function () { /* ignore */ });
  }

  // 键盘
  document.addEventListener('keydown', function (ev) {
    if (state.view !== 'reader') return;
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
    var ctrl = ev.ctrlKey || ev.metaKey;
    if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); navPage(-1); }
    else if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') { ev.preventDefault(); navPage(1); }
    else if (ev.key === 'Home') { ev.preventDefault(); state.pageIdx = 0; renderPage(); }
    else if (ev.key === 'End') { ev.preventDefault(); state.pageIdx = state.pages.length - 1; renderPage(); }
    else if (ctrl && ev.key === 'ArrowLeft') { ev.preventDefault(); prevChapter(); }
    else if (ctrl && ev.key === 'ArrowRight') { ev.preventDefault(); nextChapter(); }
    else if (ev.key === 'Escape') {
      if (state.drawer || state.settingsOpen) {
        state.drawer = null;
        state.settingsOpen = false;
        removeReaderOverlays();
      }
    }
  });

  /* ---------------- 消息监听 ---------------- */
  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (!m) return;
    if (m.type === 'resp') {
      var p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        if (m.ok) p.resolve(m.data);
        else p.reject(new Error(m.error || '未知错误'));
      }
      return;
    }
    if (m.type === 'init') {
      state.user = m.user;
      state.loggedIn = !!m.loggedIn;
      if (m.settings) state.settings = Object.assign(state.settings, m.settings);
      state.view = state.view || 'bookstore';
      render();
      if (state.view === 'bookstore' && !state.rankBooks.length && !state.rankLoading) loadRank(true);
      return;
    }
    if (m.type === 'nav') {
      state.view = m.view;
      state.inReader = false;
      render();
      if (m.view === 'bookstore' && !state.rankBooks.length && !state.rankLoading) loadRank(true);
      if (m.view === 'shelf') renderShelf($('#view'));
      return;
    }
    if (m.type === 'login-changed') {
      state.user = m.user;
      state.loggedIn = !!m.loggedIn;
      saveState();
      render();
      if (state.view === 'shelf') renderShelf($('#view'));
      return;
    }
    if (m.type === 'qr-status') {
      // 只接受当前会话的状态
      if (m.session !== undefined && m.session !== state.qrSession) return;
      var s = m.status || {};
      state.qrStatusText = s.message || '';
      state.qrStatusClass = s.stage === 'success' ? 'ok' : (s.stage === 'error' ? 'err' : '');
      if (s.stage === 'waiting' && s.qrUrl && !state.qrUrl) {
        state.qrUrl = s.qrUrl;
        state.qrText = s.qrText || state.qrText;
      }
      if (state.view === 'login') {
        var statusEl = $('#qrStatus');
        if (statusEl) {
          statusEl.textContent = state.qrStatusText;
          statusEl.className = 'qr-status' + (state.qrStatusClass ? ' ' + state.qrStatusClass : '');
        }
        if (s.stage === 'success') {
          // 登录完成会收到 login-changed，这里只更新提示
          state.qrWorking = false;
        }
      }
      return;
    }
    if (m.type === 'open-book') {
      showBookModal(m.bookId);
      return;
    }
    if (m.type === 'open-book-reader') {
      // 侧边栏/命令请求：直接在阅读器中打开书籍（itemId 可选：续读历史章节）
      if (IS_SIDEBAR) {
        // 侧边栏收到此消息说明面板已打开，这里无操作（面板处理）
      } else {
        enterReader(m.bookId, '', m.itemId || '');
      }
      return;
    }
  });

  /* ---------------- 工具 ---------------- */
  function errBox(message) {
    var box = el('div', 'err-box');
    box.textContent = message || '操作失败';
    return box;
  }

  function refreshShelfCache() {
    call('shelf-local-get', {}).then(function (items) {
      state.shelfLocal = items || [];
    }).catch(function () { /* ignore */ });
  }

  // 初始渲染
  applySettings();
  render();
  call('login-status', {}).then(function (r) {
    state.user = r.user;
    state.loggedIn = !!r.loggedIn;
    render();
    if (state.view === 'bookstore' && !state.rankBooks.length && !state.rankLoading) loadRank(true);
  }).catch(function () { /* ignore */ });
  call('settings-get', {}).then(function (s) {
    if (s) { state.settings = Object.assign(state.settings, s); applySettings(); }
  }).catch(function () { /* ignore */ });
})();
