// Debug directory API response shape through the compiled module.
import { requestJson } from '../out/net/http.js';

const j = await requestJson('https://fanqienovel.com/api/reader/directory/detail?bookId=7576659101376072728&enter_from=0', {
  headers: { Referer: 'https://fanqienovel.com/', Origin: 'https://fanqienovel.com', Accept: 'application/json, text/plain, */*' },
});
const d = j.data;
console.log('code:', j.code, 'keys:', Object.keys(d || {}).join(','));
const v = d.chapterListWithVolume;
console.log('chapterListWithVolume is array:', Array.isArray(v), 'len:', Array.isArray(v) ? v.length : typeof v);
if (Array.isArray(v) && v.length) {
  console.log('v[0] type:', typeof v[0], Array.isArray(v[0]) ? 'nested-array' : 'object');
  console.log('v[0] keys:', Object.keys(v[0] || {}).join(','));
  console.log('v[0].itemId:', v[0].itemId);
  console.log('v[0].volume_name:', v[0].volume_name);
  console.log('v[0] sample:', JSON.stringify(v[0]).slice(0, 250));
  // maybe each element is AN ARRAY of chapters?
  if (Array.isArray(v[0])) {
    console.log('v[0][0]:', JSON.stringify(v[0][0]).slice(0, 200));
    console.log('v[0] length:', v[0].length);
  }
}
