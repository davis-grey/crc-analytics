# CRC MVP v2.0 — release review

26 October 2026. Review branch: `feature/crc-mvp-v2`. Production is unchanged; do not merge before review.

## Changes

- Central v2.0 engine in `stats.js`; season totals sum unrounded match results.
- Updated impact rankings, tied ranks, winner badges, negative values, player profile/history and explanation modal.
- Current methodology and v1 archive in `MVP_METHODOLOGY.md`. No frameworks/dependencies, historical data edits or average-per-appearance feature.

## Independent calculation

Computed independently with exact fractions from the seven canonical `data/matches/*.json` records, then compared player-by-player and discipline-by-discipline with the JavaScript engine. Points below display one decimal; comparisons and season sums use full precision. Original source PDFs/screenshots were not re-extracted during this change.

| Match | Runs / legal balls | RPB | Scheduled overs | Statistical MVP | Points |
|---|---|---:|---:|---|---:|
| Match #3 vs Macroom Royals | 19 / 39 | 0.487179 | 5 | Jenson | 57.4 |
| Match #2 vs Nemo Rising | 73 / 53 | 1.377358 | 5 | Jenson | 32.1 |
| Match #1 vs Emerging Stars | 40 / 40 | 1.000000 | 5 | Davison | 27.5 |
| Warm-up Round vs Waterford Tigers | 113 / 55 | 2.054545 | 5 | Jenson | 57.0 |
| Pre-Quarter Final vs BD Tigers Cork | 71 / 54 | 1.314815 | 5 | Davison | 52.8 |
| Quarter-Final vs Cork Indians CC | 59 / 52 | 1.134615 | 5 | Srikanth | 30.8 |
| Semi-Final vs Ashbourne Tuskers | 35 / 46 | 0.760870 | 4 | Yash | 21.0 |

## Full match MVP rankings

Every recorded CRC participant is included. Zero activity contributes zero; discipline-only rankings exclude players without a record in that discipline.

### Match #3 vs Macroom Royals

| Rank | Player | Batting | Bowling | Fielding | Total |
|---:|---|---:|---:|---:|---:|
| 1 | Jenson | 0.0 | 42.4 | 15.0 | **57.4** |
| 2 | Srikanth | 0.0 | 25.4 | 10.0 | **35.4** |
| 3 | Savio | 2.5 | 26.9 | 0.0 | **29.5** |
| 4 | Rifaz | 14.1 | 0.0 | 15.0 | **29.1** |
| 5 | Davison | 0.0 | 21.4 | 0.0 | **21.4** |
| 6 | Yash | 0.0 | 4.9 | 10.0 | **14.9** |
| 7 | Shivam | 0.1 | 0.0 | 0.0 | **0.1** |

### Match #2 vs Nemo Rising

| Rank | Player | Batting | Bowling | Fielding | Total |
|---:|---|---:|---:|---:|---:|
| 1 | Jenson | 13.2 | 8.9 | 10.0 | **32.1** |
| 2 | Savio | -1.4 | 17.9 | 0.0 | **16.5** |
| 3 | Yash | -3.5 | 3.4 | 10.0 | **9.9** |
| 4 | Shivam | 0.0 | 0.0 | 0.0 | **0.0** |
| 5 | Joy D | -1.5 | 0.0 | 0.0 | **-1.5** |
| 6 | Srikanth | -5.8 | 3.9 | 0.0 | **-1.9** |
| 7 | Davison | -2.8 | -6.1 | 0.0 | **-8.9** |

### Match #1 vs Emerging Stars

| Rank | Player | Batting | Bowling | Fielding | Total |
|---:|---|---:|---:|---:|---:|
| 1 | Davison | 0.0 | 27.5 | 0.0 | **27.5** |
| 2 | Jenson | 0.0 | 7.5 | 15.0 | **22.5** |
| 3 | Shivam | 15.0 | 0.0 | 0.0 | **15.0** |
| 3 | Yash | 13.0 | 2.0 | 0.0 | **15.0** |
| 5 | Rifaz | 0.0 | 0.0 | 10.0 | **10.0** |
| 6 | Srikanth | 0.0 | 8.5 | 0.0 | **8.5** |
| 7 | Savio | 0.0 | 6.0 | 0.0 | **6.0** |

### Warm-up Round vs Waterford Tigers

| Rank | Player | Batting | Bowling | Fielding | Total |
|---:|---|---:|---:|---:|---:|
| 1 | Jenson | 57.0 | 0.0 | 0.0 | **57.0** |
| 2 | Joyvin | 0.0 | 27.0 | 0.0 | **27.0** |
| 3 | Savio | 0.0 | 7.0 | 0.0 | **7.0** |
| 4 | Rifaz | 0.0 | 0.0 | 0.0 | **0.0** |
| 5 | Yash | 0.0 | -0.5 | 0.0 | **-0.5** |
| 6 | Srikanth | 7.6 | -9.0 | 0.0 | **-1.4** |
| 7 | Avinash | -4.2 | 0.0 | 0.0 | **-4.2** |
| 8 | Davison | 0.0 | -5.9 | 0.0 | **-5.9** |

### Pre-Quarter Final vs BD Tigers Cork

| Rank | Player | Batting | Bowling | Fielding | Total |
|---:|---|---:|---:|---:|---:|
| 1 | Davison | 0.0 | 52.8 | 0.0 | **52.8** |
| 2 | Jenson | 51.3 | 0.0 | 0.0 | **51.3** |
| 3 | Yash | 0.0 | 32.8 | 0.0 | **32.8** |
| 4 | Savio | 0.0 | 30.3 | 0.0 | **30.3** |
| 5 | Joyvin | 0.0 | -4.7 | 10.0 | **5.3** |
| 6 | Avinash | 2.1 | 0.0 | 0.0 | **2.1** |
| 7 | Joy D | 0.0 | 0.0 | 0.0 | **0.0** |
| 8 | Srikanth | 0.0 | -7.2 | 0.0 | **-7.2** |

### Quarter-Final vs Cork Indians CC

| Rank | Player | Batting | Bowling | Fielding | Total |
|---:|---|---:|---:|---:|---:|
| 1 | Srikanth | 13.1 | 17.7 | 0.0 | **30.8** |
| 2 | Davison | 0.0 | 28.7 | 0.0 | **28.7** |
| 3 | Savio | 0.0 | 27.7 | 0.0 | **27.7** |
| 4 | Avinash | 13.5 | 0.0 | 10.0 | **23.5** |
| 5 | Joyvin | 0.0 | 17.7 | 0.0 | **17.7** |
| 6 | Joy D | 0.0 | 0.0 | 10.0 | **10.0** |
| 7 | Yash | 0.9 | 5.7 | 0.0 | **6.6** |
| 8 | Jenson | 0.7 | 0.0 | 0.0 | **0.7** |

### Semi-Final vs Ashbourne Tuskers

| Rank | Player | Batting | Bowling | Fielding | Total |
|---:|---|---:|---:|---:|---:|
| 1 | Yash | 14.7 | 6.3 | 0.0 | **21.0** |
| 2 | Savio | -0.8 | 14.3 | 0.0 | **13.6** |
| 3 | Srikanth | -0.8 | 1.1 | 10.0 | **10.3** |
| 4 | Davison | 0.0 | 5.3 | 0.0 | **5.3** |
| 5 | Avinash | 4.7 | 0.0 | 0.0 | **4.7** |
| 6 | Joy D | 0.5 | 0.0 | 0.0 | **0.5** |
| 7 | Joyvin | -0.8 | 0.0 | 0.0 | **-0.8** |
| 8 | Jenson | -1.8 | 0.0 | 0.0 | **-1.8** |

## Season MVP standings

| Rank | Player | Appearances | MVP points | Official POTM |
|---:|---|---:|---:|---:|
| 1 | Jenson | 7 | 219.2 | 1 |
| 2 | Savio | 7 | 130.6 | 0 |
| 3 | Davison | 7 | 121.0 | 3 |
| 4 | Yash | 7 | 99.7 | 0 |
| 5 | Srikanth | 7 | 74.5 | 0 |
| 6 | Joyvin | 4 | 49.3 | 0 |
| 7 | Rifaz | 3 | 39.1 | 0 |
| 8 | Avinash | 4 | 26.0 | 0 |
| 9 | Shivam | 3 | 15.1 | 0 |
| 10 | Joy D | 4 | 9.0 | 0 |

## Discrepancies and assumptions

- **Macroom:** reference 42.4 is Jenson’s bowling contribution. Canonical opposition dismissal `runout (Jenson)` adds 15 fielding points, giving **57.4**. No data was altered to match the reference. Verify the original scorecard only if that dismissal credit is disputed.
- The six other supplied match-leader references agree to one decimal.
- **Cork Indians:** Srikanth leads statistical MVP (30.8); Davison remains official POTM and leads bowling impact (28.7 vs Savio 27.7, due to his extra dot). Official POTM counts are unchanged.
- Scheduled limits are five overs for six fixtures and four for Ashbourne, from explicit canonical format metadata. No shortening of milestone thresholds for chases.
- Totals use innings runs including extras; legal overs exclude wides/no-balls; batting balls and bowler runs/wickets/dots/maidens remain exactly as recorded.
- Preserve existing full +15 credit for each named fielder in shared run-outs; no shared CRC run-out occurs in these seven matches. Unnamed fielding events are not guessed.
- Match MVP includes confirmed participants with no scored activity at zero; Top Batter/Bowler/Fielder require a discipline record.

## Verification

- JSON build and validation: 7 matches, 0 errors, 0 warnings; generated artifacts unchanged.
- Python pipeline tests: 12 pass.
- Existing JavaScript regression suite: passes; unchanged raw-statistics and POTM counts checked against archived v1 snapshot.
- MVP v2 suite: 10 test groups pass, including independent all-player audit, negative seasons, all-negative match winners, precision ties, tied podiums, milestones, multiple overs, extras, wicket/fielding credit, official award separation and profile/standings rendering.
- JavaScript syntax and Git whitespace checks: pass.
- Existing scorecards, canonical JSON, generated data, v1 snapshot and responsive podium CSS are unchanged.
- Rendered browser/device verification of this review build remains outstanding: this environment blocks local-file browser previews. Browserless UI checks cover labels, values, badges and profile history; they do not establish mobile pixel layout.

## Review and release

Review the formula, Macroom run-out discrepancy and application locally before merging. Run the four existing build/test commands plus `node tests/test_mvp_v2.cjs`. GitHub Actions runs both JavaScript suites and the Python checks on the PR.

**Average MVP Points per Appearance remains parked and unimplemented.**
