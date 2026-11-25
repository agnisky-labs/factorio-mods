// Checks every mod under mods/ gets: info.json, changelog.txt, settings against locale, and what goes in the zip.
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { readSettings } from '../scripts/lib/lua.mjs';
import { VERSION_PATTERN, listMods, modDir, parseChangelog, readInfo, readText } from '../scripts/lib/mods.mjs';
import { packagedFiles } from '../scripts/lib/package.mjs';
import { readLocale } from '../scripts/lib/locale.mjs';

// "base >= 2.0", "? space-age", "(?) factorioplus >= 2.0.0", "! other-mod", "~ other-mod = 1.2.3"
const DEPENDENCY = /^(?:(?:!|\?|\(\?\)|~)\s*)?[\w-]+(?:\s*(?:<|<=|=|>=|>)\s*\d+\.\d+(?:\.\d+)?)?$/;

test('there is at least one mod', () => {
  assert.ok(listMods().length > 0);
});

for (const name of listMods()) {
  const dir = modDir(name);

  describe(name, () => {
    const info = readInfo(name);

    test('info.json names the mod, its version and the Factorio version', () => {
      assert.equal(info.name, name, 'the name in info.json is the folder name');
      assert.match(info.version, VERSION_PATTERN);
      assert.match(info.factorio_version ?? '', /^\d+\.\d+$/, 'factorio_version is "major.minor"');
      assert.ok(info.title, 'a title');
      assert.ok(info.author, 'an author');
      for (const dependency of info.dependencies ?? []) assert.match(dependency, DEPENDENCY);
    });

    test('changelog.txt is in Factorio format and its top section is the version in info.json', () => {
      const { sections, errors } = parseChangelog(readText(join(dir, 'changelog.txt')));
      assert.deepEqual(errors, []);
      assert.equal(sections[0].version, info.version, 'the top section is the current version (npm run version)');
      const versions = sections.map((s) => s.version);
      assert.deepEqual(versions, [...new Set(versions)], 'each version once');
      for (const s of sections) assert.ok(s.date, `${s.version} has a Date line`);
    });

    test('every setting has a locale name, and every setting locale key has a setting', () => {
      const settings = readSettings(dir);
      const names = settings.map((s) => s.name);
      assert.deepEqual(names, [...new Set(names)], 'setting names are unique');
      const locales = readLocale(dir);
      assert.ok(locales.en, 'an English locale');
      for (const [language, sections] of Object.entries(locales)) {
        for (const section of ['mod-setting-name', 'mod-setting-description']) {
          for (const key of Object.keys(sections[section] ?? {})) {
            assert.ok(names.includes(key), `${language} [${section}] ${key} is not a setting`);
          }
        }
      }
      for (const setting of names) assert.ok(locales.en['mod-setting-name']?.[setting], `no [mod-setting-name] ${setting} in en`);
    });

    test('setting defaults are inside their limits', () => {
      for (const s of readSettings(dir)) {
        assert.ok(['startup', 'runtime-global', 'runtime-per-user'].includes(s.setting_type), `${s.name}: setting_type`);
        if (s.minimum_value !== undefined) assert.ok(s.default_value >= s.minimum_value, `${s.name}: default below minimum`);
        if (s.maximum_value !== undefined) assert.ok(s.default_value <= s.maximum_value, `${s.name}: default above maximum`);
        if (s.allowed_values) assert.ok(s.allowed_values.includes(s.default_value), `${s.name}: default not allowed`);
      }
    });

    test('the zip holds the mod files and nothing for development', () => {
      const files = packagedFiles(name);
      for (const required of ['info.json', 'changelog.txt']) assert.ok(files.includes(required), `${required} is packaged`);
      if (existsSync(join(dir, 'thumbnail.png'))) assert.ok(files.includes('thumbnail.png'));
      for (const file of files) {
        assert.ok(!file.startsWith('tests/') && !file.endsWith('.md') && !file.split('/').some((p) => p.startsWith('.')), file);
      }
      const lua = readdirSync(dir).filter((file) => file.endsWith('.lua'));
      for (const file of lua) assert.ok(files.includes(file), `${file} is packaged`);
    });
  });
}
