// npm run package [-- <mod>...]
// Builds dist/<name>_<version>.zip for the given mods, or for every mod when none is given.
import { relative } from 'node:path';
import { listMods } from './lib/mods.mjs';
import { packageMod } from './lib/package.mjs';

try {
  const names = process.argv.slice(2);
  for (const name of names.length ? names : listMods()) {
    console.log(relative(process.cwd(), packageMod(name)));
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
