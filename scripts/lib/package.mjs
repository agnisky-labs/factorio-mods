// Builds a mod's zip: one folder, <name>_<version>/, with the mod's files, as Factorio and the mod portal expect.
// Left out: tests/, Markdown files and dotfiles.
import { zipSync } from 'fflate';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DIST_DIR, readInfo, requireMod } from './mods.mjs';

// A fixed time in every entry, so the same files give the same zip.
const MTIME = new Date('2020-01-01T00:00:00Z');

export function isPackaged(path) {
  const parts = path.split('/');
  if (parts[0] === 'tests') return false;
  if (parts.some((part) => part.startsWith('.'))) return false;
  if (parts.at(-1).toLowerCase().endsWith('.md')) return false;
  return true;
}

function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, base);
    return [relative(base, path).split('\\').join('/')];
  });
}

/** The files of a mod that go in its zip, as paths inside the mod's folder. */
export function packagedFiles(name) {
  return walk(requireMod(name)).filter(isPackaged).sort();
}

/** The zip of one mod, in memory: { folder, bytes }. */
export function buildZip(name) {
  const dir = requireMod(name);
  const folder = `${name}_${readInfo(name).version}`;
  const files = {};
  for (const file of packagedFiles(name)) {
    files[`${folder}/${file}`] = [readFileSync(join(dir, file)), { mtime: MTIME }];
  }
  return { folder, bytes: zipSync(files, { level: 9 }) };
}

/** Builds dist/<name>_<version>.zip and returns its path. */
export function packageMod(name, outDir = DIST_DIR) {
  const { folder, bytes } = buildZip(name);
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${folder}.zip`);
  writeFileSync(out, bytes);
  return out;
}
