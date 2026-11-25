// Mod discovery, info.json and changelog.txt (https://wiki.factorio.com/Tutorial:Mod_changelog_format).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODS_DIR = join(ROOT, 'mods');
export const DIST_DIR = join(ROOT, 'dist');

export const SEPARATOR = '-'.repeat(99);
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** The folder names under mods/ that hold an info.json. */
export function listMods() {
  return readdirSync(MODS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(MODS_DIR, entry.name, 'info.json')))
    .map((entry) => entry.name)
    .sort();
}

export function modDir(name) {
  return join(MODS_DIR, name);
}

/** The mod's folder, or an error naming the mods there are. */
export function requireMod(name) {
  const mods = listMods();
  if (!name || !mods.includes(name)) {
    throw new Error(`${name ? `No mod named '${name}'` : 'A mod name is required'}. Mods: ${mods.join(', ')}`);
  }
  return modDir(name);
}

export function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

export function readInfo(name) {
  return JSON.parse(readText(join(modDir(name), 'info.json')));
}

/** Sets the version in info.json, keeping the rest of the file as written. */
export function writeInfoVersion(name, version) {
  const path = join(modDir(name), 'info.json');
  const text = readText(path);
  const updated = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  if (updated === text && readInfo(name).version !== version) throw new Error(`No "version" field in ${path}`);
  writeFileSync(path, updated);
}

/** The date style of Wube's own changelog: DD. MM. YYYY. */
export function factorioDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}. ${pad(date.getMonth() + 1)}. ${date.getFullYear()}`;
}

export function bumpVersion(version, part) {
  if (VERSION_PATTERN.test(part)) return part;
  const [major, minor, patch] = version.split('.').map(Number);
  switch (part) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`'${part}' is not major, minor, patch or a version x.y.z`);
  }
}

export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/**
 * Parses changelog.txt. Returns { sections, errors }: each section is { version, date, categories: [{ name, entries }], start, end }
 * (start and end are line indexes, end exclusive), and errors lists every line that breaks the format, as "line N: why".
 */
export function parseChangelog(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  const errors = [];
  let section = null;
  let category = null;
  let entry = false;

  lines.forEach((line, i) => {
    const at = `line ${i + 1}`;
    if (line === SEPARATOR) {
      if (section) section.end = i;
      section = { version: null, date: null, categories: [], start: i, end: lines.length };
      sections.push(section);
      category = null;
      entry = false;
      return;
    }
    if (line.trim() === '') return;
    if (/\s$/.test(line)) errors.push(`${at}: trailing whitespace`);
    if (!section) {
      errors.push(`${at}: text before the first separator line (99 dashes)`);
      return;
    }
    let match;
    if ((match = /^Version: (.+)$/.exec(line))) {
      if (section.version !== null) errors.push(`${at}: a second Version line in one section`);
      section.version = match[1].trim();
      if (!VERSION_PATTERN.test(section.version)) errors.push(`${at}: '${section.version}' is not a version x.y.z`);
    } else if ((match = /^Date: (.+)$/.exec(line))) {
      section.date = match[1].trim();
    } else if ((match = /^ {2}(\S.*):$/.exec(line))) {
      category = { name: match[1], entries: [] };
      section.categories.push(category);
      entry = false;
    } else if ((match = /^ {4}- (.+)$/.exec(line))) {
      if (!category) errors.push(`${at}: an entry outside a category`);
      else category.entries.push(match[1]);
      entry = true;
    } else if (/^ {6}\S/.test(line)) {
      if (!entry) errors.push(`${at}: a continuation line (6 spaces) without an entry above it`);
      else category.entries[category.entries.length - 1] += ` ${line.trim()}`;
    } else {
      errors.push(`${at}: not a Version, Date, category ("  Name:"), entry ("    - text") or continuation ("      text") line`);
    }
  });

  for (const s of sections) {
    const where = `the section at line ${s.start + 1}`;
    if (!s.version) errors.push(`${where} has no Version line`);
    if (s.categories.length === 0) errors.push(`${where} (${s.version}) has no categories`);
    for (const c of s.categories) {
      if (c.entries.length === 0) errors.push(`${where} (${s.version}): category '${c.name}' has no entries`);
    }
  }
  if (sections.length === 0) errors.push('no sections: the file must start with a separator line (99 dashes)');
  return { sections, errors };
}

/** The text of one version's section, without its separator line. */
export function changelogSection(text, version) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const section = parseChangelog(text).sections.find((s) => s.version === version);
  if (!section) return null;
  return lines.slice(section.start + 1, section.end).join('\n').trimEnd() + '\n';
}
