# Factorio Mods

My Factorio mods.

| Mod | Description |
| :-- | :-- |
| [Bulk Materials](mods/bulk-materials/README.md) | Production and speed multipliers for gears, circuits, steel, concrete and other intermediates |

Each version is on the [Releases](../../releases) page. Older zips are in [archive](archive/).

## Development

Needs Node 24.

```sh
npm install
npm test
npm run package -- bulk-materials
```

`npm run link -- bulk-materials` links the mod folder into `%APPDATA%\Factorio\mods` so the game loads it straight from here.
Move any `bulk-materials_*.zip` out of the mods folder while it's linked. `--unlink` removes the link.

`npm run smoke` loads every mod in Factorio and creates a save, using a temporary config so saves and the mod list aren't touched.
Set `FACTORIO_BIN` to the game executable. Add `--space-age` to load with Space Age.

Lua linting (luacheck) only runs on GitHub.

## Releasing

1. `npm run version -- bulk-materials patch` (or minor, major, x.y.z). This sets the version in `info.json` and adds a section
   to `changelog.txt`.
2. Fill in the changelog, then `npm test`.
3. Commit and merge to main.
4. On GitHub, Actions, Release, Run workflow, and pick the mod. It tags `bulk-materials/v<version>`, runs the checks and
   creates the release with `bulk-materials_<version>.zip`. Tick dry run to check everything without releasing. Pushing the
   tag yourself does the same.
5. Upload the zip to the mod portal.

## New Factorio versions

`npm run api-diff -- <old> <new> bulk-materials` writes a report of the modding changes between two Factorio versions,
from the API docs and the game's changelog, starting with the ones that touch what the mod uses. Reports are kept in
[docs/factorio-updates](docs/factorio-updates/).
