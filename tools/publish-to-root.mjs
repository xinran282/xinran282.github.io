import { cpSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');

if (!existsSync(publicDir)) {
  throw new Error('Missing public directory. Run hexo generate first.');
}

for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
  const from = path.join(publicDir, entry.name);
  const to = path.join(root, entry.name);
  cpSync(from, to, { recursive: true, force: true });
}

console.log('Copied generated Hexo output from public/ to the repository root.');
