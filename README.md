[Experience Flose](https://sumanthbhargav313.github.io/Flose/)

# Flose

A friend who stays close. Momo coordinates your daily rhythm, movement, and meals.
Select **Build my day** to create a plan in your browser. Check-ins are never uploaded;
profiles and up to 90 recommendations per name are remembered in that browser only.

## Remembered profiles — September 6, 2026

- Enter a name first. New names complete the full setup once; returning names see only
  sleep, stress, mood, and today's commitments unless they choose to edit saved preferences.
- Names are case-insensitively unique in this browser and receive a stable Momo profile
  placeholder. Duplicate registration cannot overwrite the existing browser profile.
- Returning profiles show check-in count, average sleep/stress, frequent movement, and
  the latest recommendation. Profile history stays in browser `localStorage` and is
  capped at 90 events.
- A name is a local convenience identifier, not authentication. On a shared browser,
  someone who knows the name can open that profile; there is no global or cross-device
  uniqueness in this static edition.

## Planner personalization — September 5, 2026

- Personal details: name, adult age, locality/city, height, weight, and food budgets in ₹.
- Wellbeing: sleep hours, stress, and mood, with the existing movement and schedule fields.
- Food: veg, non-veg, Jain, or flexible; cravings; home preparation or outside meals.
- Four meal suggestions with regional context, preparation instructions, ingredient
  quantities, estimated costs, and locality search links.
- A budget panel showing budget, prior spending, estimated plan cost, and projected
  remaining balance. Home plans spread the remaining grocery budget across calendar
  days left in the month; outside plans use the daily balance. Over-budget or
  impractical cooking plans are clearly flagged.

Budgets are projections, not recorded transactions. Rebuilding a plan does not
deduct twice. Enter actual prior spending from receipts each visit. Home costs are
ingredient portions for one adult, not full-pack checkout costs; fuel, equipment,
taxes on outside orders, and delivery are excluded.

Ingredient prices use the [Department of Consumer Affairs retail report](https://fcainfoweb.nic.in/Reports/DB/DBprices.aspx).
These are All-India averages, not local store quotes. A GitHub workflow checks the
source daily and on publication. Failed or invalid lookups retain the verified
snapshot; its date stays visible. Outside prices are planning estimates, not
restaurant quotes. Local availability and final menu prices require confirmation
through the search links. Clicking a search shares the dish/ingredient and location
with the search provider.

This adult wellness catalog does not calculate calorie targets or assess medical
needs and allergies. GitHub Pages runs deterministic companion logic in the browser.
The separate local Python edition also runs the Qwen trainer persona on the user's
machine; the public site does not download or run that model.

The current release was checked with 147 Python tests, 75 cross-runtime meal scenarios,
currency boundaries, desktop/mobile browser interactions, and a real local-model
Streamlit submission.
