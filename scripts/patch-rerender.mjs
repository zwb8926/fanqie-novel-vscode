// Replace direct renderLogin($('#view')) calls with rerenderLogin() (clears view first).
import fs from 'node:fs';
let s = fs.readFileSync('media/app.js', 'utf8');
const before = s;
s = s.split("renderLogin($('#view'))").join('rerenderLogin()');
const helper = `
  function rerenderLogin() {
    var v = $('#view');
    if (v) v.innerHTML = '';
    renderView();
  }
`;
s = s.replace('  function renderView() {', helper + '  function renderView() {');
if (s === before) { console.log('NO CHANGE'); process.exit(1); }
fs.writeFileSync('media/app.js', s);
console.log('patched, replaced', (before.split("renderLogin($('#view'))").length - 1), 'call sites');
