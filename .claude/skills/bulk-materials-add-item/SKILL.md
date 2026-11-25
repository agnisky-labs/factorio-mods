---
name: bulk-materials-add-item
description: Add an item to Bulk Materials (an output and a speed multiplier for its recipes). Use when the maintainer wants Bulk Materials to cover another item or recipe.
---

# Add an item to Bulk Materials

An item touches five places in `mods/bulk-materials/`. `npm test` fails until all of them agree.

1. **`data.lua`:** the item and its recipes in `base_items` (`["item"] = {"recipe", ...}`), its foundry or other Space Age recipes in
   `foundry_items` when it has some, and its weight in `default_weight` (the vanilla Space Age weight, for normalized rocket weight).
   Look up the recipe and item names in the game's prototypes (`data/base/prototypes/recipe.lua`, `data/space-age/...`) or on
   https://wiki.factorio.com.
2. **`settings.lua`:** `<item>-output-multiplier` (1 to 128) and `<item>-speed-multiplier` (1 to 25), with the next `order` letters
   (`p`, `zp`, ...). The maintainer picks the default output multiplier.
3. **`locale/en/strings.cfg`:** both setting names, and a description of the output multiplier giving the base recipe's yield.
4. **`README.md`:** a row in the table, named the way the other rows are (plural, as players say it), and the same label in
   `README_ROWS` in `tests/bulk-materials.test.mjs`. Show the maintainer the row and the locale text before committing.
5. **`changelog.txt`:** "Added multipliers for <Item>. Base multiplier of x<n>" under Features, in the top section. When the top
   section is already released, open the next version first (the `release` skill, or `npm run version -- bulk-materials minor`).

If the item exists only with Space Age, add it to `SPACE_AGE_ONLY` in `tests/bulk-materials.test.mjs`, and its Space Age recipes to
`FOUNDRY` there, so the base-only tests leave it out. Then `npm test`.
