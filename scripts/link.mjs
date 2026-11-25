// npm run link -- <mod> [--unlink]
// Junctions (symlinks off Windows) mods/<mod> into the Factorio mods folder (FACTORIO_MODS or the default location).
import { lstatSync, readdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { requireMod } from './lib/mods.mjs';

function factorioMods() {
  if (process.env.FACTORIO_MODS) return process.env.FACTORIO_MODS;
  if (process.platform === 'win32') return join(process.env.APPDATA, 'Factorio', 'mods');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'factorio', 'mods');
  return join(homedir(), '.factorio', 'mods');
}

function stat(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
const unlink = args.includes('--unlink');
const name = args.find((arg) => !arg.startsWith('--'));
try {
  const dir = requireMod(name);
  const mods = factorioMods();
  if (!existsSync(mods)) throw new Error(`No Factorio mods folder at ${mods} (set FACTORIO_MODS)`);
  const link = join(mods, name);
  const current = stat(link);

  if (unlink) {
    if (!current) console.log(`Nothing to remove: ${link} doesn't exist.`);
    else if (!current.isSymbolicLink()) throw new Error(`${link} is a real folder, not a link: left as it is`);
    else {
      rmSync(link);
      console.log(`Removed the link ${link}.`);
    }
  } else {
    if (current && !current.isSymbolicLink()) throw new Error(`${link} is a real folder: move it away first`);
    if (current) console.log(`Already linked: ${link}`);
    else {
      symlinkSync(dir, link, process.platform === 'win32' ? 'junction' : 'dir');
      console.log(`Linked ${link} -> ${dir}`);
    }
    const zips = readdirSync(mods).filter((file) => file.startsWith(`${name}_`) && file.endsWith('.zip'));
    if (zips.length) {
      console.log(`\nAlso in the mods folder: ${zips.join(', ')}. Factorio loads only one version of a mod;`);
      console.log('move those out while you test the working copy. npm run link -- <mod> --unlink removes the link.');
    }
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
