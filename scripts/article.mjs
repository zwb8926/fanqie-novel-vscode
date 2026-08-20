// Extract CSDN article code blocks fully.
import fs from 'node:fs';
const html = fs.readFileSync(process.env.TEMP + '/csdn_font_article.html', 'utf8');
const blocks = html.match(/<code[^>]*>([\s\S]*?)<\/code>/g) || [];
blocks.forEach((b, i) => {
  const clean = b
    .replace(/<[^>]+>/g, '')
    .replaceAll('&#39;', "'")
    .replaceAll('&#34;', '"')
    .replaceAll('&#61;', '=')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
  console.log(`\n========== BLOCK ${i} (len=${clean.length}) ==========`);
  console.log(clean.slice(0, 4000));
});
