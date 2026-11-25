// Mechanical check of player-facing text. The style itself is reviewed by hand (.claude/rules/writing.md).
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { ROOT, listMods, modDir, readText } from '../scripts/lib/mods.mjs';

// [pattern, what to say]. Keep it short; add to it when something slips through review.
const BANNED = [
  [/[—–]/, 'em or en dash'],
  [/[‘’“”]/, 'curly quote'],
  [/\p{Extended_Pictographic}/u, 'emoji'],
  [/\b(seamless(ly)?|robust|streamline[sd]?|comprehensive|leverag(e|es|ing)|elevate[sd]?|effortless(ly)?|empower(s|ing)?|delve[sd]?)\b/i, 'filler word'],
  [/\benhance(s|d|ment)?\b/i, 'filler word'],
  [/\bpowerful\b/i, 'filler word'],
  [/a testament to|whether you'?re|next level|look no further|game[- ]changer/i, 'stock phrase'],
  [/^\s*[-*]\s+\*\*[^*]+\*\*:?/, 'bold label at the start of a bullet'],
  [/^#+\s*key features/i, '"Key features" header'],
];

function files() {
  const list = [join(ROOT, 'README.md')];
  for (const name of listMods()) {
    const dir = modDir(name);
    list.push(join(dir, 'README.md'), join(dir, 'changelog.txt'), join(dir, 'info.json'));
    const locale = join(dir, 'locale');
    if (existsSync(locale)) {
      for (const language of readdirSync(locale)) {
        for (const file of readdirSync(join(locale, language))) list.push(join(locale, language, file));
      }
    }
  }
  return list.filter((file) => existsSync(file));
}

test('player-facing text has none of the banned characters, words or patterns', () => {
  const problems = [];
  for (const file of files()) {
    readText(file)
      .split('\n')
      .forEach((line, i) => {
        for (const [pattern, why] of BANNED) {
          const match = pattern.exec(line);
          if (match) problems.push(`${relative(ROOT, file)}:${i + 1}: ${why} '${match[0]}'`);
        }
      });
  }
  assert.deepEqual(problems, []);
});
