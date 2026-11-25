---
paths:
  - '.github/**'
---

# GitHub Actions rules

Workflows use the newest version of every action. Never copy a version from memory, an older workflow or an example: they go stale.

1. **Look up the version before you write or change a `uses:` line,** and check the ones already in the file while you are there. `gh` is not installed here. Ask the public API, which needs no token and sends nothing about this project:
   `curl -s -H "User-Agent: release-check" https://api.github.com/repos/<owner>/<action>/releases/latest`
2. **Use the newest major tag** (`actions/checkout@v7` when the latest release is `v7.0.1`). Never a pre-release or a release candidate.
3. **Read the release notes of every major you skip** and adjust the workflow for what they changed: removed or renamed inputs, new defaults, the runner version they need.
4. **Say what changed** when you report: each action, the version it was on, the version it is on now, and anything in the notes that mattered.

`FACTORIO_VERSION` in `ci.yml` is the Factorio the mods load in. Its major.minor must match the `factorio_version` in the mods' `info.json`; they move together.

The workflows are described in `README.md` ("CI and releases"). Keep that section current when a job changes.
