// Reads a mod's locale files (locale/<language>/*.cfg): { [language]: { [section]: { [key]: text } } }.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from './mods.mjs';

export function readLocale(dir) {
  const root = join(dir, 'locale');
  if (!existsSync(root)) return {};
  const result = {};
  for (const language of readdirSync(root)) {
    const sections = (result[language] = {});
    for (const file of readdirSync(join(root, language)).filter((f) => f.endsWith('.cfg'))) {
      let section = '';
      for (const line of readText(join(root, language, file)).split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
        const header = /^\[(.+)\]$/.exec(trimmed);
        if (header) {
          section = header[1];
          continue;
        }
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        (sections[section] ??= {})[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
      }
    }
  }
  return result;
}
