---
name: bulk-materials-add-item
description: Add an item to Bulk Materials (an output and a speed multiplier for its recipes). Use when the maintainer wants Bulk Materials to cover another item or recipe.
---

# Add an item to Bulk Materials

New items start at 1x output (the maintainer may choose otherwise, but existing players' games must not change without asking).
Look everything up in the game's data and https://lua-api.factorio.com, never from memory.

1. **`mods/bulk-materials/items.lua`:** one entry at the end:
   `{name = "<item>", order = "<next letter>", output = 1, recipes = {"<recipe>", ...}, weight = <vanilla weight>}`.
   - Recipes: every vanilla recipe whose only item product is this item, from `data/base/prototypes/recipe.lua` and
     `data/space-age/prototypes/recipe.lua`. `npm run smoke -- --space-age` lists recipes that make a listed item but aren't listed.
   - Weight: the vanilla Space Age weight. Put any number in, run `npm run smoke -- --space-age`, and use the game's value from the
     failure message (the smoke check compares every weight with the game).
2. **`locale/en/strings.cfg`:** names and descriptions for `<item>-output-multiplier` and `<item>-speed-multiplier`, in the
   same form as the others, with the base yield of each recipe from the game files.
3. **`README.md`:** a row in the table, named the way the other rows are, and the same label in `README_ROWS` in
   `tests/bulk-materials.test.mjs`.
4. **Tests:** regenerate `tests/settings-snapshot.json` (only the two new settings may appear in its diff). If the item exists
   only with Space Age, add it to `SPACE_AGE_ONLY` in the test, and its other Space Age recipes to `FOUNDRY`.
5. **`changelog.txt`:** "Added multipliers for <Item>. Base multiplier of x<n>" under Features, in the top section.

Show the maintainer the locale lines, README row and changelog entry before committing. Then `npm test` and both smoke variants.
