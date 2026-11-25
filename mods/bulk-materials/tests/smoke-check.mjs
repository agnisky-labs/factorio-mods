// Run by `npm run smoke` against the real game's data.raw, before and after Bulk Materials, at default settings.
import assert from 'node:assert/strict';

const amount = (raw, recipe, item) => raw.recipe[recipe]?.results?.find((r) => r.name === item)?.amount;
const time = (raw, recipe) => raw.recipe[recipe]?.energy_required ?? 0.5;

export function check({ before, after, variant, settings }) {
  const recipes = [
    ['iron-gear-wheel', 'iron-gear-wheel'],
    ['electronic-circuit', 'electronic-circuit'],
    ['concrete', 'concrete'],
  ];
  if (variant === 'space-age') recipes.push(['casting-iron-gear-wheel', 'iron-gear-wheel'], ['artificial-yumako-soil', 'artificial-yumako-soil']);

  for (const [recipe, item] of recipes) {
    const base = amount(before, recipe, item);
    assert.ok(base, `${recipe} has no ${item} result in the game`);
    assert.equal(amount(after, recipe, item), Math.floor(base * settings[`${item}-output-multiplier`]), `${recipe} output`);
    const speed = settings[`${item}-speed-multiplier`];
    assert.equal(time(after, recipe), Math.max(0.02, time(before, recipe) / speed), `${recipe} time`);
  }
}
