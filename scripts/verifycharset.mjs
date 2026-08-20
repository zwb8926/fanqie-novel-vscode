// Verify ying-ck charset.json ordering matches virtual gid scheme.
const UA = { 'User-Agent': 'Mozilla/5.0' };
const t = await (await fetch('https://raw.githubusercontent.com/ying-ck/fanqienovel-downloader/main/src/charset.json', { headers: UA })).text();
const [listA, listB] = JSON.parse(t);
const GID_START = 58344;
console.log('listA len:', listA.length, 'listB len:', listB.length);
for (const idx of [0, 1, 245, 249, 276]) {
  const vgid = GID_START + idx;
  console.log(`idx ${idx} (vgid ${vgid}): A=${JSON.stringify(listA[idx])} B=${JSON.stringify(listB[idx])}`);
}
// does A contain 行 at 245? 动 at 249?
console.log('A[245] should be 行:', listA[245] === '行', '| A[249] should be 动:', listA[249] === '动');
// the unknown char
console.log('A[276] =', JSON.stringify(listA[276]), 'B[276] =', JSON.stringify(listB[276]));
