// The data stage of Bulk Materials against vanilla-like recipes and items, with chosen startup settings.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readSettings, runDataStage, startupDefaults } from '../../../scripts/lib/lua.mjs';
import { readText } from '../../../scripts/lib/mods.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETTINGS = readSettings(DIR);

// The items the mod multiplies, from the names of its output settings.
const ITEMS = SETTINGS.filter((s) => s.name.endsWith('-output-multiplier')).map((s) => s.name.replace(/-output-multiplier$/, ''));
const SPACE_AGE_ONLY = ['artificial-yumako-soil', 'artificial-jellynut-soil', 'quantum-processor'];
const FOUNDRY = {
  'casting-iron-gear-wheel': 'iron-gear-wheel',
  'casting-iron-stick': 'iron-stick',
  'casting-steel': 'steel-plate',
  'concrete-from-molten-iron': 'concrete',
  'casting-low-density-structure': 'low-density-structure',
};

function recipe(name, product, amount = 1, energy = 1) {
  return { type: 'recipe', name, energy_required: energy, results: [{ type: 'item', name: product, amount }] };
}

/** data.raw for the base game, or with Space Age: each item and its recipe of the same name, and the foundry's recipes. */
function fixture({ spaceAge }) {
  const raw = { recipe: {}, item: {} };
  for (const item of ITEMS) {
    if (!spaceAge && SPACE_AGE_ONLY.includes(item)) continue;
    raw.item[item] = { type: 'item', name: item, weight: 7 };
    raw.recipe[item] = recipe(item, item, 2, 4);
  }
  if (spaceAge) for (const [name, item] of Object.entries(FOUNDRY)) raw.recipe[name] = recipe(name, item, 3, 8);
  return raw;
}

const MODS = { base: { base: '2.0.0' }, spaceAge: { base: '2.0.0', 'space-age': '2.0.0', quality: '2.0.0', 'elevated-rails': '2.0.0' } };

function run({ spaceAge = true, raw = fixture({ spaceAge }), settings = {} } = {}) {
  return runDataStage(DIR, { raw, mods: spaceAge ? MODS.spaceAge : MODS.base, settings: startupDefaults(SETTINGS, settings) }).raw;
}

function every(suffix, value) {
  return Object.fromEntries(ITEMS.map((item) => [`${item}${suffix}`, value]));
}

describe('settings', () => {
  test('every item has an output and a speed multiplier', () => {
    const names = SETTINGS.map((s) => s.name);
    for (const item of ITEMS) assert.ok(names.includes(`${item}-speed-multiplier`), `${item}-speed-multiplier`);
    const speed = names.filter((n) => n.endsWith('-speed-multiplier'));
    assert.equal(speed.length, ITEMS.length, 'no speed multiplier without an output multiplier');
  });
});

describe('output multipliers', () => {
  test('multiply the amount of every item the mod has a setting for', () => {
    const raw = run({ settings: every('-output-multiplier', 3) });
    for (const item of ITEMS) assert.equal(raw.recipe[item].results[0].amount, 6, item);
  });

  test('use the defaults when nothing is changed', () => {
    const raw = run();
    const defaults = startupDefaults(SETTINGS);
    for (const item of ITEMS) assert.equal(raw.recipe[item].results[0].amount, 2 * defaults[`${item}-output-multiplier`], item);
  });

  test('change only the matching result of a recipe', () => {
    const raw = fixture({ spaceAge: true });
    raw.recipe['iron-gear-wheel'].results.push({ type: 'fluid', name: 'water', amount: 10 });
    const out = run({ raw, settings: { 'iron-gear-wheel-output-multiplier': 5 } });
    assert.deepEqual(
      out.recipe['iron-gear-wheel'].results.map((r) => [r.name, r.amount]),
      [['iron-gear-wheel', 10], ['water', 10]],
    );
  });

  test('apply to the foundry recipes with Space Age', () => {
    const raw = run({ settings: every('-output-multiplier', 2) });
    for (const [name, item] of Object.entries(FOUNDRY)) assert.equal(raw.recipe[name].results[0].amount, 6, `${name} (${item})`);
  });

  test('leave recipes of other mods alone', () => {
    const raw = fixture({ spaceAge: true });
    raw.recipe['other-gears'] = recipe('other-gears', 'iron-gear-wheel', 1, 1);
    const out = run({ raw, settings: every('-output-multiplier', 4) });
    assert.equal(out.recipe['other-gears'].results[0].amount, 1);
  });
});

describe('speed multipliers', () => {
  test('divide the crafting time', () => {
    const raw = run({ settings: { 'iron-gear-wheel-speed-multiplier': 4 } });
    assert.equal(raw.recipe['iron-gear-wheel'].energy_required, 1);
    assert.equal(raw.recipe['casting-iron-gear-wheel'].energy_required, 2);
    assert.equal(raw.recipe['iron-stick'].energy_required, 4, 'other items keep their time');
  });

  test('start from 0.5 seconds when a recipe leaves its time out', () => {
    const raw = fixture({ spaceAge: true });
    delete raw.recipe['iron-gear-wheel'].energy_required;
    const out = run({ raw, settings: { 'iron-gear-wheel-speed-multiplier': 5 } });
    assert.equal(out.recipe['iron-gear-wheel'].energy_required, 0.1);
  });

  test('never take a recipe below 0.02 seconds', () => {
    const raw = fixture({ spaceAge: true });
    raw.recipe['iron-gear-wheel'].energy_required = 0.3;
    const out = run({ raw, settings: every('-speed-multiplier', 25) });
    assert.equal(out.recipe['iron-gear-wheel'].energy_required, 0.02);
    for (const r of Object.values(out.recipe)) assert.ok(r.energy_required >= 0.02, r.name);
  });
});

describe('without Space Age', () => {
  test('loads with every setting at its maximum', () => {
    const max = Object.fromEntries(SETTINGS.filter((s) => s.maximum_value !== undefined).map((s) => [s.name, s.maximum_value]));
    const raw = run({ spaceAge: false, settings: max });
    assert.equal(raw.recipe['iron-gear-wheel'].results[0].amount, 2 * max['iron-gear-wheel-output-multiplier']);
    assert.equal(raw.recipe['casting-iron-gear-wheel'], undefined);
  });

  test('loads with normalized rocket weight on (the Space Age items are absent)', () => {
    const raw = run({ spaceAge: false, settings: { 'enable-normalized-rocket-weight': true } });
    assert.equal(raw.item['artificial-yumako-soil'], undefined);
    assert.equal(raw.item['iron-gear-wheel'].weight, 1000);
  });
});

describe('normalized rocket weight', () => {
  test('is off by default: weights are left alone', () => {
    const raw = run();
    for (const item of ITEMS) assert.equal(raw.item[item].weight, 7, item);
  });

  test('when on, sets a weight for every item', () => {
    const raw = run({ settings: { 'enable-normalized-rocket-weight': true } });
    for (const item of ITEMS) {
      assert.equal(typeof raw.item[item].weight, 'number', item);
      assert.notEqual(raw.item[item].weight, 7, item);
    }
  });
});

// README row label -> the items it stands for. A new item needs a row and an entry here.
const README_ROWS = {
  'Iron Gears': ['iron-gear-wheel'],
  'Iron Sticks': ['iron-stick'],
  'Steel Plate': ['steel-plate'],
  Concrete: ['concrete'],
  'Engine Units': ['engine-unit'],
  'Electric Engine Units': ['electric-engine-unit'],
  'Electronic Circuits (green)': ['electronic-circuit'],
  'Advanced Circuits (red)': ['advanced-circuit'],
  'Processing Units (blue)': ['processing-unit'],
  'Low Density Structures': ['low-density-structure'],
  'Flying Robot Frames': ['flying-robot-frame'],
  'Artificial Soil': ['artificial-yumako-soil', 'artificial-jellynut-soil'],
  'Quantum Processors': ['quantum-processor'],
  Sulfur: ['sulfur'],
};

describe('README', () => {
  const rows = readText(join(DIR, 'README.md'))
    .split('\n')
    .filter((line) => /^\|.*\|$/.test(line.trim()))
    .map((line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim().replace(/`/g, '')))
    .filter((cells) => cells.length === 3 && !/^:?-+:?$/.test(cells[0]) && cells[0] !== 'Item');

  test('has a row for every item', () => {
    assert.deepEqual(rows.map(([label]) => label).sort(), Object.keys(README_ROWS).sort());
    assert.deepEqual(Object.values(README_ROWS).flat().sort(), [...ITEMS].sort());
  });

  test('its defaults match settings.lua', () => {
    const defaults = startupDefaults(SETTINGS);
    for (const [label, output, speed] of rows) {
      for (const item of README_ROWS[label] ?? []) {
        assert.equal(output, `${defaults[`${item}-output-multiplier`]}x`, `${label} production (${item})`);
        assert.equal(speed, `${defaults[`${item}-speed-multiplier`]}x`, `${label} speed (${item})`);
      }
    }
  });
});
