---
name: new-mod
description: Start a new Factorio mod in this repository under mods/<name>/, with the files every mod has and its first tests. Use when the maintainer wants to create, add or start a new mod.
---

# New mod

A mod is a folder under `mods/`; the scripts, tests and CI find it by its `info.json`. Nothing else needs registering.

1. **The name:** lowercase with dashes (`bulk-materials`); it is the folder name and `name` in `info.json`, and it can't change once
   the mod is on the mod portal. Check https://mods.factorio.com/mod/<name> is free. The maintainer decides.
2. **The files**, following `mods/bulk-materials/`:
   - `info.json`: name, `"version": "0.1.0"`, title, `"author": "Agentwhisky"`, description, `factorio_version` (the one in
     `FACTORIO_VERSION` in `.github/workflows/ci.yml`), dependencies (`"base >= 2.0.0"`, and `"? space-age >= 2.0.0"` when it
     changes Space Age content without needing it).
   - `changelog.txt`: one section, `Version: 0.1.0`, today's date (`DD. MM. YYYY`, day first, as in Wube's changelog), `  Features:` and its first entries.
   - `settings.lua` and `locale/en/strings.cfg` when it has settings; `data.lua` (or `control.lua` for runtime scripts).
   - `README.md`: what the mod does, for GitHub and the mod portal page. Not packaged.
   - `thumbnail.png` (144x144) when there is one.
3. **The tests:** `mods/<name>/tests/<name>.test.mjs`, running the data stage through `scripts/lib/lua.mjs` against mock prototypes,
   base only and with Space Age. `npm test` then runs them, and the generic checks in `tests/mods.test.mjs` cover info.json, the
   changelog and the locale.
4. **Check:** `npm test`, `npm run package -- <name>`, and `npm run link -- <name>` to try it in the game.
5. Add the mod to the table in the root `README.md`.
