--- Items with multipliers, used by settings.lua and data.lua.
--- name:     item name; also the start of its setting names (<name>-output-multiplier, <name>-speed-multiplier)
--- order:    settings order letter (output "<order>", speed "z<order>")
--- output:   default output multiplier
--- recipes:  recipes the multipliers apply to (missing ones, e.g. Space Age recipes without Space Age, are skipped)
--- weight:   vanilla Space Age item weight, used by the normalized rocket weight setting
--- space_age: true for items that only exist with Space Age (their settings are hidden without it)
return {
    {name = "iron-gear-wheel", order = "a", output = 4, recipes = {"iron-gear-wheel", "casting-iron-gear-wheel"}, weight = 1000},
    {name = "iron-stick", order = "b", output = 4, recipes = {"iron-stick", "casting-iron-stick"}, weight = 500},
    {name = "steel-plate", order = "c", output = 1, recipes = {"steel-plate", "casting-steel"}, weight = 2500},
    {name = "concrete", order = "d", output = 4, recipes = {"concrete", "concrete-from-molten-iron"}, weight = 10000},
    {name = "engine-unit", order = "e", output = 2, recipes = {"engine-unit"}, weight = 2500},
    {name = "electric-engine-unit", order = "f", output = 1, recipes = {"electric-engine-unit"}, weight = 2500},
    {name = "electronic-circuit", order = "g", output = 16, recipes = {"electronic-circuit"}, weight = 500},
    {name = "advanced-circuit", order = "h", output = 16, recipes = {"advanced-circuit"}, weight = 1000},
    {name = "processing-unit", order = "i", output = 16, recipes = {"processing-unit"}, weight = 3333.33},
    {name = "low-density-structure", order = "j", output = 2,
        recipes = {"low-density-structure", "casting-low-density-structure"}, weight = 5000},
    {name = "flying-robot-frame", order = "k", output = 2, recipes = {"flying-robot-frame"}, weight = 6666.67},
    {name = "artificial-yumako-soil", order = "l", output = 4, recipes = {"artificial-yumako-soil"}, weight = 14750, space_age = true},
    {name = "artificial-jellynut-soil", order = "m", output = 4, recipes = {"artificial-jellynut-soil"}, weight = 14750, space_age = true},
    {name = "quantum-processor", order = "n", output = 1, recipes = {"quantum-processor"}, weight = 5000, space_age = true},
    {name = "sulfur", order = "o", output = 1, recipes = {"sulfur", "biosulfur"}, weight = 1000},
}
