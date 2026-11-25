---
name: release
description: Prepare a release of one mod: choose the version, set it (info.json and the changelog section), review, check in the real game, commit and tag. The maintainer pushes; the Release workflow publishes the GitHub Release. Use when the maintainer asks to release, cut a version, or ship a mod.
---

# Release

Never push. Commits carry no AI attribution line.

1. **What's in it:** `git log <mod>/v<last>..HEAD -- mods/<mod>` (or since the last release commit when there's no tag yet), and
   the top section of `mods/<mod>/changelog.txt`. Propose the version and why: patch for fixes, minor for new items or settings
   or a new Factorio version, major for changes that break saves or remove settings. The maintainer decides.
2. **A new Factorio version?** If `factorio_version` changes, the report from `npm run api-diff` must exist in
   `docs/factorio-updates/` and every item in the mod's section must be dealt with or explained. `FACTORIO_VERSION` in
   `.github/workflows/ci.yml` changes with it.
3. **Set it:** `npm run version -- <mod> <patch|minor|major|x.y.z>`.
4. **The changelog:** draft one entry per change a player can notice, following `.claude/rules/writing.md`. Show the maintainer
   the exact text; change it until they approve it.
5. **Review:** run `/code-review` on the diff since the last release and fix what it finds.
6. **Checks:** `npm test`, `npm run smoke`, `npm run smoke -- --space-age`. A failure is fixed, never skipped.
7. **In the game,** by the maintainer, with `npm run link -- <mod>` and any `<mod>_*.zip` moved out of the mods folder: the settings
   show their names and descriptions, and the changed behaviour works (for Bulk Materials: an assembler on gears shows the
   multiplied output and the right time, with and without Space Age).
8. **Commit and tag,** once asked: commit `Release <mod> <version>`, then `git tag <mod>/v<version>`.
9. **What's left for the maintainer:** `git push` and `git push origin <mod>/v<version>` (the Release workflow builds the GitHub
   Release), then upload the zip from the release to https://mods.factorio.com/.
