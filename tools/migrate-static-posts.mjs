import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import iconv from 'iconv-lite';

const root = process.cwd();
const postsRoot = path.join(root, '2022');
const outDir = path.join(root, 'source', '_posts');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function decodeHtml(input = '') {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/g, '/');
}

function textScore(input) {
  const cjk = input.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const bad = input.match(/[\ufffd\ue000-\uf8ff€]/g)?.length ?? 0;
  return cjk * 2 - bad * 10;
}

function repairMojibake(input = '') {
  const repaired = iconv.decode(iconv.encode(input, 'gbk'), 'utf8');
  return textScore(repaired) > textScore(input) ? repaired : input;
}

function stripTags(input = '') {
  return repairMojibake(decodeHtml(input.replace(/<[^>]+>/g, ''))).trim();
}

function yamlList(values) {
  if (!values.length) return '';
  return values.map((value) => `  - ${value.replace(/:/g, '\\:')}`).join('\n');
}

function slugFromFile(file) {
  return decodeURIComponent(path.basename(path.dirname(file)));
}

function convertCodeBlocks(html) {
  return html.replace(/<figure class="highlight [^"]*">[\s\S]*?<td class="code"><pre>([\s\S]*?)<\/pre><\/td>[\s\S]*?<\/figure>/g, (_, code) => {
    const lines = [...code.matchAll(/<span class="line">([\s\S]*?)<\/span>/g)].map((match) => stripTags(match[1]));
    return `\n\n\`\`\`text\n${lines.join('\n')}\n\`\`\`\n\n`;
  });
}

function htmlToMarkdown(html) {
  let body = convertCodeBlocks(html);
  body = body.replace(/<a [^>]*class="headerlink"[\s\S]*?<\/a>/g, '');
  body = body.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g, (_, level, text) => `${'#'.repeat(Number(level))} ${stripTags(text)}\n\n`);
  body = body.replace(/<br\s*\/?>/g, '\n');
  body = body.replace(/<\/p>/g, '\n\n');
  body = body.replace(/<p[^>]*>/g, '');
  body = body.replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, text) => `[${stripTags(text)}](${decodeHtml(href)})`);
  body = body.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/g, '**$1**');
  body = body.replace(/<em[^>]*>([\s\S]*?)<\/em>/g, '*$1*');
  body = body.replace(/<table[\s\S]*?<\/table>/g, (table) => `\n\n${table.trim()}\n\n`);
  body = body.replace(/<[^>]+>/g, '');
  body = repairMojibake(decodeHtml(body));
  body = body.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return body.trim() + '\n';
}

mkdirSync(outDir, { recursive: true });

const files = walk(postsRoot).filter((file) => path.basename(file) === 'index.html');
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const title = stripTags(html.match(/<h1 class="post-title"[\s\S]*?>([\s\S]*?)<\/h1>/)?.[1] ?? slugFromFile(file));
  const date = html.match(/datetime="([^"]+)"/)?.[1]?.replace('T', ' ').replace(/\+08:00$/, '') ?? '';
  const categories = [...html.matchAll(/\/categories\/([^/]+)\/"[^>]*><span itemprop="name">([\s\S]*?)<\/span>/g)]
    .map((match) => stripTags(match[2]));
  const tags = [...html.matchAll(/\/tags\/([^/]+)\/" rel="tag"># ([\s\S]*?)<\/a>/g)]
    .map((match) => stripTags(match[2]));
  const rawBody = html.match(/<div class="post-body"[^>]*>([\s\S]*?)<\/div>\s*<footer class="post-footer">/)?.[1] ?? '';
  const markdown = htmlToMarkdown(rawBody);
  const slug = slugFromFile(file);
  const frontMatter = [
    '---',
    `title: ${title}`,
    `date: ${date}`,
    categories.length ? `categories:\n${yamlList(categories)}` : 'categories:',
    tags.length ? `tags:\n${yamlList(tags)}` : 'tags:',
    '---',
    ''
  ].join('\n');

  writeFileSync(path.join(outDir, `${slug}.md`), `${frontMatter}${markdown}`, 'utf8');
}

console.log(`Migrated ${files.length} posts to ${path.relative(root, outDir)}`);
