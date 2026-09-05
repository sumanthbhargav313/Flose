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
  if (mode === "estimate") {
    const minutes = estimateWorkoutMinutes(
      Number(form.elements.sleep.value),
      Number(form.elements.scheduled.value),
      Number(form.elements.stress.value),
    );
    estimateCopy.textContent = `Momo estimates ${minutes} minutes for movement after protecting sleep, meals, and personal-care time.`;
  }
}

form.addEventListener("change", updateTimeMode);
form.addEventListener("input", updateTimeMode);

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

function buildMeals(checkIn, fitness) {
  const focus = fitness.intensity === "moderate" ? "protein-rich" : "balanced";
  const location = checkIn.location;
  const plans = {
    veg: {
      meals: [`Breakfast: ${focus} oats or paneer with fruit.`, "Lunch: vegetables, whole grains, and dal, beans, paneer, or tofu.", `Dinner: a light vegetarian plate using seasonal produce available near ${location}.`],
      protein: "dal, beans, paneer, or tofu",
    },
    "non-veg": {
      meals: [`Breakfast: ${focus} eggs or oats with fruit.`, "Lunch: vegetables, whole grains, and eggs, fish, or lean meat.", `Dinner: a lighter plate using fresh ingredients available near ${location}.`],
      protein: "eggs, fish, or lean meat",
    },
    jain: {
      meals: [`Breakfast: ${focus} oats, fruit, or paneer without root vegetables.`, "Lunch: grains, lentils, and non-root vegetables aligned with your observance.", `Dinner: a light Jain-friendly plate using produce available near ${location}.`],
      protein: "lentils or paneer",
    },
    flexible: {
      meals: [`Breakfast: a ${focus} option with fruit that is easy to find locally.`, `Lunch: vegetables, whole grains, and a protein commonly available near ${location}.`, "Dinner: choose a lighter balanced plate from what is fresh and accessible today."],
      protein: "locally available protein",
    },
  };
  const selected = plans[checkIn.diet];
  return { meals: selected.meals, groceries: ["seasonal fruit", "leafy vegetables", selected.protein, "whole grains"] };
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
  const fitness = buildFitness(checkIn);
  const meals = buildMeals(checkIn, fitness);
  const recovery = checkIn.sleep < 7 || checkIn.stress >= 7;
  const note = recovery
    ? "Today is recovery-aware: protect breaks, nourishing meals, and an earlier wind-down."
    : "You have room for a focused, balanced day—keep meals and breaks protected.";
  const schedule = [
    "Morning: water, breakfast, and a quick priorities check.",
    fitness.duration === 0 ? "Movement: no workout scheduled today." : `Movement: ${fitness.duration} min of ${fitness.activity} (${fitness.intensity}).`,
    "Midday: eat lunch away from work and take a short reset.",
    ...checkIn.commitments.map((item) => `Commitment: ${item}`),
    "Evening: prepare tomorrow’s essentials and begin wind-down before bedtime.",
  ];

  renderPanel("#momo-result", "Momo · Your day", [note], schedule);
  renderPanel("#trainer-result", "Trainer · Movement", [`${fitness.duration} minutes · ${fitness.activity}`, `${fitness.intensity} intensity`, fitness.guidance], fitness.coaching);
  renderPanel("#chef-result", "Chef · Meals", [`${checkIn.diet} · ${checkIn.location}`], [...meals.meals, `Restock: ${meals.groceries.join(", ")}`]);
  result.hidden = false;
  result.focus({ preventScroll: true });
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});

updateTimeMode();
showScreen(location.hash === "#planner" ? "planner" : "home");
