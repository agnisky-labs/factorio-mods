// npm run smoke -- [--space-age] [--keep] [<mod>...]
// Loads the mods in a real Factorio (FACTORIO_BIN) with a temporary config and write-data folder:
//   1. --create a save with the mods enabled (default settings);
//   2. --dump-data with and without the mods; every prototype a mod looks up must exist (with --space-age);
//   3. a probe mod logs the game's own item weights (mods off) for the items each mod looks up;
//   4. mods/<mod>/tests/smoke-check.mjs, when there is one, gets all of the above.
// Also reports recipes that make a looked-up item but aren't looked up themselves.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prototypeLookups, readSettings, startupDefaults } from './lib/lua.mjs';
import { listMods, modDir, readInfo, requireMod } from './lib/mods.mjs';
import { packageMod } from './lib/package.mjs';

const PROBE = 'smoke-weight-probe';

const args = process.argv.slice(2);
const spaceAge = args.includes('--space-age');
const keep = args.includes('--keep');
const names = args.filter((arg) => !arg.startsWith('--'));

const bin = process.env.FACTORIO_BIN;
if (!bin || !existsSync(bin)) {
  console.error(`Set FACTORIO_BIN to the Factorio executable${bin ? ` (nothing at ${bin})` : ''}.`);
  process.exit(1);
}
const gameData = join(dirname(bin), '..', '..', 'data');
const gameVersion = JSON.parse(readFileSync(join(gameData, 'base', 'info.json'), 'utf8')).version;
// The expansion's built-in mods present in this game (recycler is its own mod from 2.1).
const DLC = ['space-age', 'quality', 'elevated-rails', 'recycler'].filter((name) => existsSync(join(gameData, name, 'info.json')));

const mods = names.length ? names : listMods();
mods.forEach(requireMod);
const variant = spaceAge ? 'space-age' : 'base';
const lookups = Object.fromEntries(mods.map((name) => [name, prototypeLookups(modDir(name))]));

const work = mkdtempSync(join(tmpdir(), 'factorio-smoke-'));
const modsDir = join(work, 'mods');
const writeDir = join(work, 'write');
const config = join(work, 'config.ini');

function setModList({ ours, probe = false }) {
  const list = [
    { name: 'base', enabled: true },
    ...DLC.map((name) => ({ name, enabled: spaceAge })),
    ...mods.map((name) => ({ name, enabled: ours })),
    { name: PROBE, enabled: probe },
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

/** A mod that logs prototypes.item[name].weight in on_init, which runs when --create makes a new save. */
function writeProbe(items) {
  const dir = join(modsDir, PROBE);
  mkdirSync(dir, { recursive: true });
  const info = { name: PROBE, version: '0.0.1', title: 'Smoke weight probe', author: 'smoke', factorio_version: gameVersion.split('.').slice(0, 2).join('.') };
  writeFileSync(join(dir, 'info.json'), JSON.stringify(info));
  writeFileSync(
    join(dir, 'control.lua'),
    `script.on_init(function()
  for _, name in pairs(${JSON.stringify(items).replace(/^\[/, '{').replace(/\]$/, '}')}) do
    local item = prototypes.item[name]
    if item then log("SMOKE-WEIGHT " .. name .. " " .. string.format("%.17g", item.weight)) end
  end
end)
`,
  );
}

function readWeights() {
  const log = factorio('--create', join(work, 'probe.zip'));
  return Object.fromEntries([...log.matchAll(/SMOKE-WEIGHT (\S+) (\S+)/g)].map(([, name, weight]) => [name, Number(weight)]));
}

const isRecycling = (recipe) => recipe.category === 'recycling' || (recipe.categories ?? []).includes('recycling');
// Empty Lua tables come out of the dump as {}, not [].
const itemProducts = (recipe) => Object.values(recipe.results ?? {}).filter((r) => r.type === 'item').map((r) => r.name);

let failed = false;
try {
  mkdirSync(modsDir);
  mkdirSync(writeDir);
  writeFileSync(config, `[path]\nread-data=__PATH__executable__/../../data\nwrite-data=${writeDir.replace(/\\/g, '/')}\n`);
  for (const name of mods) packageMod(name, modsDir);
  const allItems = [...new Set(Object.values(lookups).flatMap((list) => list.filter((l) => l.type === 'item').map((l) => l.name)))];
  writeProbe(allItems);

  console.log(`${mods.map((name) => `${name} ${readInfo(name).version}`).join(', ')} (${variant}, Factorio ${gameVersion})`);

  setModList({ ours: true });
  const log = factorio('--create', join(work, 'smoke.zip'));
  const notLoaded = mods.filter((name) => !log.includes(`Checksum of ${name}:`));
  if (notLoaded.length) throw new Error(`Factorio ran, but these mods didn't load: ${notLoaded.join(', ')}.\n\n${log}`);
  console.log('  loaded and created a save');

  const after = dumpData();
  setModList({ ours: false });
  const before = dumpData();
  setModList({ ours: false, probe: true });
  const weights = readWeights();

  for (const name of mods) {
    const found = lookups[name];
    const missing = found.filter(({ type, name: proto }) => !before[type]?.[proto]);
    if (missing.length && spaceAge) {
      failed = true;
      console.error(`  ${name}: looks up prototypes the game doesn't have:`);
      for (const { type, name: proto } of missing) console.error(`    ${type}/${proto}`);
    } else if (missing.length) {
      console.log(`  ${name}: ${missing.length} looked-up prototypes are absent without Space Age (checked with --space-age)`);
    } else {
      console.log(`  ${name}: every prototype it looks up exists`);
    }

    const items = new Set(found.filter((l) => l.type === 'item').map((l) => l.name));
    const recipes = new Set(found.filter((l) => l.type === 'recipe').map((l) => l.name));
    const unlisted = Object.values(before.recipe ?? {}).filter((recipe) => {
      const products = itemProducts(recipe);
      return !recipes.has(recipe.name) && !isRecycling(recipe) && products.length === 1 && items.has(products[0]);
    });
    for (const recipe of unlisted) console.log(`  ${name}: note: recipe ${recipe.name} makes ${itemProducts(recipe)[0]} but isn't listed`);

    const checkFile = join(modDir(name), 'tests', 'smoke-check.mjs');
    if (existsSync(checkFile)) {
      const { check } = await import(pathToFileURL(checkFile).href);
      const settings = startupDefaults(readSettings(modDir(name)));
      try {
        check({ before, after, variant, settings, weights, dir: modDir(name) });
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
