# How CRC MVP Points Work

**CRC Analytics | Statistical scoring guide | Version 2.0**

CRC Analytics measures player performance with the CRC MVP score. This score uses match statistics and the same rules for all players.

The score has three parts: batting impact, bowling impact, and fielding impact. The sum of these parts gives the match MVP score.

This is a CRC scoring system. It is **not** the official CricHeroes MVP formula. The method uses ideas from cricket performance analysis.

> **Important:** An official Player of the Match (POTM) award is a separate honor. It does not add MVP points.

## Quick Reference: Point System at a Glance

| Category | Event / Calculation | MVP Points |
|---|---|---|
| Batting | Each run scored | +1.0 |
| Batting | Boundary bonus (Four / Six) | +1.0 / +2.0 |
| Batting | Milestone 1 (Runs ≥ Scheduled Overs × 3) | +5.0 |
| Batting | Milestone 2 (Runs ≥ Scheduled Overs × 5) | +5.0 more (+10.0 total) |
| Batting | Strike-rate (SR) impact | Runs − (Balls Faced × Match RPB) |
| Bowling | Each bowler-credited wicket | +20.0 |
| Bowling | Each dot ball / maiden over | +1.0 / +12.0 |
| Bowling | Runs saved impact | 1.5 × [(Legal Balls × Match RPB) − Runs Conceded] |
| Fielding | Catch / Stumping / Run-out | +8.0 / +12.0 / +12.0 |
| Honors | Official Player of the Match (POTM) | Tracked separately (0.0 pts) |

## 1. Why CRC uses this method

A run, a wicket, and a catch are different cricket events. A fair score must give credit for these events.

Match conditions also change. Six runs in one over can be excellent in one match and ordinary in another match.

CRC uses the match scoring rate to measure batting speed and bowling economy. This gives the same reference rate to both teams.

The formula gives extra credit for boundaries, batting milestones, dot balls, and maiden overs. These bonuses are deliberate parts of the method.

Some actions receive more than one type of credit. For example, a boundary earns run points and a boundary bonus.

CRC accepts this overlap as part of the scoring method. The result is an impact score, not a pure runs-saved statistic.

The formula does not measure every match situation. For example, it does not calculate the pressure of each delivery.

## 2. Establish the match baseline

The system uses the final scores of both teams. It includes all runs in the official innings totals, including extras.

Only **legal deliveries** count toward the match scoring rate. A wide or no-ball is not a legal delivery.

**Match runs per ball (RPB)** = Both teams' total runs ÷ Both teams' total legal deliveries.

**Match runs per over (RPO)** = Match RPB × 6.

**Example: CRC against Cork Indians CC**

- Cork Indians scored **29 runs from 30 legal balls**.
- CRC scored **30 runs from 22 legal balls**.
- Match runs = 29 + 30 = **59**.
- Match legal balls = 30 + 22 = **52**.
- Match RPB = 59 ÷ 52 = **1.134615...**.
- Match RPO = 1.134615... × 6 = **6.807692...**.

CRC Analytics uses full precision for all internal calculations and rounds values only when displaying them on the page.

## 3. Calculate batting impact

| Batting event | MVP points |
|---|---:|
| Each run scored | +1 |
| Each four | +1 more |
| Each six | +2 more |
| First milestone | +5 |
| Second milestone | +5 more |
| Strike-rate (SR) impact | Signed value from the formula below |

**SR impact** = Batter runs − (Batter balls faced × Match RPB).

**Total batting impact** = Runs + Four bonuses + Six bonuses + Milestone points + SR impact.

### Why use SR impact?

Runs alone do not show how quickly a batter scored. Each delivery is important in a short match.

SR impact compares the batter's runs with the match rate for the same number of balls.

A positive value rewards faster scoring. A negative value records scoring below the match rate.

CRC also gives small bonuses for boundaries. Boundaries are useful in short matches because they score runs quickly.

### How batting milestones work

Milestones use the **scheduled overs per innings**, not the number of overs played in a shortened chase.

- First milestone: Awards **+5** when runs are at least scheduled overs × 3.
- Second milestone: Awards **+5 more** when runs are at least scheduled overs × 5.

| Scheduled overs | First milestone (+5) | Second milestone (+5 more) |
|---:|---:|---:|
| 3 | 9 runs | 15 runs |
| 4 | 12 runs | 20 runs |
| 5 | 15 runs | 25 runs |
| 8 | 24 runs | 40 runs |

This rule sets higher milestones for longer matches. A player can receive both bonuses in one innings.

### Real example: Jenson against BD Tigers

CRC scored 37 runs. BD Tigers scored 34 runs. Both teams bowled a total of 54 legal balls.

Match RPB = 71 ÷ 54 = **1.314814...**.

Jenson scored **29 runs from 18 balls**. He hit **one four and three sixes**.

| Batting component | Calculation | Points |
|---|---|---:|
| Runs | 29 × 1 | +29.0 |
| Four bonus | 1 × 1 | +1.0 |
| Six bonuses | 3 × 2 | +6.0 |
| First milestone | 29 ≥ 15 | +5.0 |
| Second milestone | 29 ≥ 25 | +5.0 |
| SR impact | 29 − (18 × 71 ÷ 54) | +5.3 |
| **Total batting impact** | **Calculated before rounding** | **51.3** |

Jenson scored faster than the match rate. The formula gives him extra points for that speed.

## 4. Calculate bowling impact

| Bowling event | MVP points |
|---|---:|
| Each bowler-credited wicket | +20 |
| Each dot ball | +1 |
| Each maiden over | +12 |
| Runs saved impact | Signed value from the formula below |

**Runs saved impact** = 1.5 × [(Bowler legal balls × Match RPB) − Bowler runs conceded].

**Total bowling impact** = Wicket points + Dot-ball points + Maiden points + Runs saved impact.

### Why use runs saved?

A fixed economy limit does not fit all matches. Conditions and match scoring rates can change.

Runs saved compares a bowler's conceded runs with the match rate for the same number of legal deliveries.

The factor of **1.5** gives economical bowling more weight. The factor is a CRC scoring choice, not a universal cricket standard.

The same calculation also gives a negative value for expensive bowling.

CRC reduced a wicket from **25 points** in the original method to **20 points** in v2.0.

This reduces the advantage from a single wicket in an expensive over. The runs saved calculation also gives that over a negative adjustment.

A maiden over can earn dot-ball points, maiden points, and runs saved points. CRC keeps this extra credit.

A maiden uses six legal deliveries without a run charged to the bowler. It is unusual and valuable in short cricket matches.

### Real example: Davison against BD Tigers

Match RPB = 71 ÷ 54 = **1.314814...**.

Davison bowled **six legal balls**. He took **two wickets** and bowled **four dots**. He conceded **two runs**.

| Bowling component | Calculation | Points |
|---|---|---:|
| Wickets | 2 × 20 | +40.0 |
| Dot balls | 4 × 1 | +4.0 |
| Maiden overs | None | +0.0 |
| Runs saved | 1.5 × [(6 × 71 ÷ 54) − 2] | +8.8 |
| **Total bowling impact** | **Calculated before rounding** | **52.8** |

Jenson scored **51.3 batting points** in the same match. Davison scored **52.8 bowling points**.

These two different performances receive similar scores. Davison leads by about **1.5 points**.

### Why are there no wicket-haul bonuses?

Each wicket already gives **20 points**. Two wickets give **40 points** before other bowling points.

A two-wicket over is an excellent achievement. The app can show it as an award or badge.

The formula gives no extra MVP points for two, three, or more wickets in one match or over.

### Why is there no multi-over multiplier?

An additional over creates more opportunity and more risk. The runs saved calculation already uses legal deliveries.

A separate multiplier can reduce points when a bowler starts a second over. CRC does not use that multiplier.

## 5. Calculate fielding impact

| Fielding event | MVP points |
|---|---:|
| Catch | +8 |
| Stumping | +12 |
| Run-out | +12 |

### Why use these points?

A catch helps complete a wicket. A stumping needs a special wicketkeeping action.

A run-out can create a wicket without a credited bowling wicket. CRC gives that fielding action 12 points.

CRC gives **8 points for a catch**. This keeps catches valuable without making them equal to a bowling wicket.

### How run-out credit works

Some scoring apps record only the fielder who makes the first throw. They do not always name the player who receives the throw.

CRC gives all **12 points** to the primary fielder in the official scorecard. CRC does not estimate other fielders' involvement.

CRC does not use different scores for direct-hit and assisted run-outs.

If no fielder is named on the scorecard, the run-out remains on the team record, but no fielding points are assigned.

A caught-and-bowled dismissal gives a bowler-credited wicket and a catch to the same player when the scorecard confirms both events.

## 6. Calculate the statistical MVP

**Match MVP points** = Batting impact + Bowling impact + Fielding impact.

The app keeps the full values for calculations. It shows final points to one decimal place.

The app keeps negative values. It does not change a negative score to zero.

### Why can a score be negative?

A below-average performance can cost the team runs relative to the match rate. The formula records this difference.

**Example:** A batter scores 8 runs from 12 balls. The match rate is 1.5 runs per ball.

- Base runs = **+8**.
- SR impact = 8 − (12 × 1.5) = **−10**.
- Batting impact = 8 − 10 = **−2**, if there are no other bonuses.

A negative score does not mean that the player made no effort. It reports the result of this scoring method.

The full CRC MVP method is **not** a zero-sum formula. Runs, wickets, boundaries, and other events add positive points.

## 7. Real example: CRC against Cork Indians CC

CRC won the five-over quarter-final. The statistical MVP scores were close.

Match RPB = **59 ÷ 52 = 1.134615...**.

| Statistical rank | Player | Batting impact | Bowling impact | Fielding impact | Total MVP |
|---:|---|---:|---:|---:|---:|
| 1 | **Srikanth** | +13.1 | +17.7 | 0.0 | **30.8** |
| 2 | **Davison** | 0.0 | +28.7 | 0.0 | **28.7** |
| 3 | **Savio** | 0.0 | +27.7 | 0.0 | **27.7** |

### Why Srikanth ranks first

Srikanth scored **10 runs from seven balls**. He hit one four.

His batting impact is **10 + 1 + [10 − (7 × 59 ÷ 52)] = 13.1**.

He also took **one wicket**, bowled **one dot**, and conceded **nine runs in one over**.

His bowling impact is **20 + 1 + 1.5 × [(6 × 59 ÷ 52) − 9] = 17.7**.

His combined score is **30.8**. His batting and bowling contributions put him in first position.

### Why Davison ranks second

Davison took **one wicket**, bowled **three dots**, and conceded **three runs in one over**.

His bowling impact is **20 + 3 + 1.5 × [(6 × 59 ÷ 52) − 3] = 28.7**.

His over was much more economical than the match rate. He finishes second by approximately **2.1 points**.

### Why Savio ranks third

Savio also took **one wicket** and conceded **three runs in one over**. He bowled **two dots**.

His bowling impact is **20 + 2 + 1.5 × [(6 × 59 ÷ 52) − 3] = 27.7**.

Savio and Davison had the same wicket count and runs conceded. Davison receives one more point for an extra dot.

**Official POTM:** Davison received the official Player of the Match award. The award remains on his record.

The official award does **not** change the statistical MVP ranking. The award and the statistical result can identify different players.

Even a small POTM bonus could change the statistical winner. A three-point bonus would put Davison ahead of Srikanth in this match.

CRC records official awards separately. This keeps match honors independent of statistical scoring.

## 8. Read the leaderboards

| App section | Ranking method | Other information shown |
|---|---|---|
| Match MVP | Total MVP impact points | Batting, bowling, and fielding impact |
| Top Batting Performance | Batting impact points | Runs, balls, and strike rate |
| Top Bowling Performance | Bowling impact points | Wickets, overs, and economy |
| Top Fielding Performance | Fielding impact points | Catches, run-outs, and stumpings |
| Season MVP | Sum of match MVP points | Separate POTM award count |
| Orange Cap | Most runs | Batting impact as another column |
| Purple Cap | Most wickets | Bowling impact as another column |

An Orange Cap leader does not have to lead the batting impact ranking. A Purple Cap leader does not have to lead bowling impact.

Traditional statistics and impact points answer different questions, so the app displays both whenever the data is available.

### Ties and display values

The app uses full-precision points to calculate rankings. It rounds the displayed values to one decimal place.

Players with exactly equal calculated points share a ranking. The app shows **WINNER** for all players who share first place.

## 9. What the formula does not measure

The formula uses scorecard events and the combined match scoring rate. It does not calculate the exact value of each match situation.

For example, it gives every bowler-credited wicket 20 points. It does not add points for the batter's reputation or dismissal time.

The same scoring rules apply to three-, four-, five-, and eight-over matches. The batting milestones change with scheduled match overs.

Longer matches can still produce more total points because they contain more deliveries. Raw season totals measure accumulated impact, not impact per appearance.

CRC can add a separate **average MVP points per appearance** leaderboard in a future release. This feature is not part of v2.0.

## 10. Data rules

All rankings use the official scorecard data. CRC Analytics never guesses missing player names, catches, wickets, or overs.

Cricket overs are calculated from legal balls. **3.4 overs means 22 legal balls**, not 3.4 decimal overs.

A wide or no-ball is not a legal delivery. A no-ball can still count as a ball faced by the batter in the source scorecard.

For bowling impact, the calculation uses the runs charged to the bowler in the scorecard rather than the innings total.

Batting milestones use the scheduled overs, while the match baseline and bowling impact use the actual legal deliveries bowled.

---

**Method:** CRC MVP v2.0 | **Status:** Active scoring specification.
