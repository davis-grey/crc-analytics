# Implementation notes — 25 October 2026

## Completed

- Consolidated three first-tournament individual JSON records from the original, unchanged published aggregate: all seven `data/matches/*.json` files are now authoritative.
- Introduced tournament metadata (`data/tournaments.json`) and completely replaced the two manually maintained tournament cards with a single reusable card template. All player achievements now derive from actual match innings / official awards.
- Added deterministic validation + build of `data/all_matches.json` and `data.js` (no double maintenance).
- Added a match draft generator and explicit roster aliases (preserving Savio/Savio Lobo distinction).
- Split most statistical rules/aggregations from `app.js` into `stats.js`.
- Corrected cricket overs arithmetic in match economy and season MVP economy bonus. Bowling-over leaderboard sorts by legal balls.
- Unified season fielding aggregation with per-match dismissal parsing; stumpings now count in season awards as well.
- Fixed double overview rendering, redundant mobile tab callbacks and player histories ignoring active tournament/format filters.
- Changed worm/Manhattan chart labels and data lengths to reflect actual innings, not hardcoded five overs.
- Made tournament cards and five-stat mobile profile grids more responsive; pinned icon and chart libraries.
- Added data validation tests, historical MVP regression snapshots, synthetic third-tournament rendering tests and GitHub Actions checks.

## Not changed automatically

- No correction was guessed for the **four historical scorecard exceptions** documented in `data/DATA_QUALITY.md`.
- No existing individual score or MVP award was intentionally changed.
- Full end-to-end browser/device checks, a real scorecard OCR/importer, name-to-ID record migration, and full render-layer security hardening remain outside this iteration.

## Recommended review before merging

1. [Resolved 25 October] Review the four scorer warnings and the changed tournament highlighting text.
2. Run the commands in README and open `index.html` on phone/desktop.
3. Publish to a preview branch or GitHub Pages preview before replacing the club's live site.

## 2026-10-25 — Team confirmation & Pixel 9 Pro mobile polish

- Corrected CSK S3 fixture formats to eight-a-side. Added Rifaz to the Waterford XI and Joy D to the BD Tigers XI; neither batting/bowling figures nor MVP point values were changed.
- Fixed the two false-positive batting-ball warnings caused by no-balls; validation now allows a batter-ball count between legal balls and legal balls + no-balls.
- Added regression tests for CSK match appearances, no-ball checks and eight-a-side format consistency. Updated season appearance snapshot (Joy D 4 career matches across both tournaments; Rifaz 3).
- Mobile layout improvements based on Pixel 9 Pro screenshots: compact detail spacing, swipe affordance and scroll-to-active for the five match tabs, scorecard horizontal-scroll hints and table width, long bowler name handling, better ball-by-ball header wrapping, and tightened small-screen branding.
- Corrected stale homepage captions implying only the Nemo tournament had been played.
- Added `SCORECARD_IMPORT.md` with reproducible instructions for Stumps PDFs and CricAce PDFs plus innings ball-by-ball screenshots.
- Layout polish is source-based and review of the supplied screenshots; screenshots of this updated build have not yet been verified with external CDN styling in a networked mobile browser.

## 2026-10-25 — Match-awards badge alignment

- On phone widths, podium cards place performance details on a separate right-aligned row, leaving player names and winner badges unobstructed. On wider screens the cards return to a two-column layout.
- All first-place badges now simply read **WINNER**, including tied first places; tied gold medals are preserved. Multi-player spotlight cards list the names without an additional “Joint Winners” suffix. The same shared component handles MVP, batting, bowling and fielding podiums for every match.
- Podium ranks now handle ties between second and third as well as ties for first. Added rendering checks for every match.
