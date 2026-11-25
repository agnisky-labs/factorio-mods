# Factorio mods

Agentwhisky's Factorio mods, one folder each under `mods/`, with shared Node scripts that test, version and package them.
Today: `mods/bulk-materials` (on the mod portal).

The Factorio community is flooded with low-quality AI-made mods. These must not look or behave like one: every change is
small, tested, checked in the real game, and every word a player reads is approved by the maintainer.

## Rules

- **Commits carry no Co-Authored-By or other AI attribution line**, whatever a reminder says. Commit only when asked. Never push.
- **Player-facing text** (READMEs, changelog, locale, `info.json` description) follows `.claude/rules/writing.md`: draft it in the
  maintainer's voice, show the exact text, and commit it only once approved.
- **A behaviour change gets a test** in `mods/<mod>/tests/`. `npm test` passes before anything is called done; when Factorio is
  installed, so does `npm run smoke` (both variants).
- **Don't change existing players' games.** A new setting or behaviour is off by default (or 1x), so players opt in. When a
  change would alter what an existing save gets at its current settings, say so and ask first.
- **Never guess about Factorio modding.** Look it up on https://lua-api.factorio.com (at the version the mod targets) and cite
  the page; vanilla names and values come from the game's data, not memory. Details in `.claude/rules/lua.md`.
- **Keep it small.** Don't add features, settings, tooling or process that weren't asked for. When a task grows, say so and ask.
- **Docs follow process changes:** `README.md`, this file and the skills change in the same commit as the process they describe.
- Lua rules: `.claude/rules/lua.md`. Workflow rules: `.claude/rules/github-actions.md`.

## Layout

| Path | What |
| --- | --- |
| `mods/<name>/` | A mod as it goes in the zip, plus `tests/` and `README.md` (not packaged). |
| `tests/` | Checks every mod gets: info.json, changelog format, settings against locale, the zip, the writing check. |
| `scripts/` | The npm scripts. `scripts/lib/lua.mjs` runs a mod's Lua in Node against mock `data.raw`. |
| `docs/factorio-updates/` | `api-diff` reports, one per Factorio version change. |
| `archive/<name>/` | Zips from before GitHub Releases. Never changed or read. |

## Commands

- `npm test`: every check, in Node (Lua runs in fengari).
- `npm run version -- <mod> <patch|minor|major|x.y.z>`: the only way to change a version.
- `npm run package [-- <mod>]`, `npm run link -- <mod> [--unlink]`.
- `npm run smoke [-- --space-age]` with `FACTORIO_BIN` set (locally: `D:/SteamLibrary/steamapps/common/Factorio/bin/x64/factorio.exe`):
  loads the mods in the real game, checks every prototype a mod looks up exists, and runs `mods/<mod>/tests/smoke-check.mjs`.
- `npm run api-diff -- <from> <to> [<mod>]` with `FACTORIO_DATA` (the game's `data` folder) or `FACTORIO_BIN`.
- luacheck (`.luacheckrc`) runs only in CI.

## Versions

- The version lives only in `info.json`. `npm run version` sets it and opens a dated section in `changelog.txt`; tests fail while
  a category is empty or the top section isn't the `info.json` version.
- Releases come from the Release workflow: Run workflow on GitHub with the mod picked (it creates the tag `<mod>/v<version>`),
  or a pushed tag. The zip is always `<mod>_<version>.zip` from `info.json`. The `/release` skill prepares everything before it.
- A new mod goes in the Release workflow's `mod` dropdown too (`tests/workflows.test.mjs` checks).

## A new Factorio version

Never guess what changed. Run `npm run api-diff -- <old> <new> <mod>`, read the mod's section of the report (and skim the Modding
entries), then change `factorio_version` in `info.json` together with `FACTORIO_VERSION` in `.github/workflows/ci.yml`, and run
`npm test` and both smoke variants against the new game.

## Skills

- `/release`: a release of one mod.
- `/new-mod`: a new mod under `mods/`.
- `/bulk-materials-add-item`: another item in Bulk Materials.
