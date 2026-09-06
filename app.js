"use strict";

const screens = {
  home: document.querySelector("#home-screen"),
  planner: document.querySelector("#planner-screen"),
};
const form = document.querySelector("#preference-form");
const identityForm = document.querySelector("#identity-form");
const profileWelcome = document.querySelector("#profile-welcome");
const result = document.querySelector("#plan-result");
const manualTime = document.querySelector("#manual-time");
const estimatedTime = document.querySelector("#estimated-time");
const estimateCopy = document.querySelector("#estimate-copy");
const STORAGE_KEY = "flose.momo.profiles.v1";
const MAX_HISTORY = 90;
let activeKey = null;
let activeRecord = null;
let editingProfile = false;

function normalizeName(name) {
  const display = name.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!display || display.length > 60) throw new Error("Enter a name of 1–60 characters.");
  return { display, key: display.toLocaleLowerCase("en-IN") };
}

function profilePlaceholder(name) {
  const {display, key} = normalizeName(name);
  const initials = display.split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase() || "MO";
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `MO-${initials}-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

function loadProfiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function setRadio(name, value) {
  const input = [...form.elements[name]].find(item => item.value === value);
  if (input) input.checked = true;
}

function applyRecord(record) {
  const values = record.values;
  form.elements.userName.value = record.displayName;
  form.elements.age.value = values.age;
  form.elements.location.value = values.location;
  form.elements.height.value = values.height;
  form.elements.weight.value = values.weight;
  form.elements.foodBudget.value = values.foodBudget;
  form.elements.groceryBudget.value = values.groceryBudget;
  form.elements.outsideSpent.value = values.outsideSpent;
  form.elements.grocerySpent.value = values.grocerySpent;
  form.elements.diet.value = values.diet;
  form.elements.activity.value = values.activity;
  form.elements.activeDays.value = values.activeDays;
  form.elements.cravings.value = values.cravings || "";
  form.elements.cooking.value = values.cooking;
  form.elements.available.value = values.available;
  form.elements.scheduled.value = values.scheduled ?? 8;
  setRadio("foodMode", values.foodMode);
  setRadio("timeMode", values.timeMode);
  const latest = record.history?.at(-1)?.checkIn;
  form.elements.sleep.value = latest?.sleep ?? 7;
  form.elements.stress.value = latest?.stress ?? 5;
  form.elements.mood.value = latest?.mood ?? "Normal";
  form.elements.commitments.value = "";
  updateTimeMode();
}

function summarize(record) {
  const history = record.history || [];
  if (!history.length) return null;
  const average = key => history.reduce((total, event) => total + Number(event.checkIn[key]), 0) / history.length;
  const counts = {};
  history.forEach(event => {
    const activity = event.recommendation.fitness.activity;
    counts[activity] = (counts[activity] || 0) + 1;
  });
  const commonActivity = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  return {
    count: history.length,
    averageSleep: average("sleep"),
    averageStress: average("stress"),
    averageMood: history.reduce((total, event) => total + ({Bad: 2, Normal: 6, Good: 8}[event.checkIn.mood]), 0) / history.length,
    commonActivity,
    latest: history.at(-1),
  };
}

function renderProfile(record) {
  document.querySelector("#profile-avatar").textContent = record.displayName.split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase();
  document.querySelector("#profile-name").textContent = record.displayName;
  document.querySelector("#profile-id").textContent = `${record.saved ? "Saved local profile" : "Unique profile reserved when you create your first plan"} · ${record.profileId}`;
  const patterns = summarize(record);
  const grid = document.querySelector("#pattern-grid");
  const details = document.querySelector("#history-details");
  grid.replaceChildren();
  if (patterns) {
    [["Check-ins remembered", patterns.count], ["Average sleep", `${patterns.averageSleep.toFixed(1)} h`],
      ["Average stress", `${patterns.averageStress.toFixed(1)} / 10`], ["Frequent plan", patterns.commonActivity]].forEach(([label, value]) => {
      const card = node(grid, "div", "", "pattern-card");
      node(card, "small", label);
      node(card, "strong", String(value));
    });
    grid.hidden = false;
    details.hidden = false;
    document.querySelector("#pattern-summary").textContent = `Across ${patterns.count} check-in${patterns.count === 1 ? "" : "s"}: average sleep ${patterns.averageSleep.toFixed(1)}h, stress ${patterns.averageStress.toFixed(1)}/10, mood ${patterns.averageMood.toFixed(1)}/10; most frequent movement plan: ${patterns.commonActivity}.`;
    const fitness = patterns.latest.recommendation.fitness;
    document.querySelector("#last-recommendation").textContent = `Last movement plan: ${fitness.duration} minutes of ${fitness.activity} (${fitness.intensity}). Last meals: ${patterns.latest.recommendation.meals.join("; ")}`;
  } else {
    grid.hidden = true;
    details.hidden = true;
  }
}

function showProfileForm(record, returning) {
  activeRecord = record;
  identityForm.hidden = true;
  profileWelcome.hidden = false;
  form.hidden = false;
  renderProfile(record);
  document.querySelectorAll(".onboarding-only").forEach(fieldset => fieldset.hidden = returning);
  document.querySelector("#edit-profile").hidden = !record.saved || !returning;
  document.querySelector("#plan-submit").textContent = returning
    ? "Create today’s Flose plan →"
    : record.saved ? "Update preferences & create my plan →" : "Save profile & create my first plan →";
  document.querySelector("#planner-step").textContent = `${record.saved ? "Welcome back" : "First-time setup"} · ${returning ? "Daily check-in" : "About 2 minutes"}`;
  document.querySelector("#planner-title").textContent = `${record.saved ? "Good to see you again" : "Let Momo get to know you"}, ${record.displayName}.`;
  document.querySelector("#planner-copy").textContent = returning
    ? "Only today’s signals are needed. Momo has already filled your saved preferences."
    : "Share your essentials once. Momo will remember them for shorter check-ins next time.";
  applyRecord(record);
}

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

identityForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!identityForm.reportValidity()) return;
  let identity;
  try {
    identity = normalizeName(identityForm.elements.identityName.value);
  } catch (error) {
    identityForm.elements.identityName.setCustomValidity(error.message);
    identityForm.reportValidity();
    return;
  }
  identityForm.elements.identityName.setCustomValidity("");
  activeKey = identity.key;
  const saved = loadProfiles()[activeKey];
  editingProfile = false;
  if (saved) {
    showProfileForm(saved, true);
  } else {
    showProfileForm({
      displayName: identity.display,
      profileId: profilePlaceholder(identity.display),
      saved: false,
      values: {
        age: 25, location: "", height: 170, weight: 70, foodBudget: 400,
        groceryBudget: 6000, outsideSpent: 0, grocerySpent: 0, diet: "veg",
        activity: "Gym", activeDays: 0, cravings: "", foodMode: "home",
        cooking: 90, timeMode: "manual", available: 30, scheduled: 8,
      },
      history: [],
    }, false);
  }
});

identityForm.elements.identityName.addEventListener("input", () => {
  identityForm.elements.identityName.setCustomValidity("");
});

document.querySelector("#change-profile").addEventListener("click", () => {
  activeKey = null;
  activeRecord = null;
  editingProfile = false;
  identityForm.reset();
  identityForm.hidden = false;
  profileWelcome.hidden = true;
  form.hidden = true;
  result.hidden = true;
  document.querySelector("#planner-step").textContent = "Your private Momo profile";
  document.querySelector("#planner-title").textContent = "What should Momo call you?";
  document.querySelector("#planner-copy").textContent = "Your name is your unique profile key in this browser. Return with the same name and Momo will remember what matters.";
  identityForm.elements.identityName.focus();
});

document.querySelector("#edit-profile").addEventListener("click", () => {
  editingProfile = true;
  showProfileForm(activeRecord, false);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const profiles = loadProfiles();
  if (!activeRecord.saved && profiles[activeKey]) {
    result.hidden = true;
    document.querySelector("#form-error")?.remove();
    const message = node(form, "p", "That name already belongs to a Momo profile in this browser. Return with the saved name or choose another name.", "budget-warning");
    message.id = "form-error";
    message.setAttribute("role", "alert");
    return;
  }
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
  const priorPatterns = summarize(activeRecord);
  const recovery = checkIn.sleep < 7 || checkIn.stress >= 7;
  let note = recovery
    ? "Today is recovery-aware: protect breaks, nourishing meals, and an earlier wind-down."
    : "You have room for a focused, balanced day—keep meals and breaks protected.";
  if (priorPatterns) {
    note += ` Momo also considered your local pattern: across ${priorPatterns.count} check-in${priorPatterns.count === 1 ? "" : "s"}, average sleep was ${priorPatterns.averageSleep.toFixed(1)}h and stress was ${priorPatterns.averageStress.toFixed(1)}/10.`;
  }
  const schedule = [
    "Morning: water, breakfast, and a quick priorities check.",
    fitness.duration === 0 ? "Movement: no workout scheduled today." : `Movement: ${fitness.duration} min of ${fitness.activity} (${fitness.intensity}).`,
    ...(meals.mode === "home" ? [`Food preparation: ${meals.cooking_minutes} minutes across the day; place these around your listed commitments.`] : []),
    "Midday: eat lunch away from work and take a short reset.",
    ...checkIn.commitments.map((item) => `Commitment: ${item}`),
    "Evening: prepare tomorrow’s essentials and begin wind-down before bedtime.",
  ];

  const record = {
    displayName: checkIn.profile.name,
    profileId: activeRecord.profileId,
    saved: true,
    values: {
      age: checkIn.profile.age,
      location: checkIn.location,
      height: checkIn.profile.height_cm,
      weight: checkIn.profile.weight_kg,
      foodBudget: checkIn.profile.daily_food_budget,
      groceryBudget: checkIn.profile.monthly_grocery_budget,
      outsideSpent: Number(form.elements.outsideSpent.value),
      grocerySpent: Number(form.elements.grocerySpent.value),
      diet: checkIn.diet,
      activity: checkIn.activity,
      activeDays: checkIn.activeDays,
      cravings: form.elements.cravings.value.trim(),
      foodMode: form.elements.foodMode.value,
      cooking: Number(form.elements.cooking.value),
      timeMode: mode,
      available: checkIn.available,
      scheduled: mode === "estimate" ? Number(form.elements.scheduled.value) : null,
    },
    history: [...(activeRecord.history || []), {
      createdAt: new Date().toISOString(),
      checkIn: {
        sleep: checkIn.sleep, stress: checkIn.stress, mood: checkIn.mood,
        commitments: checkIn.commitments, available: checkIn.available,
        activeDays: checkIn.activeDays, cravings: form.elements.cravings.value.trim(),
        foodMode: form.elements.foodMode.value, cooking: Number(form.elements.cooking.value),
        grocerySpent: Number(form.elements.grocerySpent.value),
        outsideSpent: Number(form.elements.outsideSpent.value),
      },
      recommendation: {
        wellbeingNote: note,
        fitness,
        meals: meals.meals.map(item => `${item.slot}: ${item.name}`),
        groceryRestock: meals.ingredients?.map(item => item.name) || [],
        foodBudget: {
          mode: meals.mode, budget_paise: meals.budget_paise,
          spent_paise: meals.spent_paise, total_paise: meals.total_paise,
          remaining_paise: meals.remaining_paise, fits: meals.fits,
        },
        schedule,
      },
    }].slice(-MAX_HISTORY),
  };
  try {
    profiles[activeKey] = record;
    saveProfiles(profiles);
  } catch (_) {
    result.hidden = true;
    document.querySelector("#form-error")?.remove();
    const message = node(form, "p", "Momo could not save this profile in browser storage. Check private-browsing or storage settings and try again.", "budget-warning");
    message.id = "form-error";
    message.setAttribute("role", "alert");
    return;
  }
  activeRecord = record;
  editingProfile = false;
  showProfileForm(record, true);

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
