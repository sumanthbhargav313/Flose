"use strict";

const screens = {
  home: document.querySelector("#home-screen"),
  planner: document.querySelector("#planner-screen"),
};
const form = document.querySelector("#preference-form");
const result = document.querySelector("#plan-result");
const manualTime = document.querySelector("#manual-time");
const estimatedTime = document.querySelector("#estimated-time");
const estimateCopy = document.querySelector("#estimate-copy");

function showScreen(name) {
  Object.entries(screens).forEach(([screenName, element]) => {
    element.hidden = screenName !== name;
  });
  document.querySelectorAll("[data-screen]").forEach((button) => {
    if (button.dataset.screen === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screen));
});
document.querySelectorAll("[data-screen-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showScreen(link.dataset.screenLink);
  });
});

function estimateWorkoutMinutes(sleepHours, scheduledHours, stress) {
  const awakeHours = Math.max(0, 24 - sleepHours);
  const flexibleHours = Math.max(0, awakeHours - scheduledHours - 3);
  const estimate = Math.min(45, Math.floor((flexibleHours * 60) / 5) * 5);
  return stress >= 8 ? Math.min(estimate, 20) : estimate;
}

function updateTimeMode() {
  const mode = form.elements.timeMode.value;
  manualTime.hidden = mode !== "manual";
  estimatedTime.hidden = mode !== "estimate";
  form.elements.available.required = mode === "manual";
  form.elements.scheduled.required = mode === "estimate";
  form.elements.available.disabled = mode !== "manual";
  form.elements.scheduled.disabled = mode !== "estimate";
  form.elements.cooking.disabled = form.elements.foodMode.value !== "home";
  document.querySelector("#cooking-time").hidden = form.elements.foodMode.value !== "home";
  if (mode === "estimate") {
    const minutes = estimateWorkoutMinutes(
      Number(form.elements.sleep.value),
      Number(form.elements.scheduled.value),
      Number(form.elements.stress.value),
    );
    estimateCopy.textContent = `Momo estimates ${minutes} minutes for movement after protecting sleep, meals, and personal-care time.`;
  }
}

function preferencesChanged() {
  updateTimeMode();
  result.hidden = true;
  document.querySelector("#form-error")?.remove();
}
form.addEventListener("change", preferencesChanged);
form.addEventListener("input", preferencesChanged);

function buildFitness(checkIn) {
  const reasons = [];
  if (checkIn.sleep < 6) reasons.push("You reported less than 6 hours of sleep.");
  if (checkIn.stress >= 8) reasons.push("You reported high stress.");
  if (checkIn.mood === "Bad") reasons.push("You reported a low mood.");
  const recovery = reasons.length > 0;
  let activity = recovery ? "gentle walk and mobility" : checkIn.activity.toLowerCase();
  let intensity = recovery ? "recovery" : (checkIn.activeDays >= 5 ? "light" : "moderate");
  let limit = recovery ? 20 : 45;
  if (!recovery) reasons.push(`Your preferred movement is ${activity}.`);
  if (checkIn.activeDays >= 5) reasons.push("You were active on at least 5 of the last 7 days; keep effort easy.");
  const duration = Math.min(limit, checkIn.available);
  reasons.push(`The session fits your ${checkIn.available}-minute time budget.`);

  if (duration === 0) {
    return {
      activity: "rest", duration: 0, intensity: "rest",
      guidance: "No workout is scheduled today. Return when you have time for movement.",
      coaching: ["Protect recovery today and begin again when time opens up."], reasons,
    };
  }
  const activityCue = {
    gym: "Use a controlled range and choose loads you can move with steady form.",
    walk: "Keep a pace that lets you speak in complete sentences.",
    yoga: "Move slowly between poses and avoid forcing your range.",
    swim: "Keep early lengths relaxed and prioritize smooth breathing.",
    "gentle walk and mobility": "Use an easy pace and gentle, pain-free mobility.",
  }[activity];
  const coaching = recovery
    ? [activityCue, "Count breaks inside the planned time.", "Finish feeling that you could comfortably do more."]
    : ["Start easier than you think you need to.", activityCue, "Stop if movement causes pain."];
  return {
    activity, duration, intensity, coaching, reasons,
    guidance: recovery || intensity === "light"
      ? "Keep it easy today and prioritize rest. Stop if movement causes pain."
      : "Aim for steady, comfortable effort. Stop if movement causes pain.",
  };
}

const money = (value) => new Intl.NumberFormat("en-IN", {style: "currency", currency: "INR"}).format(value / 100);
function node(parent, tag, copy, className = "") {
  const el = document.createElement(tag);
  el.textContent = copy;
  if (className) el.className = className;
  parent.append(el);
  return el;
}
function link(parent, copy, url) {
  const el = node(parent, "a", copy);
  el.href = url;
  el.target = "_blank";
  el.rel = "noopener noreferrer";
  return el;
}
function renderFood(d) {
  const parent = document.querySelector("#food-result");
  parent.replaceChildren();
  const home = d.mode === "home";
  node(parent, "h3", "Your food budget");
  node(parent, "p", home ? `This month · ${d.month}` : "Today · Outside food", "form-note");
  const grid = node(parent, "div", "", "budget-grid");
  [["Budget", d.budget_paise], ["Spent before this plan", d.spent_paise],
    ["This plan · estimated", d.total_paise], ["Projected remaining", d.remaining_paise]].forEach(([label, value]) => {
    const card = node(grid, "div", "", "budget-card");
    node(card, "small", label);
    node(card, "strong", money(value));
  });
  if (home) node(parent, "p", `Daily grocery allowance: ${money(d.allowance_paise)} across ${d.days_left} remaining days, including today. Cooking: ${d.cooking_minutes} min planned / ${d.cooking_limit} min available.`, "form-note");
  if (!d.fits) node(parent, "p", `This option exceeds at least one limit. Food allowance shortfall: ${money(d.shortfall_paise)}. No spending has been recorded.`, "budget-warning");
  const details = node(parent, "details", "", "food-details");
  details.open = true;
  node(details, "summary", "Local options, preparation and cost details");
  node(details, "h4", d.local_profile.name);
  appendList(details, d.local_profile.typical.map((copy, i) => `${["Breakfast", "Lunch", "Snacks", "Dinner"][i]}: ${copy}`));
  link(details, "Regional food context", d.local_profile.source);
  node(details, "p", "Typical regional examples may need adaptation to your selected diet. Your chosen meals below respect that preference.", "form-note");
  const meals = node(details, "div", "", "meal-grid");
  d.meals.forEach(meal => {
    const card = node(meals, "article", "", "meal-card");
    node(card, "h4", `${meal.slot[0].toUpperCase() + meal.slot.slice(1)} · ${meal.name}`);
    node(card, "p", home ? meal.instructions : `Planning estimate: ${money(meal.outside_paise)}. Ask for a freshly prepared, comfortably seasoned portion.`);
    if (home) node(card, "p", `${meal.minutes} minutes. Ingredients: ` + Object.entries(meal.ingredients).map(([id, qty]) => `${window.FLOSE_CATALOG.ingredients[id].name}: ${qty} ${window.FLOSE_CATALOG.ingredients[id].unit}`).join(", "), "form-note");
    link(card, "Check options near your locality", meal.search_url);
  });
  appendList(details, d.notes);
  if (home) {
    const source = node(details, "p", `As of ${d.price_date}. ${d.price_scope} `, "form-note");
    link(source, "Retail price source", d.source_url);
    node(details, "p", "The public edition checks retail prices daily during publication. If that lookup fails, the dated snapshot is retained. Local prices may differ; check the ingredient links before shopping.", "form-note");
    const wrap = node(details, "div", "", "table-scroll");
    wrap.tabIndex = 0;
    wrap.setAttribute("aria-label", "Ingredient costs; scroll horizontally on small screens");
    const table = node(wrap, "table", "", "price-table");
    node(table, "caption", "Raw ingredient quantities and estimated portion costs");
    const head = node(node(table, "thead", ""), "tr", "");
    ["Ingredient", "Quantity used", "Reference unit price", "Portion cost"].forEach(copy => node(head, "th", copy).scope = "col");
    const body = node(table, "tbody", "");
    d.ingredients.forEach(r => {
      const row = node(body, "tr", "");
      link(node(row, "td", ""), r.name, r.search_url);
      [`${r.quantity} ${r.unit}`, `${money(r.price_paise)} / ${r.base_quantity} ${r.unit}`, money(r.cost_paise)].forEach(copy => node(row, "td", copy));
    });
    node(details, "p", "Food portions only. Cooking fuel, equipment, delivery and full-pack purchases are excluded. Balances do not carry over automatically between visits.", "form-note");
  } else node(details, "p", d.outside_note, "form-note");
}

function appendList(parent, items) {
  const list = document.createElement("ul");
  items.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.append(entry);
  });
  parent.append(list);
}

function renderPanel(id, title, paragraphs, items = []) {
  const panel = document.querySelector(id);
  panel.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = title;
  panel.append(heading);
  paragraphs.forEach((copy) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = copy;
    panel.append(paragraph);
  });
  if (items.length) appendList(panel, items);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const mode = form.elements.timeMode.value;
  const checkIn = {
    profile: {
      name: form.elements.userName.value.trim(), age: Number(form.elements.age.value),
      height_cm: Number(form.elements.height.value), weight_kg: Number(form.elements.weight.value),
      daily_food_budget: Number(form.elements.foodBudget.value), monthly_grocery_budget: Number(form.elements.groceryBudget.value),
    },
    sleep: Number(form.elements.sleep.value),
    stress: Number(form.elements.stress.value),
    mood: form.elements.mood.value,
    diet: form.elements.diet.value,
    location: form.elements.location.value.trim(),
    activity: form.elements.activity.value,
    activeDays: Number(form.elements.activeDays.value),
    available: mode === "manual"
      ? Number(form.elements.available.value)
      : estimateWorkoutMinutes(Number(form.elements.sleep.value), Number(form.elements.scheduled.value), Number(form.elements.stress.value)),
    commitments: form.elements.commitments.value.split("\n").map((item) => item.trim()).filter(Boolean),
  };
  let meals;
  try {
    meals = window.FloseFood.planFood({
      profile: checkIn.profile, location: checkIn.location, food_mode: form.elements.foodMode.value,
      diet_preference: checkIn.diet, cravings: form.elements.cravings.value.trim(),
      grocery_spent: Number(form.elements.grocerySpent.value), outside_spent: Number(form.elements.outsideSpent.value),
      cooking_minutes: Number(form.elements.cooking.value), sleep_hours: checkIn.sleep,
      stress: checkIn.stress, mood: {Normal: 6, Bad: 2, Good: 8}[checkIn.mood],
      available_minutes: checkIn.available, scheduled_hours: mode === "estimate" ? Number(form.elements.scheduled.value) : null,
      commitments: checkIn.commitments,
    });
  } catch (error) {
    result.hidden = true;
    document.querySelector("#form-error")?.remove();
    const message = node(form, "p", error.message, "budget-warning");
    message.id = "form-error";
    message.setAttribute("role", "alert");
    return;
  }
  const fitness = buildFitness(checkIn);
  const recovery = checkIn.sleep < 7 || checkIn.stress >= 7;
  const note = recovery
    ? "Today is recovery-aware: protect breaks, nourishing meals, and an earlier wind-down."
    : "You have room for a focused, balanced day—keep meals and breaks protected.";
  const schedule = [
    "Morning: water, breakfast, and a quick priorities check.",
    fitness.duration === 0 ? "Movement: no workout scheduled today." : `Movement: ${fitness.duration} min of ${fitness.activity} (${fitness.intensity}).`,
    ...(meals.mode === "home" ? [`Food preparation: ${meals.cooking_minutes} minutes across the day; place these around your listed commitments.`] : []),
    "Midday: eat lunch away from work and take a short reset.",
    ...checkIn.commitments.map((item) => `Commitment: ${item}`),
    "Evening: prepare tomorrow’s essentials and begin wind-down before bedtime.",
  ];

  document.querySelector("#profile-summary").textContent = `${checkIn.profile.name} · ${checkIn.profile.age} years · ${checkIn.profile.height_cm} cm · ${checkIn.profile.weight_kg} kg · ${checkIn.location}`;
  renderFood(meals);
  renderPanel("#momo-result", "Momo · Your day", [`${checkIn.profile.name}, ${note}`], schedule);
  renderPanel("#trainer-result", "Trainer · Movement", [`${fitness.duration} minutes · ${fitness.activity}`, `${fitness.intensity} intensity`, fitness.guidance], fitness.coaching);
  renderPanel("#chef-result", "Chef · Meals", [`${checkIn.diet} · ${checkIn.location}`], meals.meals.map(r => `${r.slot}: ${r.name}`));
  result.hidden = false;
  result.focus({ preventScroll: true });
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});

updateTimeMode();
showScreen(location.hash === "#planner" ? "planner" : "home");
