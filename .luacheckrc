-- luacheck for the mods (CI only). Factorio runs Lua 5.2 with its own globals.
std = "lua52"
max_line_length = 140
include_files = { "mods/**/*.lua" }

-- Data stage. data.raw is written to, so `data` is writable; the rest are read-only.
globals = { "data" }
read_globals = { "settings", "mods", "log", "util", "serpent", "table_size", "defines", "feature_flags", "helpers" }

-- control.lua (runtime stage), when a mod has one.
files["mods/*/control.lua"] = {
  globals = { "storage" },
  read_globals = { "script", "game", "prototypes", "rendering", "remote", "commands", "rcon" },
}
