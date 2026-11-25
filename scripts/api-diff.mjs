// npm run api-diff -- <from> <to> [<mod>...] [--out <file>]
// Modding changes between two Factorio versions, from the API JSON (lua-api.factorio.com, cached in .factorio/api/) and the
// game's changelog.txt (FACTORIO_DATA or next to FACTORIO_BIN). Writes docs/factorio-updates/<from>-to-<to>.md.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { prototypeLookups, readSettings } from './lib/lua.mjs';
import { ROOT, compareVersions, listMods, modDir, readText, requireMod } from './lib/mods.mjs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outArg = outIndex >= 0 ? args.splice(outIndex, 2)[1] : null;
const [from, to, ...modArgs] = args;

// ---- API docs

async function api(version, stage) {
  const path = join(ROOT, '.factorio', 'api', version, `${stage}-api.json`);
  if (!existsSync(path)) {
    const url = `https://lua-api.factorio.com/${version}/${stage}-api.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await response.text());
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const byName = (list = []) => new Map(list.map((entry) => [entry.name, entry]));
const show = (value) => (value === undefined ? '-' : typeof value === 'string' ? value : JSON.stringify(value));

function typeText(type) {
  if (type === undefined) return undefined;
  if (typeof type === 'string') return type;
  switch (type.complex_type) {
    case 'array':
      return `array[${typeText(type.value)}]`;
    case 'dictionary':
      return `dictionary[${typeText(type.key)} -> ${typeText(type.value)}]`;
    case 'union':
      return type.options.map(typeText).join(' | ');
    case 'literal':
      return JSON.stringify(type.value);
    case 'type':
      return typeText(type.value);
    case 'tuple':
      return `{${type.values.map(typeText).join(', ')}}`;
    default:
      return JSON.stringify(type);
  }
}

function propertyText(p) {
  return `${typeText(p.type)}${p.optional ? ' (optional' + (p.default !== undefined ? `, default ${show(p.default?.value ?? p.default)}` : '') + ')' : ''}`;
}

/** A changed type; for unions (also inside arrays) only the options added and removed. */
function typeChange(was, now) {
  const options = (type) => {
    if (type?.complex_type === 'array') type = type.value;
    return type?.complex_type === 'union' ? type.options.map(typeText) : null;
  };
  const a = options(was);
  const b = options(now);
  if (!a || !b) return [`type: ${typeText(was)} -> ${typeText(now)}`];
  return [...b.filter((o) => !a.includes(o)).map((o) => `+ option ${o}`), ...a.filter((o) => !b.includes(o)).map((o) => `- option ${o}`)];
}

/** Differences between two lists of { name, properties }: added, removed, and per common entry its changed properties. */
function diffEntries(oldList, newList, kind) {
  const oldMap = byName(oldList);
  const newMap = byName(newList);
  const added = [...newMap.keys()].filter((name) => !oldMap.has(name)).sort();
  const removed = [...oldMap.keys()].filter((name) => !newMap.has(name)).sort();
  const changed = new Map();
  for (const [name, now] of newMap) {
    const was = oldMap.get(name);
    if (!was) continue;
    const lines = [];
    if (was.parent !== now.parent) lines.push(`parent: ${show(was.parent)} -> ${show(now.parent)}`);
    if (typeText(was.type) !== typeText(now.type)) lines.push(...typeChange(was.type, now.type));
    if (!was.deprecated && now.deprecated) lines.push('now deprecated');
    const oldProps = byName(was.properties);
    const newProps = byName(now.properties);
    for (const [prop, p] of newProps) {
      const q = oldProps.get(prop);
      if (!q) lines.push(`+ ${prop}: ${propertyText(p)}`);
      else if (propertyText(p) !== propertyText(q)) lines.push(`~ ${prop}: ${propertyText(q)} -> ${propertyText(p)}`);
    }
    for (const prop of oldProps.keys()) if (!newProps.has(prop)) lines.push(`- ${prop}`);
    if (lines.length) changed.set(name, lines);
  }
  return { kind, added, removed, changed };
}

/** Type names a type expression refers to. */
function referencedTypes(type, out = new Set()) {
  if (!type) return out;
  if (typeof type === 'string') out.add(type);
  else if (Array.isArray(type)) type.forEach((t) => referencedTypes(t, out));
  else if (typeof type === 'object') {
    if (type.complex_type === 'type') referencedTypes(type.value, out);
    for (const key of ['value', 'key', 'options', 'values']) if (key in type && type.complex_type !== 'literal') referencedTypes(type[key], out);
  }
  return out;
}

/** The prototypes and types a mod uses: its data.raw types and setting types, their parents, and the types their properties use. */
function usedApi(mod, prototypeApi) {
  const prototypes = byName(prototypeApi.prototypes);
  const types = byName(prototypeApi.types);
  const byTypename = new Map(prototypeApi.prototypes.filter((p) => p.typename).map((p) => [p.typename, p.name]));
  const dir = modDir(mod);

  const lookups = prototypeLookups(dir);
  const typenames = new Set([...lookups.map((l) => l.type), ...readSettings(dir).map((s) => s.type)]);
  const used = new Set();
  for (const typename of typenames) {
    let name = byTypename.get(typename);
    while (name && !used.has(name)) {
      used.add(name);
      name = prototypes.get(name)?.parent;
    }
  }

  // Property names the Lua reads or writes (".name" or ["name"]).
  const lua = readdirSync(dir, { recursive: true })
    .filter((file) => String(file).endsWith('.lua'))
    .map((file) => readText(join(dir, String(file))))
    .join('\n');
  const touched = new Set([...lua.matchAll(/\.([a-z_][a-z0-9_]*)\b|\[\s*["']([a-z_][a-z0-9_]*)["']\s*\]/g)].map((m) => m[1] ?? m[2]));

  // Follow only the properties the Lua touches (recipe.results -> ProductPrototype -> ItemProductPrototype), with parents.
  const addWithParents = (name, next) => {
    while (name && !used.has(name) && (types.has(name) || prototypes.has(name))) {
      used.add(name);
      next.push(name);
      name = (types.get(name) ?? prototypes.get(name))?.parent;
    }
  };
  let frontier = [...used];
  for (let depth = 0; depth < 4 && frontier.length; depth++) {
    const next = [];
    for (const name of frontier) {
      const entry = prototypes.get(name) ?? types.get(name);
      const refs = new Set();
      for (const p of entry?.properties ?? []) if (touched.has(p.name)) referencedTypes(p.type, refs);
      if (entry?.type && typeof entry.type === 'object' && entry.type.complex_type === 'union') referencedTypes(entry.type, refs);
      for (const ref of refs) if (types.has(ref)) addWithParents(ref, next);
    }
    frontier = next;
  }

  return { used, lookups, touched, hasControl: existsSync(join(dir, 'control.lua')) };
}

// ---- Changelog

function changelogPath() {
  if (process.env.FACTORIO_DATA) return join(process.env.FACTORIO_DATA, 'changelog.txt');
  if (process.env.FACTORIO_BIN) return join(dirname(process.env.FACTORIO_BIN), '..', '..', 'data', 'changelog.txt');
  const guesses = [
    'C:/Program Files (x86)/Steam/steamapps/common/Factorio/data/changelog.txt',
    'D:/SteamLibrary/steamapps/common/Factorio/data/changelog.txt',
    'C:/Program Files/Factorio/data/changelog.txt',
  ];
  return guesses.find(existsSync);
}

/** Entries of the game changelog for versions after `from` up to `to`: [{ version, category, text }]. */
function changelogEntries(text) {
  const entries = [];
  let version = null;
  let category = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    let match;
    if ((match = /^Version: (\S+)/.exec(line))) version = match[1];
    else if ((match = /^ {2}(\S.*):$/.exec(line))) category = match[1];
    else if ((match = /^ {4}- (.*)$/.exec(line))) entries.push({ version, category, text: match[1] });
    else if (/^ {6,}\S/.test(line) && entries.length) entries.at(-1).text += ` ${line.trim()}`;
  }
  return entries.filter((e) => e.version && compareVersions(e.version, from) > 0 && compareVersions(e.version, to) <= 0);
}

// ---- Report

function section(diff, filter = () => true) {
  const out = [];
  const added = diff.added.filter(filter);
  const removed = diff.removed.filter(filter);
  if (removed.length) out.push(`Removed ${diff.kind}: ${removed.map((n) => `\`${n}\``).join(', ')}`, '');
  if (added.length) out.push(`Added ${diff.kind}: ${added.map((n) => `\`${n}\``).join(', ')}`, '');
  for (const [name, lines] of diff.changed) {
    if (!filter(name)) continue;
    out.push(`\`${name}\``, '', '```diff', ...lines, '```', '');
  }
  return out;
}

try {
  if (!from || !to) throw new Error('Usage: npm run api-diff -- <from> <to> [<mod>...] [--out <file>]');
  const mods = modArgs.length ? modArgs : listMods();
  mods.forEach(requireMod);

  const [oldProto, newProto, oldRuntime, newRuntime] = await Promise.all([
    api(from, 'prototype'),
    api(to, 'prototype'),
    api(from, 'runtime'),
    api(to, 'runtime'),
  ]);
  const prototypeDiff = diffEntries(oldProto.prototypes, newProto.prototypes, 'prototypes');
  const typeDiff = diffEntries(oldProto.types, newProto.types, 'types');
  const classDiff = diffEntries(
    oldRuntime.classes.map((c) => ({ ...c, properties: [...(c.methods ?? []), ...(c.attributes ?? [])] })),
    newRuntime.classes.map((c) => ({ ...c, properties: [...(c.methods ?? []), ...(c.attributes ?? [])] })),
    'classes',
  );
  const eventDiff = diffEntries(oldRuntime.events, newRuntime.events, 'events');

  const path = changelogPath();
  if (!path || !existsSync(path)) throw new Error('No game changelog.txt: set FACTORIO_DATA to the game data folder');
  const changelogText = readText(path);
  if (!new RegExp(`^Version: ${to.replace(/\./g, '\\.')}$`, 'm').test(changelogText)) {
    throw new Error(`${path} doesn't include ${to}: point FACTORIO_DATA at a game of that version`);
  }
  const entries = changelogEntries(changelogText);

  const report = [
    `# Factorio ${from} to ${to}: modding changes`,
    '',
    `Generated by \`npm run api-diff -- ${from} ${to}\`. Sources: the API docs of both versions (lua-api.factorio.com) and the`,
    `game's changelog.txt. Review it by hand: the "relevant" lists are a filter, not a verdict.`,
    '',
  ];

  for (const mod of mods) {
    const { used, lookups, touched, hasControl } = usedApi(mod, newProto);
    const usedOld = usedApi(mod, oldProto).used;
    const isUsed = (name) => used.has(name) || usedOld.has(name);
    report.push(`## ${mod}`, '');
    report.push(`Prototypes and types it uses: ${[...used].sort().map((n) => `\`${n}\``).join(', ')}.`, '');
    report.push(`Properties its Lua touches are marked with \`*\` in the diffs below.`, '');

    const mark = (diff) => {
      const changed = new Map(
        [...diff.changed].map(([name, lines]) => [name, lines.map((l) => (touched.has(/^[+~-] (\w+)/.exec(l)?.[1]) ? `${l}   *` : l))]),
      );
      return { ...diff, changed };
    };
    const apiLines = [...section(mark(prototypeDiff), isUsed), ...section(mark(typeDiff), isUsed)];
    const hits = apiLines.filter((line) => line.endsWith('   *'));
    report.push(
      '### API changes to what it uses',
      '',
      hits.length
        ? `**Properties it touches that changed: ${hits.length}** (marked \`*\`).`
        : 'None of the properties it touches changed. The changes below are to the same prototypes and types.',
      '',
      ...(apiLines.length ? apiLines : ['None.', '']),
    );

    const missingNow = lookups.filter(({ type, name }) => !newProto.prototypes.some((p) => p.typename === type));
    if (missingNow.length) report.push(`Unknown data.raw types in ${to}: ${missingNow.map((l) => l.type).join(', ')}`, '');

    // API type names anywhere; prototype names (items, recipes) only where gameplay or modding changes are listed.
    const apiNames = [...used].filter((n) => /[A-Z]/.test(n));
    const protoNames = [...new Set(lookups.map((l) => l.name))];
    const common = new Set(['name', 'type', 'value', 'raw', 'startup', 'extend', 'floor', 'ceil', 'min', 'max', 'insert', 'remove']);
    const props = [...touched].filter((p) => p.length > 3 && !common.has(p));
    const wordIn = (w, text) => new RegExp(`(^|[^\\w-])${w.replace(/-/g, '\\-')}($|[^\\w-])`).test(text);
    const relevant = entries.filter(
      (e) =>
        apiNames.some((w) => wordIn(w, e.text)) ||
        props.some((p) => new RegExp(`::${p}\\b|["\`']${p}["\`']`).test(e.text)) ||
        (['Modding', 'Scripting', 'Changes', 'Balancing'].includes(e.category) && protoNames.some((w) => wordIn(w, e.text))),
    );
    report.push('### Changelog entries that mention what it uses', '');
    report.push(...(relevant.length ? relevant.map((e) => `- ${e.version} (${e.category}): ${e.text}`) : ['None.']), '');
    if (!hasControl) report.push(`No control.lua, so runtime API changes don't apply.`, '');
  }

  report.push('## All Modding and Scripting changelog entries', '');
  for (const category of ['Modding', 'Scripting']) {
    report.push(`### ${category}`, '');
    const list = entries.filter((e) => e.category === category);
    report.push(...(list.length ? list.map((e) => `- ${e.version}: ${e.text}`) : ['None.']), '');
  }

  report.push('## Full prototype API diff', '', ...section(prototypeDiff), '## Full type diff', '', ...section(typeDiff));
  report.push('## Runtime API: classes and events', '');
  report.push(...section({ ...classDiff, changed: new Map([...classDiff.changed].map(([n, l]) => [n, l.filter((x) => /^[+-]/.test(x))]).filter(([, l]) => l.length)) }));
  report.push(...section(eventDiff));

  const out = outArg ?? join(ROOT, 'docs', 'factorio-updates', `${from}-to-${to}.md`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, report.join('\n').replace(/\n{3,}/g, '\n\n'));
  console.log(`Wrote ${relative(process.cwd(), out)} (${entries.length} changelog entries from ${relative(process.cwd(), path)})`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
