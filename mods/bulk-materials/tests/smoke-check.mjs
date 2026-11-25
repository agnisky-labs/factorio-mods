// Run by `npm run smoke` against the real game: data.raw before and after Bulk Materials at default settings, and the game's own
// item weights with Bulk Materials off.
import assert from 'node:assert/strict';
import { readReturn } from '../../../scripts/lib/lua.mjs';

const amount = (raw, recipe, item) => raw.recipe[recipe]?.results?.find((r) => r.name === item)?.amount;
const time = (raw, recipe) => raw.recipe[recipe]?.energy_required ?? 0.5;

export function check({ before, after, variant, settings, weights, dir }) {
  const recipes = [
    ['iron-gear-wheel', 'iron-gear-wheel'],
    ['electronic-circuit', 'electronic-circuit'],
    ['concrete', 'concrete'],
  ];
  if (variant === 'space-age') {
    recipes.push(['casting-iron-gear-wheel', 'iron-gear-wheel'], ['artificial-yumako-soil', 'artificial-yumako-soil'], ['biosulfur', 'sulfur']);
  }

  for (const [recipe, item] of recipes) {
    const base = amount(before, recipe, item);
    assert.ok(base, `${recipe} has no ${item} result in the game`);
    assert.equal(amount(after, recipe, item), Math.floor(base * settings[`${item}-output-multiplier`]), `${recipe} output`);
    const speed = settings[`${item}-speed-multiplier`];
    const expected = speed > 1 ? Math.max(time(before, recipe) / speed, Math.min(time(before, recipe), 0.02)) : time(before, recipe);
    assert.equal(time(after, recipe), expected, `${recipe} time`);
  }

  // items.lua's weights are the vanilla Space Age weights the normalization setting restores.
  if (variant === 'space-age') {
    const items = readReturn(dir, 'items.lua');
    const wrong = items
      .filter((item) => Math.abs(weights[item.name] - item.weight) > 0.01)
      .map((item) => `${item.name}: items.lua ${item.weight}, game ${weights[item.name]}`);
    assert.ok(Object.keys(weights).length > 0, 'the weight probe logged nothing');
    assert.deepEqual(wrong, [], `weights differ from the game:\n    ${wrong.join('\n    ')}`);
  }
}
