// npm run smoke -- [--space-age] [--keep] [<mod>...]
// Loads the mods in a real Factorio (FACTORIO_BIN) with a temporary config and write-data folder:
//   1. --create a save with the mods enabled (default settings);
//   2. --dump-data with and without the mods, then check every prototype each mod looks up exists (with --space-age), and run
//      mods/<mod>/tests/smoke-check.mjs when there is one.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prototypeLookups, readSettings, startupDefaults } from './lib/lua.mjs';
import { listMods, modDir, readInfo, requireMod } from './lib/mods.mjs';
import { packageMod } from './lib/package.mjs';

const DLC = ['space-age', 'quality', 'elevated-rails'];

const args = process.argv.slice(2);
const spaceAge = args.includes('--space-age');
const keep = args.includes('--keep');
const names = args.filter((arg) => !arg.startsWith('--'));

const bin = process.env.FACTORIO_BIN;
if (!bin || !existsSync(bin)) {
  console.error(`Set FACTORIO_BIN to the Factorio executable${bin ? ` (nothing at ${bin})` : ''}.`);
  process.exit(1);
}

const mods = names.length ? names : listMods();
mods.forEach(requireMod);
const variant = spaceAge ? 'space-age' : 'base';

const work = mkdtempSync(join(tmpdir(), 'factorio-smoke-'));
const modsDir = join(work, 'mods');
const writeDir = join(work, 'write');
const config = join(work, 'config.ini');

function setModList(enableOurs) {
  const list = [
    { name: 'base', enabled: true },
    ...DLC.map((name) => ({ name, enabled: spaceAge })),
    ...mods.map((name) => ({ name, enabled: enableOurs })),
  ];
  writeFileSync(join(modsDir, 'mod-list.json'), JSON.stringify({ mods: list }, null, 2));
}

function factorio(...extra) {
  const result = spawnSync(bin, ['--config', config, '--mod-directory', modsDir, ...extra], {
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) throw new Error(`Factorio didn't run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Factorio exited with ${result.status}.\n\n${log}`);
  return log;
}

function dumpData() {
  const path = join(writeDir, 'script-output', 'data-raw-dump.json');
  rmSync(path, { force: true });
  factorio('--dump-data');
  return JSON.parse(readFileSync(path, 'utf8'));
}

let failed = false;
try {
  mkdirSync(modsDir);
  mkdirSync(writeDir);
  writeFileSync(config, `[path]\nread-data=__PATH__executable__/../../data\nwrite-data=${writeDir.replace(/\\/g, '/')}\n`);
  for (const name of mods) packageMod(name, modsDir);

  console.log(`${mods.map((name) => `${name} ${readInfo(name).version}`).join(', ')} (${variant})`);

  setModList(true);
  const log = factorio('--create', join(work, 'smoke.zip'));
  const notLoaded = mods.filter((name) => !log.includes(`Checksum of ${name}:`));
  if (notLoaded.length) throw new Error(`Factorio ran, but these mods didn't load: ${notLoaded.join(', ')}.\n\n${log}`);
  console.log('  loaded and created a save');

  const after = dumpData();
  setModList(false);
  const before = dumpData();

  for (const name of mods) {
    const missing = prototypeLookups(modDir(name)).filter(({ type, name: proto }) => !before[type]?.[proto]);
    if (missing.length && spaceAge) {
      failed = true;
      console.error(`  ${name}: looks up prototypes the game doesn't have:`);
      for (const { type, name: proto } of missing) console.error(`    ${type}/${proto}`);
    } else if (missing.length) {
      console.log(`  ${name}: ${missing.length} looked-up prototypes are absent without Space Age (checked with --space-age)`);
    } else {
      console.log(`  ${name}: every prototype it looks up exists`);
    }

    const checkFile = join(modDir(name), 'tests', 'smoke-check.mjs');
    if (existsSync(checkFile)) {
      const { check } = await import(pathToFileURL(checkFile).href);
      const settings = startupDefaults(readSettings(modDir(name)));
      try {
        check({ before, after, variant, settings });
        console.log(`  ${name}: smoke-check.mjs passed`);
      } catch (error) {
        failed = true;
        console.error(`  ${name}: smoke-check.mjs failed: ${error.message}`);
      }
    }
  }
} catch (error) {
  failed = true;
  console.error(error.message);
} finally {
  if (keep) console.log(`Kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
console.log(failed ? 'Failed.' : 'Passed.');
process.exit(failed ? 1 : 0);
