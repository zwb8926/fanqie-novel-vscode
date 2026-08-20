// Apply dec() to all user-visible text fields in fanqie.ts.
import fs from 'node:fs';
let s = fs.readFileSync('src/api/fanqie.ts', 'utf8');

s = s.replace(/title: c\.title \?\? '',/g, "title: dec(c.title ?? ''),");
s = s.replace(/volume_name: name,/g, 'volume_name: dec(name),');
s = s.replace(/volumes\.push\(\{ volume_name: name, chapters \}\)/g, 'volumes.push({ volume_name: dec(name), chapters });');
s = s.replace(/bookName: d\.bookName \?\? d\.book_name \?\? '',/g, "bookName: dec(d.bookName ?? d.book_name ?? ''),");
s = s.replace(/title: d\.title \?\? '',/g, "title: dec(d.title ?? ''),");
s = s.replace(/author: d\.author \?\? '',/g, "author: dec(d.author ?? ''),");
s = s.replace(/nick_name: c\.user\?\.nick_name \?\? '匿名',/g, "nick_name: dec(c.user?.nick_name ?? '匿名'),");
s = s.replace(/text: c\.info\?\.text \?\? '',/g, "text: dec(c.info?.text ?? ''),");
s = s.replace(/book_title: data\.novel\?\.title \?\? '',/g, "book_title: dec(data.novel?.title ?? ''),");
s = s.replace(/nick_name: user\?\.nick_name \?\? user\?\.user_name \?\? '匿名',/g, "nick_name: dec(user?.nick_name ?? user?.user_name ?? '匿名'),");
s = s.replace(/text: info\?\.text \?\? c\?\.text \?\? '',/g, "text: dec(info?.text ?? c?.text ?? ''),");

fs.writeFileSync('src/api/fanqie.ts', s);
console.log('patched ok');
