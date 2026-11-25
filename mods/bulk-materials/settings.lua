local items = require("__bulk-materials__.items")

--- Settings for Space Age-only items are hidden when Space Age isn't active
local function hidden(item)
    return (item.space_age and not mods["space-age"]) or nil
end

local setting_list = {{
    type = "bool-setting",
    name = "enable-normalized-rocket-weight",
    setting_type = "startup",
    default_value = false
}}

--- Output multipliers
for _, item in ipairs(items) do
    table.insert(setting_list, {
        type = "int-setting",
        name = item.name .. "-output-multiplier",
        setting_type = "startup",
        default_value = item.output,
        minimum_value = 1,
        maximum_value = 128,
        order = item.order,
        hidden = hidden(item)
    })
end

--- Speed multipliers
for _, item in ipairs(items) do
    table.insert(setting_list, {
        type = "int-setting",
        name = item.name .. "-speed-multiplier",
        setting_type = "startup",
        default_value = 1,
        minimum_value = 1,
        maximum_value = 25,
        order = "z" .. item.order,
        hidden = hidden(item)
    })
end

data:extend(setting_list)
