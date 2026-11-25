// npm run version -- <mod> <major|minor|patch|x.y.z>
// Sets info.json's version and adds a dated changelog section (or re-dates it if it's already the top one).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SEPARATOR,
  bumpVersion,
  compareVersions,
  factorioDate,
  parseChangelog,
  readInfo,
  readText,
  requireMod,
  writeInfoVersion,
} from './lib/mods.mjs';

const [name, part] = process.argv.slice(2);
try {
  const dir = requireMod(name);
  if (!part) throw new Error('Usage: npm run version -- <mod> <major|minor|patch|x.y.z>');

  const current = readInfo(name).version;
  const next = bumpVersion(current, part);
  if (compareVersions(next, current) < 0) throw new Error(`${next} is older than the current ${current}`);

  const path = join(dir, 'changelog.txt');
  const text = readText(path);
  const lines = text.split('\n');
  const { sections } = parseChangelog(text);
  const top = sections[0];

  if (top?.version === next) {
    const dateLine = lines.findIndex((line, i) => i > top.start && i < top.end && line.startsWith('Date: '));
    if (dateLine >= 0) lines[dateLine] = `Date: ${factorioDate()}`;
    else lines.splice(top.start + 2, 0, `Date: ${factorioDate()}`);
    writeFileSync(path, lines.join('\n'));
    console.log(`${name}: the changelog already has ${next}; its date is now ${factorioDate()}.`);
  } else {
    if (sections.some((s) => s.version === next)) throw new Error(`changelog.txt already has a section for ${next}, below the top one`);
    const section = [SEPARATOR, `Version: ${next}`, `Date: ${factorioDate()}`, '  Changes:', ''];
    writeFileSync(path, section.join('\n') + text);
    console.log(`${name}: ${current} -> ${next}. A new section is at the top of changelog.txt.`);
  }
  writeInfoVersion(name, next);

  console.log(`
Next:
  1. Write the changes under the new section in mods/${name}/changelog.txt (categories such as Features, Changes, Bugfixes;
     entries are "    - text"). npm test fails until every category has an entry.
  2. npm test, then npm run package -- ${name}
  3. Commit "Release ${name} ${next}", then tag it: git tag ${name}/v${next}
  4. Push the commit and the tag: the Release workflow builds the GitHub Release.`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
