local items = require("__bulk-materials__.items")

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
        order = item.order
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
        order = "z" .. item.order
    })
end

data:extend(setting_list)
