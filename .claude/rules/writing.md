---
paths:
  - '**/README.md'
  - 'mods/**/changelog.txt'
  - 'mods/**/locale/**'
  - 'mods/**/info.json'
---

# Player-facing text

Players read these files: the READMEs (GitHub and the mod portal page), changelog entries, setting names and descriptions, and the
`info.json` description. They must read like the maintainer wrote them, because the maintainer did: Claude drafts, the maintainer
approves the exact wording, and nothing here is committed before that.

## The voice

Match what's already there. From the Bulk Materials changelog and README:

- "Added multiplers for Engine Units. Base multiplier of x2"
- "Fixed flying robot frame not being updated with either setting"
- "Default multipliers are personal preferences and are in no way balanced"

Short, plain, past tense in the changelog. Item names as players say them. No selling: say what it does and stop.

## Don't

- Emoji, em dashes (—), curly quotes.
- Marketing and filler words: seamless, robust, enhance, streamline, comprehensive, leverage, elevate, effortless, powerful,
  boost, unlock, empower, delve, "a testament to", "whether you're", "take your factory to the next level".
- Bold labels at the start of bullets, "Key features" headers, a closing summary that repeats the list.
- Explaining Factorio to players, or hedging ("may", "should help") about what the mod does. Check the code; state it.
- Describing anything that isn't in the code, or numbers that aren't the defaults in `settings.lua`.

`tests/writing.test.mjs` fails on the mechanical ones (characters and words). The rest is on the review: read the draft aloud
next to the existing text, and show it to the maintainer.

## Changelog

Factorio's format (`npm test` checks it). Categories as Factorio uses them: Features, Changes, Bugfixes, Compatibility, Info.
One entry per change a player can notice. Internal work (tests, CI, refactors) doesn't go in.
