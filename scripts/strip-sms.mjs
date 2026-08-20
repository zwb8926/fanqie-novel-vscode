// 彻底移除手机号登录与 Cookie 导入（app.js）—— v2：逐行精确处理
import fs from 'node:fs';
let s = fs.readFileSync('media/app.js', 'utf8');
let removed = 0;
function rep(from, to) {
  if (!s.includes(from)) { console.log('✘ 未找到:', JSON.stringify(from.slice(0, 60))); return; }
  s = s.split(from).join(to);
  removed++;
  console.log('✔ 替换:', JSON.stringify(from.slice(0, 50)));
}
function cut(from, to) {
  const i1 = s.indexOf(from);
  const i2 = s.indexOf(to, i1 + from.length);
  if (i1 < 0 || i2 < 0) { console.log('✘ 区间缺失:', JSON.stringify(from.slice(0, 50)), '→', JSON.stringify(to.slice(0, 40))); return; }
  s = s.slice(0, i1) + s.slice(i2);
  removed++;
  console.log('✔ 删除区间:', JSON.stringify(from.slice(0, 50)));
}

// 1. state 里的 sms 行（保留 state 闭合）
rep(
  "    // 手机号登录\n    sms: { tab: 'qr', mobile: '', code: '', ticket: '', countdown: 0, status: '', statusClass: '', loggingIn: false, captcha: { conf: null, mounted: false } },\n",
  ""
);
// 2. 防御补丁块
rep(
  "  // 确保 sms.captcha 等新增字段存在（防止旧版本残留状态导致渲染崩溃）\n  if (!state.sms || !state.sms.captcha) {\n    state.sms = { tab: 'qr', mobile: '', code: '', ticket: '', countdown: 0, status: '', statusClass: '', loggingIn: false, captcha: { conf: null, mounted: false } };\n  }\n",
  ""
);
// 3. renderLogin：tabs + 分支 → 直接扫码
rep(
  "      // 方式切换：扫码（默认）/ 手机号\n      var tabs = el('div', 'chips');\n      var qrTab = el('button', 'chip' + (state.sms.tab === 'qr' ? ' active' : ''), '扫码登录');\n      qrTab.id = 'qrTabBtn';\n      var smsTab = el('button', 'chip' + (state.sms.tab === 'sms' ? ' active' : ''), '手机号登录');\n      smsTab.id = 'smsTabBtn';\n      tabs.appendChild(qrTab);\n      tabs.appendChild(smsTab);\n      wrap.appendChild(tabs);\n\n      if (state.sms.tab === 'sms') {\n        wrap.appendChild(renderSmsLogin());\n      } else {\n        wrap.appendChild(renderQrLogin());\n      }",
  "      wrap.appendChild(renderQrLogin());"
);
// 4. renderSmsLogin 整块
cut(
  "  /* ---------------- 手机号登录 ---------------- */",
  "  /* ---------------- 扫码登录 ---------------- */"
);
// 5. Cookie 导入块（renderQrLogin 内）
cut(
  "    // Cookie 导入兜底",
  "    box.appendChild(paste);\n"
);
// 6. sendSms → smsLoginSubmit 整块
cut(
  "  function sendSms() {",
  "  function renderQrText(box, text) {"
);
// 7. 点击处理器
rep(
  "    if (t.id === 'smsTabBtn') { state.sms.tab = 'sms'; renderView(); return; }\n    if (t.id === 'qrTabBtn') { state.sms.tab = 'qr'; renderView(); return; }\n    if (t.id === 'smsSendBtn') { sendSms(); return; }\n    if (t.id === 'smsLoginBtn') { smsLoginSubmit(); return; }\n",
  ""
);
cut(
  "    if (t.id === 'cookieImport') {",
  "    if (t.id === 'logoutBtn') {"
);
// 8. input 监听 sms 行
rep(
  "    if (t.id === 'smsMobile') state.sms.mobile = t.value;\n    if (t.id === 'smsCode') state.sms.code = t.value;\n",
  ""
);

fs.writeFileSync('media/app.js', s);
console.log('\n处理块数:', removed);
