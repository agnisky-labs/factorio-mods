# Roadmap

Future work, not yet scheduled. Each entry says why, what's known, and what's still open.

## Upload releases to the mod portal automatically

**Why:** today the Release workflow publishes the GitHub Release, then the zip is uploaded to mods.factorio.com by hand. Doing it
by hand first was deliberate: Bulk Materials 1.1.0 went through the whole flow cleanly before adding this.

**What's known (Factorio wiki, checked 25. 11. 2026):**

- [Mod upload API](https://wiki.factorio.com/Mod_upload_API): `POST https://mods.factorio.com/api/v2/mods/releases/init_upload`
  returns an `upload_url`, then the zip is posted there (`finish_upload`). Needs an API key with the "ModPortal: Upload Mods"
  usage, created on https://factorio.com/profile.
- [Mod details API](https://wiki.factorio.com/Mod_details_API): `edit_details` can update the portal description. Needs an API
  key with the "ModPortal: Edit Mods" usage. Optional, for keeping the portal page in step with the mod's README.

**Rough shape:**

- A step at the end of `.github/workflows/release.yml`, after the GitHub Release, skipped on a dry run.
- The API key as a repository secret; the workflow fails early, before building anything, with a clear message when it's missing.
- If the portal upload fails, the GitHub Release stays and the zip can still be uploaded by hand.

**Open:**

- Read both wiki pages in full before writing the step: request fields, error responses, and whether the portal rejects a
  version it already has (the workflow should treat that as done, not failed).
- Whether to sync the portal description too, and from which file.
- Test with a dry run that calls `init_upload` only? Check the docs for a safe way to test without publishing.
