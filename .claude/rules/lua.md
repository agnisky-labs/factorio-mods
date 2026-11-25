---
paths:
  - 'mods/**/*.lua'
  - 'mods/**/locale/**'
---

# Factorio mod Lua rules

The mods run in Factorio's settings and data stages (Lua 5.2). The API is at https://lua-api.factorio.com/latest/ (prototypes under
`/prototypes`, the data lifecycle under `/auxiliary/data-lifecycle.html`). The FMTK extension gives types and completion for it in VS Code.

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
