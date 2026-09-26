# 🦁 Cork Royal Challengers - Match & Stats Hub

Interactive cricket analytics, match center, player leaderboards, and club honors for **Cork Royal Challengers Cricket Club** (Cork, Ireland).

---

## 🌟 Key Features

- 🏆 **Dedicated Tournaments Section**: Browse each tournament across Season 2026-27 with dedicated standings, win rates, and top performers.
- 🏟️ **Indoor & Outdoor Modes**: Defaults to **All Formats**, with one-click toggles for **Indoor** and **Outdoor**, and tracking for pitch surfaces (*Turf Wicket*, *Matting*, *Astro*).
- 📋 **Match View with Top Navigation (Summary First)**:
  - **Summary (Default)**: Opens immediately with match outcome, CRC Top Batter, CRC Top Bowler, POTM (if CRC), and Fall of Wickets.
  - **Scorecard**: Batting & Bowling tables with a toggle for **Side-by-Side** (Desktop) or **Stacked** (Mobile).
  - **Ball-by-Ball**: Over-by-over ball tokens (`0`, `1`, `4`, `6`, `W`, `Wd`, `N`).
  - **Stats & Charts**: Over-by-over **Worm Chart** (run progression) and **Manhattan Chart** (runs & wickets per over).
- 🎖️ **Player of the Match Rule**: Dedicated honors display exclusively when won by a CRC player (**Davison** vs Emerging Stars, **Jenson** vs Macroom Royals).
- 📊 **Sortable Leaderboard Columns**: Click any column header in the Batting, Bowling, or MVP tables to sort Ascending or Descending (`▲` / `▼`).
- ⭐ **Transparent Club MVP Points System**: Accessible directly in the app via the **"How MVP Points Work"** button.
- 📱 **WhatsApp & Social Poster Generator**: Export match result and POTM graphics formatted for WhatsApp groups and Instagram.

---

## ⚡ How to Run Locally

### Option 1: Double-Click (Zero Setup!)
Simply open [`index.html`](file:///C:/Users/greso/.gemini/antigravity/scratch/cork-royal-challengers/index.html) directly in Google Chrome, Edge, or Safari.

### Option 2: Local Web Server
From the project folder, run:
```bash
python -m http.server 8000
```
Then visit: [http://localhost:8000](http://localhost:8000)

---

## 🛠️ Adding Matches & Making Corrections
Whenever new matches are played or scorer corrections are needed:
1. Export the PDF/scores from Stumps.
2. Provide the scorecard or specify the corrections (e.g. bowler overs, mixed figures).
3. The dataset in `data/` and `data.js` is updated directly and can be deployed in seconds to GitHub Pages / Netlify for the entire team to see!
