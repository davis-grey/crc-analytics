# CRC MVP methodology

## Current calculation: v2.0

Effective for current calculated statistics, including recalculation of all historical matches. Source scorecards and official awards are unchanged. `stats.js` is the **only production scoring engine**. `getMatchCrcAwards` supplies match points and discipline rankings; `calculateSeasonStats` sums those unrounded match totals. Views never implement their own scoring formula.

### Match context

- Match RPB = sum of both innings' **total runs, including extras**, divided by sum of both innings' **legal deliveries**.
- Match RPO = Match RPB × 6.
- Convert cricket overs to deliveries: 1.4 = 10, 3.5 = 23, 0.1 = 1. Wides/no-balls do not increase legal deliveries.
- Batting impact uses the scorecard's recorded balls faced, which may include no-ball deliveries. Do not substitute legal balls or infer batter deliveries from overs.
- Scheduled limit comes from numeric `scheduledOvers` if supplied, otherwise the explicit `N overs` text in the canonical match `format`. No inference from actual innings length or another match. Missing/invalid limits fail validation.
- Existing fixtures: first six are scheduled for five overs; the Ashbourne semi-final is four overs. Short chases do not reduce milestone thresholds.

### Batting

`runs + fours + 2 × sixes + milestones + [runs − balls faced × Match RPB]`

Milestones are additive: +5 when runs ≥ scheduled overs × 3, and +5 more when runs ≥ scheduled overs × 5. For five overs these are 15 and 25; for four overs, 12 and 20.

### Bowling

`20 × wickets + dots + 12 × maidens + 1.5 × [legal balls bowled × Match RPB − runs conceded]`

Use **bowler-credited wickets** and **bowling runs conceded** from the scorecard. Run-outs do not give bowler wickets. Charged wides/no-balls remain in conceded runs; byes/leg-byes are included in the innings baseline but excluded from bowling runs when the scorer excludes them. No fixed economy bonus or multi-over multiplier. Recorded dot balls and maidens are used; wicket deliveries are not guessed to be additional dots.

### Fielding

Catch +10; run-out +15; stumping +12. Caught-and-bowled earns a wicket through bowling figures and a catch through dismissal credit. Existing dismissal conventions are preserved. When a run-out names multiple credited fielders separated by `/`, each gets +15 under the existing import convention; no sharing fraction has been specified. Unnamed run-outs cannot be assigned a fielder. None of the seven fixtures has a shared CRC run-out credit.

### Totals and rankings

Statistical match MVP = batting + bowling + fielding. Official POTM contributes **zero** points, and remains a separate count and award. Season MVP = sum of unrounded match totals. Orange Cap = runs; Purple Cap = wickets, unchanged.

Top Batter, Bowler and Fielder use their respective impact points, not raw runs, wickets or dismissal counts. A discipline list contains players with recorded activity in it; a non-bowler cannot win Top Bowler by having no bowling record. The match MVP list includes every recorded participant, including those with zero activity, whose contribution is zero. Only players with appearances in the selected matches enter season MVP standings; unused roster members do not outrank negative-scoring players.

Negative disciplines and totals are retained, including negative winners when everyone scores below zero. Keep JS number precision internally, without per-match or per-season rounding. Format point displays to one decimal. Rounded values can look tied while underlying scores differ; rank on full precision. Floating-point representation noise (16 scaled machine epsilons) is treated as equality, not a decimal rounding rule. Alphabetical order is presentation only within ties.

Use competition ranks (1, 1, 3); every player tied within the top three ranks appears in the podium. All first-place players receive WINNER, with no joint-winner label. Season ranking and shared leader names follow the same precision/tie policy.

## Historical reference: v1.0 (archived, not executed)

- Batting: run +1, four +1 extra, six +2 extra, score ≥25 +10.
- Bowling: wicket +25, dot +1, maiden +12, economy ≤6 RPO over at least six legal balls +10 per innings.
- Fielding: catch +10, run-out +15 per named participant, stumping +12.
- Official CRC POTM +20.
- Match and season totals rounded to integers; discipline honours ranked mostly on raw runs, wickets/conceded runs and dismissals.

`tests/legacy_stats_snapshot.json` is the unmodified v1 historical output, retained for reference and protection of non-MVP facts (appearances, runs, wickets, official POTM counts). Its old MVP points/rankings must not be compared to v2 as though the methodology were unchanged.

## Verification and known discrepancy

`tests/mvp_v2_audit.py` is an independent **test-only** oracle using exact rational arithmetic and reading canonical match files directly. It is not loaded by the app or build. `tests/test_mvp_v2.cjs` checks every player's score against it and covers focused formula/precision/ranking cases. No expected winner is hardcoded in the application.

Macroom reference: Jenson's bowling contribution is 42.384615..., but the opposition batting record separately contains `runout (Jenson)`. His complete statistical MVP is **57.384615... = 57.4**, including +15 fielding. The supplied 42.4 reference omits that run-out. Preserve the record pending any verified correction from the original scorecard. Original PDF/screenshot evidence was not supplied with this implementation request; the audit verifies the canonical JSON, not fresh extraction from scorecards.

## Future enhancement (parked)

**Average MVP Points per Appearance / Most impactful player per match** remains a documented future enhancement. It is not calculated, exposed in the UI, or implemented in this release.
