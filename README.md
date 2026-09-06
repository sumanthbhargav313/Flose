[Experience Flose](https://sumanthbhargav313.github.io/Flose/)

# Flose

A friend who stays close. Momo coordinates your daily rhythm, movement, and meals.
Select **Build my day** to create a plan in your browser. Check-ins are never uploaded;
profiles and up to 90 recommendations per name-and-code pair are remembered in that browser only.

## Remembered profiles — September 6, 2026

- Enter a name and a private four-character code, or choose an anonymous tryout. New
  name-and-code pairs complete the full setup once; returning profiles see only sleep,
  stress, mood, and today's commitments unless they edit saved preferences.
- The pair is unique in this browser, so people with the same name can use different
  codes and receive separate stable Momo placeholders, preferences, and histories.
- Returning profiles show check-in count, average sleep/stress, frequent movement, and
  the latest recommendation. Profile history stays in browser `localStorage` and is
  capped at 90 events.
- Chef uses the latest saved meal recommendation to rotate toward different meals on the
  next plan, without relaxing diet, budget, cooking-time, or locality constraints.
- Codes may contain letters, numbers, or special characters and are stored as salted
  PBKDF2 hashes, never plain text. There is currently no recovery or code-change flow.
  This remains local convenience protection, not global or cross-device authentication.
- Anonymous plans are not saved. URL routing and tab-scoped session state keep the user
  in the same planner step after refresh. Chrome is the default validation browser.

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

The current release was checked with 163 Python tests, 75 cross-runtime meal scenarios,
currency boundaries, desktop/mobile browser interactions, and a real local-model
Streamlit submission.
