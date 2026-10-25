# Data quality & validated tournament appearances

Updated 25 October 2026 after confirmation from a team player and the performance analyst.

## Confirmed tournament rules and participants

- **CSK Indoor Tournament Season 3 is eight-a-side**, not seven-a-side. All four match formats now correctly record eight-a-side, retaining each match's actual over limit.
- **Jenson, Srikanth, Savio, Joyvin, Yash, Avinash and Davison** played all four matches.
- **Joy D** played three CSK matches: BD Tigers, Cork Indians and Ashbourne Tuskers.
- **Rifaz** played one CSK match, against Waterford Tigers.
- **No substitutes** were used in those four matches.
- Appearance counting: all players recorded as participants, including a substitute who **actually takes part** in a future match, count as having played. Merely being available as a reserve does not count.

**This corrected two previously incomplete participant lists**, for Waterford (add Rifaz) and BD Tigers (add Joy D). Match appearances changed accordingly; bowling, batting, MVP, wickets, results and ball-by-ball data have not been altered.

## Deliveries and no-balls

The earlier two warnings about batting balls were false positives. 1.4 overs means **10 legal deliveries**, and 4.4 means **28 legal deliveries**. But no-balls can be included in the batter's ball count without counting as legal deliveries. The affected scorecards report exactly two no-balls, so the extra two batter balls are consistent with the scorecards.

Our source-sensitive validator accepts total recorded batter balls in the inclusive range from legal innings deliveries through legal deliveries plus innings no-balls. If data falls outside that range it warns, allowing the original scorecard to be checked instead of silently changing records. In some scoring apps, an uncredited no-ball may be absent from batter ball counts; do not invent deliveries.

**Current data validation: zero errors and zero warnings.** This is a consistency check, not independent verification of the original scorecards.
