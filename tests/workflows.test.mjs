// The Release workflow's mod dropdown lists exactly the mods under mods/.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, listMods, readText } from '../scripts/lib/mods.mjs';

test("the Release workflow's mod dropdown lists every mod", () => {
  const workflow = readText(join(ROOT, '.github', 'workflows', 'release.yml'));
  const match = /^\s+mod:\n(?:\s+(?:#.*|\w[\w-]*:.*)\n)*?\s+options: \[([^\]]*)\]/m.exec(workflow);
  assert.ok(match, "no 'options: [...]' under the mod input in release.yml");
  const options = match[1].split(',').map((option) => option.trim()).filter(Boolean);
  assert.deepEqual([...options].sort(), listMods());
});
