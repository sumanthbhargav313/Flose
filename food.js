/* Browser counterpart of personas/chef/planner.py. Both use the same catalog.
   Cross-runtime scenarios in scripts/verify_food_browser.py guard against drift. */
"use strict";
window.FloseFood = (() => {
  const slots = ["breakfast", "lunch", "snacks", "dinner"];
  const words = (value) => value.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
  const query = (value) => "https://www.google.com/search?q=" + encodeURIComponent(value).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%20/g, "+");
  // Decimal text avoids binary floating point errors at half-paise boundaries.
  function paise(value) {
    const [mantissa, exponent = "0"] = Number(value).toString().split("e");
    const [whole, fraction = ""] = mantissa.split(".");
    const digits = BigInt(whole + fraction);
    const shift = Number(exponent) + 2 - fraction.length;
    if (shift >= 0) return Number(digits * 10n ** BigInt(shift));
    const divisor = 10n ** BigInt(-shift);
    return Number((digits * 2n + divisor) / (2n * divisor));
  }
  function indiaToday() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {timeZone: "Asia/Kolkata", year: "numeric", month: "numeric", day: "numeric"}).formatToParts(new Date()).map(p => [p.type, p.value]));
    return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  }
  function bounded(value, low, high, integer = false) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value))) {
      throw new Error("Please enter valid numbers within the displayed ranges.");
    }
  }
  function validate(c) {
    const p = c.profile;
    if (!p || typeof p.name !== "string" || !p.name.trim() || p.name.length > 60) throw new Error("Please add your name.");
    if (typeof c.location !== "string" || !c.location.trim() || c.location.length > 80) throw new Error("Please add your locality and city.");
    bounded(p.age, 18, 120, true);
    bounded(p.height_cm, 100, 250);
    bounded(p.weight_kg, 25, 350);
    bounded(p.daily_food_budget, 0, 100000);
    bounded(p.monthly_grocery_budget, 0, 1000000);
    bounded(c.grocery_spent, 0, 1000000);
    bounded(c.outside_spent, 0, 1000000);
    bounded(c.cooking_minutes, 0, 240, true);
    bounded(c.sleep_hours, 0, 24);
    bounded(c.stress, 1, 10, true);
    bounded(c.mood, 1, 10, true);
    bounded(c.available_minutes, 0, 90, true);
    if (c.scheduled_hours !== null) bounded(c.scheduled_hours, 0, 24);
    if (!["home", "outside"].includes(c.food_mode) || !["veg", "non-veg", "jain", "flexible"].includes(c.diet_preference)) throw new Error("Choose a supported food mode and diet.");
    if (typeof c.cravings !== "string" || c.cravings.length > 200) throw new Error("Keep cravings within 200 characters.");
    if (!Array.isArray(c.commitments) || c.commitments.some(item => typeof item !== "string")) throw new Error("Enter commitments as text.");
    if (!Array.isArray(c.previous_meals || []) || (c.previous_meals || []).length > 12) throw new Error("Previous meals must be a short list.");
  }
  function ingredientRows(recipes, catalog, location) {
    const amounts = {};
    recipes.forEach(r => Object.entries(r.ingredients).forEach(([id, qty]) => { amounts[id] = (amounts[id] || 0) + qty; }));
    return Object.keys(amounts).sort().map(id => {
      const item = catalog.ingredients[id], quantity = amounts[id];
      return { id, name: item.name, quantity, unit: item.unit, price_paise: item.price_paise,
        base_quantity: item.base_quantity,
        cost_paise: Math.floor((quantity * item.price_paise * 2 + item.base_quantity) / (2 * item.base_quantity)),
        search_url: query(`${item.name} retail price ${location}`) };
    });
  }
  function planFood(c, catalog = window.FLOSE_CATALOG, today = indiaToday()) {
    validate(c);
    const locality = ` ${words(c.location).join(" ")} `;
    const profile = catalog.profiles.find(p => p.aliases.some(alias => locality.includes(` ${alias} `))) || catalog.profiles.at(-1);
    const home = c.food_mode === "home", user = c.profile;
    const budget = paise(home ? user.monthly_grocery_budget : user.daily_food_budget);
    const spent = paise(home ? c.grocery_spent : c.outside_spent), balance = budget - spent;
    const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1;
    const allowance = Math.max(0, home ? Math.floor(balance / daysLeft) : balance);
    let cooking = c.cooking_minutes;
    if (c.scheduled_hours !== null) {
      const free = Math.max(0, Math.trunc((24 - c.sleep_hours - c.scheduled_hours - 3) * 60) - c.available_minutes);
      cooking = Math.min(cooking, free);
    }
    const recovery = c.sleep_hours < 6 || c.stress >= 8 || c.mood <= 2;
    if (recovery || c.commitments.length >= 3) cooking = Math.min(cooking, 60);
    const cravings = new Set(words(c.cravings));
    const previousMeals = new Set((c.previous_meals || []).map(item => item.split(":").at(-1).trim().toLocaleLowerCase("en-IN")));
    const matches = (r) => r.tags.some(t => cravings.has(t));
    const eligible = catalog.recipes.filter(r => r.diets.includes(c.diet_preference));
    const choices = slots.map(slot => eligible.filter(r => r.slots.includes(slot)));
    let combos = [[]];
    choices.forEach(options => { combos = combos.flatMap(combo => options.map(r => [...combo, r])); });
    const candidates = combos.map(recipes => {
      const rows = ingredientRows(recipes, catalog, c.location);
      const total = home ? rows.reduce((s, r) => s + r.cost_paise, 0) : recipes.reduce((s, r) => s + r.outside_paise, 0);
      const minutes = recipes.reduce((s, r) => s + r.minutes, 0);
      let score = recipes.reduce((s, r) => s + (r.regions.includes(profile.id) ? 3 : 0) + (c.diet_preference === "non-veg" && "eggs" in r.ingredients ? 2 : 0), 0);
      if (recipes.some(matches)) score += 6;
      if (recipes[1].id === recipes[3].id) score -= 4;
      const repeated = recipes.filter(r => previousMeals.has(r.name.toLocaleLowerCase("en-IN"))).length;
      return { recipes, rows, total, minutes, score, repeated, fitsTime: !home || minutes <= cooking };
    });
    const fitting = candidates.filter(r => r.total <= allowance && r.fitsTime);
    const chosen = fitting.length
      ? fitting.sort((a, b) => a.repeated - b.repeated || b.score - a.score || a.total - b.total || a.minutes - b.minutes)[0]
      : candidates.sort((a, b) => Number(b.fitsTime) - Number(a.fitsTime) || a.repeated - b.repeated || a.total - b.total || a.minutes - b.minutes)[0];
    const notes = [];
    if (!fitting.length) notes.push("No complete four-meal plan fits all limits. The closest option is shown; review the shortfall or cooking time before using it.");
    notes.push(profile.id === "general"
      ? "This locality is not in the regional catalog yet. These are general Indian options; use the search links to check local availability."
      : "Regional suggestions are starting points; locality availability is not verified.");
    if (c.cravings) notes.push(chosen.recipes.some(matches)
      ? "A diet-compatible option reflects your craving."
      : "Your craving could not be matched within the catalog and limits; your diet preference takes priority.");
    if (previousMeals.size) notes.push(chosen.repeated === 0
      ? "Meals were rotated away from your latest recommendation."
      : "Some meals repeat because the current diet, budget, or time limits leave no fully different four-meal plan.");
    if (c.diet_preference === "jain") notes.push("No root vegetables, onion, garlic or eggs in these recipes. Confirm ingredients and your own observance when ordering outside.");
    if (recovery) notes.push("A low-energy day: keep preparation simple and seasoning comfortable.");
    if (user.age >= 65) notes.push("Choose a texture you find comfortable and keep regular meal breaks.");
    notes.push("Height and weight are recorded as context; these are one-adult meal ideas, not calculated calorie or weight-loss targets.");
    return { meals: chosen.recipes.map((r, i) => ({ ...r, slot: slots[i], search_url: query(`${c.diet_preference} ${r.name} menu price ${c.location}`) })),
      ingredients: home ? chosen.rows : [], total_paise: chosen.total, budget_paise: budget,
      spent_paise: spent, balance_paise: balance, remaining_paise: balance - chosen.total,
      allowance_paise: allowance, shortfall_paise: Math.max(0, chosen.total - allowance),
      days_left: daysLeft, month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
      cooking_minutes: home ? chosen.minutes : 0, cooking_limit: cooking, fits: fitting.length > 0,
      notes, local_profile: profile, mode: c.food_mode, price_date: catalog.price_date,
      source_url: catalog.source_url, price_scope: catalog.price_scope, outside_note: catalog.outside_note };
  }
  return { planFood, paise };
})();
