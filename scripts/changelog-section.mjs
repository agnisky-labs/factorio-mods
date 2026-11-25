// npm run changelog -- <mod> [version]
// Prints one version's changelog section (the current version by default): the notes of a GitHub Release.
import { join } from 'node:path';
import { changelogSection, readInfo, readText, requireMod } from './lib/mods.mjs';

const [name, version] = process.argv.slice(2);
try {
  const dir = requireMod(name);
  const wanted = version ?? readInfo(name).version;
  const section = changelogSection(readText(join(dir, 'changelog.txt')), wanted);
  if (!section) throw new Error(`mods/${name}/changelog.txt has no section for ${wanted}`);
  process.stdout.write(section);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
