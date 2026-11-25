---
paths:
  - 'mods/**/*.lua'
  - 'mods/**/locale/**'
---

# Factorio mod Lua rules

The mods run in Factorio's settings and data stages (Lua 5.2).

**Never guess about the modding API. Look it up on https://lua-api.factorio.com**, at the version the mod targets
(`https://lua-api.factorio.com/<version>/`, for example `2.0.77`, or `latest` for current stable). That covers prototypes and
their properties, types, defaults, the runtime API, the data lifecycle (`/auxiliary/data-lifecycle.html`) and file formats
(`/auxiliary/changelog-format.html`, `/auxiliary/mod-structure.html`). Read the page, or the machine-readable
`prototype-api.json` / `runtime-api.json`, before writing code or text that depends on it, and say which page it came from.
For vanilla prototype names and values, read the game's own data (`npm run smoke -- --keep` leaves a `data-raw-dump.json`) or
its `data/` folder, not memory. If the docs don't answer it, say so and ask; don't fill the gap with an assumption.

- **Everything `local`.** A global in data stage is shared with every other mod. Functions too: `local function`.
- **Guard prototypes that may be absent.** Space Age, Quality and Elevated Rails are optional unless `info.json` requires them, and
  other mods can remove prototypes. Check `data.raw[type][name]` before indexing it; `mods["space-age"]` says what is active.
- **Change prototypes in place, don't replace them,** so other mods' changes survive. Changes that must see other mods' prototypes
  belong in `data-updates.lua` or `data-final-fixes.lua`.
- **Every setting has a locale name** in `locale/en/*.cfg` (`[mod-setting-name]`), and a description where the name isn't enough
  (`[mod-setting-description]`). `npm test` checks the names and that no locale key is left without its setting.
- **Startup settings are read once,** at the top of `data.lua`, through `settings.startup[name].value`.
- **A change a player can see** gets a line in `changelog.txt`, in the top section (see `CLAUDE.md`, "Versions").

After a change: `npm test`. Behaviour in the data stage gets a test in `mods/<mod>/tests/`, against mock `data.raw` through
`scripts/lib/lua.mjs` (see the existing tests). When Factorio is installed, `npm run smoke` loads the mod in the real game.
