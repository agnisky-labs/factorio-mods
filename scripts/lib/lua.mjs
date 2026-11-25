// Runs a mod's settings/data stage in fengari (Lua 5.3; Factorio uses 5.2) with mock `data`, `settings`, `mods` and `log`.
import fengari from 'fengari';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

const PRELUDE = `
data = { raw = __raw }
function data:extend(list)
  for _, prototype in ipairs(list) do
    assert(type(prototype.type) == "string", "data:extend: a prototype without a type")
    assert(type(prototype.name) == "string", "data:extend: a prototype without a name")
    self.raw[prototype.type] = self.raw[prototype.type] or {}
    self.raw[prototype.type][prototype.name] = prototype
  end
end
settings = { startup = {} }
for name, value in pairs(__settings) do settings.startup[name] = { value = value } end
mods = __mods
__logs = {}
function log(message) __logs[#__logs + 1] = tostring(message) end
__raw, __settings, __mods = nil, nil, nil
`;

// Replaces each data.raw[type] with a proxy that records every data.raw[type][name] read, found or not. Types that don't exist yet
// come back as empty proxies, as every type exists in the real game.
const TRACK = `
__lookups = {}
local backing = {}
local function proxy(type_name)
  local store = rawget(data.raw, type_name) or {}
  backing[type_name] = store
  return setmetatable({}, {
    __index = function(_, name)
      __lookups[#__lookups + 1] = { type = type_name, name = name }
      return store[name]
    end,
    __newindex = function(_, name, value) store[name] = value end,
    __pairs = function() return next, store, nil end,
    __len = function() return #store end,
  })
end
local raw = data.raw
for type_name in pairs(raw) do raw[type_name] = proxy(type_name) end
setmetatable(raw, { __index = function(t, type_name) local p = proxy(type_name); rawset(t, type_name, p); return p end })
function __untrack()
  setmetatable(raw, nil)
  for type_name, store in pairs(backing) do raw[type_name] = store end
end
`;

function push(L, value) {
  if (value === null || value === undefined) lua.lua_pushnil(L);
  else if (typeof value === 'boolean') lua.lua_pushboolean(L, value);
  // Always floats, like Lua 5.2.
  else if (typeof value === 'number') lua.lua_pushnumber(L, value);
  else if (typeof value === 'string') lua.lua_pushstring(L, to_luastring(value));
  else if (Array.isArray(value)) {
    lua.lua_createtable(L, value.length, 0);
    value.forEach((item, i) => {
      push(L, item);
      lua.lua_rawseti(L, -2, i + 1);
    });
  } else if (typeof value === 'object') {
    lua.lua_createtable(L, 0, 0);
    for (const [key, item] of Object.entries(value)) {
      push(L, item);
      lua.lua_setfield(L, -2, to_luastring(key));
    }
  } else throw new Error(`Can't pass a ${typeof value} to Lua`);
}

function read(L, index, depth = 0) {
  if (depth > 64) throw new Error('Lua table nested too deep (a cycle?)');
  index = lua.lua_absindex(L, index);
  switch (lua.lua_type(L, index)) {
    case lua.LUA_TNIL:
      return null;
    case lua.LUA_TBOOLEAN:
      return lua.lua_toboolean(L, index);
    case lua.LUA_TNUMBER:
      return lua.lua_tonumber(L, index);
    case lua.LUA_TSTRING:
      return to_jsstring(lua.lua_tostring(L, index));
    case lua.LUA_TTABLE: {
      const entries = [];
      lua.lua_pushnil(L);
      while (lua.lua_next(L, index) !== 0) {
        entries.push([read(L, -2, depth + 1), read(L, -1, depth + 1)]);
        lua.lua_pop(L, 1);
      }
      const keys = entries.map(([key]) => key);
      const isArray = keys.length > 0 && keys.every(Number.isInteger) && keys.every((key) => key >= 1 && key <= keys.length);
      if (isArray) return entries.sort(([a], [b]) => a - b).map(([, value]) => value);
      return Object.fromEntries(entries.map(([key, value]) => [String(key), value]));
    }
    default:
      return `<${to_jsstring(lua.lua_typename(L, lua.lua_type(L, index)))}>`;
  }
}

function check(L, status, what) {
  if (status !== lua.LUA_OK) {
    const message = to_jsstring(lua.lua_tostring(L, -1) ?? to_luastring('(no message)'));
    throw new Error(`${what}: ${message}`);
  }
}

function getGlobal(L, name) {
  lua.lua_settop(L, 0);
  lua.lua_getglobal(L, to_luastring(name));
  return read(L, -1);
}

/**
 * Runs the given files of a mod in order (missing ones are skipped).
 * Returns { raw, logs, lookups }: data.raw afterwards, log() output, and with `track` every data.raw[type][name] the mod read.
 */
export function runStage(dir, files, { raw = {}, settings = {}, mods = { base: '2.0.0' }, track = false } = {}) {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  lua.lua_getglobal(L, to_luastring('package'));
  lua.lua_pushstring(L, to_luastring(`${dir.replace(/\\/g, '/')}/?.lua`));
  lua.lua_setfield(L, -2, to_luastring('path'));
  lua.lua_pop(L, 1);

  push(L, structuredClone(raw));
  lua.lua_setglobal(L, to_luastring('__raw'));
  push(L, settings);
  lua.lua_setglobal(L, to_luastring('__settings'));
  push(L, mods);
  lua.lua_setglobal(L, to_luastring('__mods'));
  check(L, lauxlib.luaL_dostring(L, to_luastring(PRELUDE)), 'prelude');
  if (track) check(L, lauxlib.luaL_dostring(L, to_luastring(TRACK)), 'tracking');

  for (const file of files) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    const source = readFileSync(path);
    check(L, lauxlib.luaL_loadbuffer(L, source, source.length, to_luastring(`@${file}`)), `loading ${file}`);
    check(L, lua.lua_pcall(L, 0, 0, 0), `running ${file}`);
  }

  let lookups = [];
  if (track) {
    lookups = getGlobal(L, '__lookups') || [];
    if (!Array.isArray(lookups)) lookups = [];
    check(L, lauxlib.luaL_dostring(L, to_luastring('__untrack()')), 'untracking');
  }
  lua.lua_settop(L, 0);
  lua.lua_getglobal(L, to_luastring('data'));
  lua.lua_getfield(L, -1, to_luastring('raw'));
  const result = { raw: read(L, -1), lookups };
  result.logs = getGlobal(L, '__logs');
  if (!Array.isArray(result.logs)) result.logs = [];
  return result;
}

const SETTING_TYPES = ['bool-setting', 'int-setting', 'double-setting', 'string-setting', 'color-setting'];

/** The mod's setting prototypes, from settings.lua, settings-updates.lua and settings-final-fixes.lua. */
export function readSettings(dir, options = {}) {
  const { raw } = runStage(dir, ['settings.lua', 'settings-updates.lua', 'settings-final-fixes.lua'], options);
  return SETTING_TYPES.flatMap((type) => Object.values(raw[type] ?? {}));
}

/** Startup setting defaults by name, with overrides. */
export function startupDefaults(settings, overrides = {}) {
  const values = Object.fromEntries(settings.filter((s) => s.setting_type === 'startup').map((s) => [s.name, s.default_value]));
  return { ...values, ...overrides };
}

export function runDataStage(dir, options = {}) {
  return runStage(dir, ['data.lua', 'data-updates.lua', 'data-final-fixes.lua'], options);
}

export const ALL_DLC = { base: '2.0.0', 'space-age': '2.0.0', quality: '2.0.0', 'elevated-rails': '2.0.0' };

/**
 * The prototypes a mod reads from data.raw, as unique { type, name }. Runs the data stage against an empty data.raw with all DLC
 * active and every bool startup setting on, so guarded branches run too. Names built from loops over data.raw itself aren't seen.
 */
export function prototypeLookups(dir) {
  const settings = readSettings(dir);
  const bools = Object.fromEntries(settings.filter((s) => s.type === 'bool-setting').map((s) => [s.name, true]));
  const { lookups } = runDataStage(dir, { settings: startupDefaults(settings, bools), mods: ALL_DLC, track: true });
  const seen = new Map();
  for (const lookup of lookups) seen.set(`${lookup.type}/${lookup.name}`, lookup);
  return [...seen.values()].sort((a, b) => `${a.type}/${a.name}`.localeCompare(`${b.type}/${b.name}`));
}
