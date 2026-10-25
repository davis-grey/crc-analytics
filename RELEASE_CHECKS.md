# Release checks — 25 October 2026

Source: ZIP snapshot supplied by the user, dated 24 October 2026. No changes have been pushed to GitHub.

## Completed checks

- `python scripts/build_data.py`: **PASS**. Rebuilt two derived outputs from canonical match JSON.
- `python scripts/validate_data.py`: **PASS**, with **0 warnings** after team-confirmed CSK lineup correction and no-ball validation fix.
- `python -m unittest discover -s tests -v`: **PASS**, 11 offline data-validation tests.
- `node tests/test_app.cjs`: **PASS**. Historical runs, wickets, MVP points and match awards match the original seven-match snapshot; only the team-confirmed Joy D and Rifaz appearances were updated; tests cover cricket overs (1.4 = 10 balls), aliases, caught-and-bowled, runouts, stumpings, tournament cards, filtering, escaping.
- `node --check app.js` and `node --check stats.js`: **PASS**.
- Synthetic tournament added temporarily to canonical JSON, rebuild + validation + both test suites run: **PASS**. After the simulation, the fixture was removed and derived outputs restored to exactly 7 matches / 2 tournaments.
- Headless Chromium DOM smoke check with external resources removed: **PASS**. Initial overview 7 matches / 4 wins, 2 tournament cards, tournament filter navigation, match detail and player profile rendered without JavaScript page errors.

## Still required before production

- Open the website in a real browser with network access to verify the CDN libraries (Tailwind, Lucide, Chart.js, html2canvas), responsive pixel layouts and poster downloads. Local browser navigation in the review environment was blocked; the DOM smoke check did not load external styling or cover screenshots.
- Review the corrected match appearances on a mobile player profile: Joy D appeared in 3 CSK fixtures, Rifaz in 1 CSK fixture; all CSK fixtures are 8-a-side.
- Review the changes on a test deployment or preview branch before updating your public GitHub Pages branch.

## Preservation statement

The canonical Nemo JSON files were reconciled to the original published aggregate. Existing batting figures, wickets, outcomes, official POTM and derived historical MVP totals have been preserved. New input is not auto-corrected; validation errors stop builds, warnings require human attention.
