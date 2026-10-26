# Import a tournament or match — CricAce / Stumps

The app stores match records as **one canonical JSON file per match**. AI is used to read source material, not to modify application architecture. Keep the original PDFs and screenshots accessible when correcting a score.

## Source material to provide

**Stumps**: normally a PDF scorecard containing innings, batting/bowling, extras and possibly delivery details. Check whether deliveries are actually included; if not, request a ball-by-ball export or flag the over progression as unavailable.

**CricAce**: PDF for the full scorecard **plus screenshots covering ball-by-ball details of both innings**. Include the scorecard and all delivery screenshots (in order), ensuring the first and last over are visible. The PDF is the source for score totals and player names; ball-by-ball screenshots are the source for over runs, wickets and delivery events. Where they disagree, ask the analyst instead of guessing.

Different apps may use different abbreviations or rules. Do not assume over limits, whether a match is 7- or 8-a-side, the number of players who participated, substitutions, or POTM just from the tournament name. For CSK S3 specifically, the four completed fixtures were **8-a-side** (no substitutes), not 7-a-side.

## Repeatable Antigravity instruction

Copy the following when importing new matches:

> Import the attached scorecards into CRC Analytics using `SCORECARD_IMPORT.md` and the existing canonical schema under `data/matches/`. Use the provided PDF(s), and for CricAce also the ordered ball-by-ball screenshots for both innings. Add only new match JSON records and, if necessary, updates to `data/tournaments.json` or `data/players.json`. Reuse stable player IDs / aliases; Savio and Savio Lobo are different players. NEVER edit `app.js`, `stats.js`, `index.html`, generated `data.js` or `data/all_matches.json` by hand. Do not invent unrecorded overs, extras, wicket dismissals, awards, lineups, tosses or fields. List unresolved questions before finalising. Verify batting runs + extras equal innings totals; confirm score, wickets, legal deliveries, innings winner, bowlers, over progression and fall of wickets against the PDF and images. Validate the match's participant list (actual participants, not unused reserves), match format and over limits. Run build and all tests. Show me a small import summary and every uncertainty needing confirmation.

## Validation checklist

1. Register a new tournament once in `data/tournaments.json`, not in UI code. Copy the published tournament's full name and season in each match entry.
2. Use one match file in `data/matches/` per actual fixture with a unique slug `id`. No duplicate scores in other JSON files.
3. Confirm match format and eligible **actual players**. Count all who played, including participating substitutes, but not unused reserves. The `crcPlayingXI` field currently stores all participants despite its historical name.
4. Resolve player names via `data/players.json` first. Ask about ambiguous identities. Distinguish `Savio Lobo` from `Savio`/`Savio Rodrigues` and `Joy D` from `Joyvin`.
5. Check both innings' total runs, wickets, overs and extras against the source. **1.4 overs = 10 legal balls**. Wides do not count as batter balls; no-balls may count as batter balls depending on scoring convention. Don't decimalise overs.
6. Validate bowling figures, maidens, dots and dismissal crediting, including assisted run-outs, caught-and-bowled, stumpings and not-outs. Do not claim a catch unless it is in the source.
7. Build over progression from ball-by-ball only if supplied; sequence includes wides/no-balls, which do not add legal deliveries. Do not manufacture a ball sequence to match aggregate scores.
8. For official POTM use the scorer's award, not our calculated MVP. Leave unknown facts explicitly unresolved rather than guessing.
9. Run:

   ```bash
   python scripts/build_data.py
   python scripts/validate_data.py
   python -m unittest discover -s tests -v
   node tests/test_app.cjs
   node tests/test_mvp_v2.cjs
   ```

10. Review a preview before merging. The website dynamically updates tournament cards, season stats, leaderboards and player profiles without changes to rendering code.

## If anything cannot be read

Do not commit a half-invented match just to pass validation. Save your extraction in `_drafts/` (git-ignored), identify the exact screenshot / PDF page needed, and request that specific missing item. Some fields (e.g. over progression) can be unavailable in a legitimate source; only omit those if the current renderer and schema support that omission correctly.

## MVP v2.0 input requirements

Follow [MVP methodology](docs/MVP_METHODOLOGY.md). Import facts, never stored MVP points or inferred winners. Confirm the scheduled innings limit in `format` (`5 overs`, `4 overs`, etc.) or numeric `scheduledOvers`; the validator rejects an unknown limit. For milestones this is independent of the overs actually used in a chase.

Preserve both innings' total runs (including extras), actual legal overs, each batter's recorded balls faced, bowler runs conceded, bowler-credited wickets, dots and maidens. Wides/no-balls affect runs but not legal deliveries; do not rewrite batter balls merely to equal legal balls. Byes/leg-byes must follow the scorer's bowling-concession convention. Do not credit a run-out as a bowling wicket. Identify fielders from the dismissal source; preserve caught-and-bowled, catches, named run-outs and stumpings. Flag unknown fielders rather than guessing. Shared run-outs retain the existing full-credit-per-named-fielder convention; raise uncertain attribution for review.

Keep official POTM as supplied, even when a different player leads statistical MVP. It contributes zero points. Negative calculated points are legitimate; never adjust scorecard facts to eliminate them or match a reference expectation.
