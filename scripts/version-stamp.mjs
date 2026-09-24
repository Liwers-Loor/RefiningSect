import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';

const level = process.argv[2];
const indexes = { major: 0, module: 1, component: 2, feature: 3, refresh: -1 };
if (!(level in indexes)) {
  throw new Error('用法：pnpm version:stamp <major|module|component|feature|refresh>');
}

const versionFile = 'src/game/version.ts';
const source = readFileSync(versionFile, 'utf8');
const match = source.match(/v(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)/);
if (!match) throw new Error('找不到页面版本号');
const previous = match[0];
const parts = match.slice(1).map(Number);
const index = indexes[level];
if (index >= 0) {
  parts[index] += 1;
  for (let i = index + 1; i < 4; i += 1) parts[i] = 0;
}

const codeExtensions = new Set(['.ts', '.js', '.mjs', '.svelte', '.css', '.html']);
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .toString('utf8').split('\0').filter((file) => codeExtensions.has(extname(file)));

function countCodeLines(file) {
  let blockComment = false;
  let count = 0;
  for (const original of readFileSync(file, 'utf8').split(/\r?\n/)) {
    let line = original.trim();
    if (!line) continue;
    while (line) {
      if (blockComment) {
        const end = line.indexOf('*/');
        if (end < 0) { line = ''; break; }
        line = line.slice(end + 2).trim();
        blockComment = false;
      } else if (line.startsWith('/*')) {
        line = line.slice(2);
        blockComment = true;
      } else {
        break;
      }
    }
    if (line && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('<!--') && !line.startsWith('-->')) count += 1;
  }
  return count;
}

parts[4] = files.reduce((total, file) => total + countCodeLines(file), 0);
const next = `v${parts.join('.')}`;
writeFileSync(versionFile, source.replace(previous, next));
process.stdout.write(`${previous} → ${next}\n`);
