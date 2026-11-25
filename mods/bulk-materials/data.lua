local items = require("__bulk-materials__.items")

--- Startup settings
local normalize_weight = settings.startup['enable-normalized-rocket-weight'].value
local output_multipliers = {}
local speed_multipliers = {}
for _, item in ipairs(items) do
    output_multipliers[item.name] = settings.startup[item.name .. "-output-multiplier"].value
    speed_multipliers[item.name] = settings.startup[item.name .. "-speed-multiplier"].value
end

--- Result amounts are uint16
local MAX_AMOUNT = 65535
--- Fastest time a speed multiplier takes a recipe to
local MIN_ENERGY = 0.02

local function multiply_amount(amount, multiplier)
    if amount == nil then
        return nil
    end
    return math.min(MAX_AMOUNT, math.floor(amount * multiplier))
end

local function update_item(item)
    local output = output_multipliers[item.name]
    local speed = speed_multipliers[item.name]

    for _, recipe_name in ipairs(item.recipes) do
        local recipe = data.raw.recipe[recipe_name]

        if recipe then
            -- Update Result Item Amount (amount, or amount_min and amount_max when amount isn't set)
            for _, result in ipairs(recipe.results or {}) do
                if result.name == item.name then
                    result.amount = multiply_amount(result.amount, output)
                    result.amount_min = multiply_amount(result.amount_min, output)
                    result.amount_max = multiply_amount(result.amount_max, output)
                end
            end

            -- Update Energy Required, never slowing down a recipe that's already faster than MIN_ENERGY
            if speed > 1 then
                local base_energy = recipe.energy_required or 0.5
                recipe.energy_required = math.max(base_energy / speed, math.min(base_energy, MIN_ENERGY))
            end
        end
    end

    --- Update item weight (Space Age items are absent without it)
    local prototype = data.raw['item'][item.name]
    if normalize_weight and prototype then
        prototype.weight = item.weight
    end
end

--- Output and Speed Multiplier
for _, item in ipairs(items) do
    update_item(item)
end
