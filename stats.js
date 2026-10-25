// CRC cricket statistics, identity helpers and pure calculations.
// Loaded before app.js: declarations reference app state only when called.

// Club MVP Formula Constants
const MVP_WEIGHTS = {
  RUN: 1.0,
  FOUR: 1.0,
  SIX: 2.0,
  MILESTONE_25: 10.0,
  WICKET: 25.0,
  MAIDEN: 12.0,
  DOT_BALL: 1.0,
  CATCH: 10.0,
  RUNOUT: 15.0,
  STUMPING: 12.0,
  ECONOMY_BONUS: 10.0, // at most 6.0 runs/over (min 1 over)
  POTM_BONUS: 20.0     // only for CRC players
};


function normalizePlayerName(name) {
  if (!name) return '';
  const clean = String(name).replace(/\s*\((?:C|Wk|c|wk)\)/gi, '').trim();
  const match = playersData.find(p => [p.name, ...(p.aliases || [])]
    .some(alias => alias.toLowerCase() === clean.toLowerCase()));
  // Unknown opponent names remain unmodified. CRC aliases must be registered
  // explicitly in data/players.json (validated during every build).
  return match ? match.name : clean;
}

function isCrcTeam(inn) {
  return inn.team.includes('CORK ROYAL') || inn.shortName === 'CRC';
}

function isCrcPlayer(playerName) {
  if (!playerName) return false;
  const clean = normalizePlayerName(playerName).toLowerCase();
  return playersData.some(p => p.name.trim().toLowerCase() === clean);
}

function getCrcPotm(match) {
  if (match.playerOfTheMatch && isCrcPlayer(match.playerOfTheMatch)) {
    return normalizePlayerName(match.playerOfTheMatch);
  }
  return null; // Don't show if won by opponent
}

function getMatchCrcAwards(match) {
  if (!match || !match.innings) {
    return {
      batters: [], bowlers: [], fielders: [], mvps: [],
      topBatterWinner: null, topBowlerWinner: null, topFielderWinner: null, matchMvpWinner: null,
      topBatterWinners: [], topBowlerWinners: [], topFielderWinners: [], matchMvpWinners: []
    };
  }

  const crcInn = match.innings.find(i => isCrcTeam(i));
  const oppInn = match.innings.find(i => !isCrcTeam(i));

  // 1. Top CRC Batters (ranked by runs, not-out, sixes, fours, SR)
  const batters = (crcInn?.batting || []).map(b => {
    const runs = b.runs || 0;
    const balls = b.balls || 0;
    const fours = b.fours || 0;
    const sixes = b.sixes || 0;
    const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';
    const isNotOut = (b.dismissal || '').toLowerCase().includes('not out');
    return {
      name: normalizePlayerName(b.player),
      runs,
      balls,
      fours,
      sixes,
      sr,
      srNum: parseFloat(sr),
      dismissal: b.dismissal || 'not out',
      isNotOut
    };
  }).sort((a, b) => b.runs - a.runs || (b.isNotOut ? 1 : 0) - (a.isNotOut ? 1 : 0) || b.sixes - a.sixes || b.fours - a.fours || b.srNum - a.srNum);

  // 2. Top CRC Bowlers (ranked by wickets, fewer runs, lower economy, maidens, dots)
  const bowlers = (oppInn?.bowling || []).map(bw => {
    const balls = oversToBalls(bw.overs);
    const econ = balls > 0 ? (bw.runs * 6 / balls).toFixed(2) : '-';
    return {
      name: normalizePlayerName(bw.bowler),
      overs: bw.overs,
      maidens: bw.maidens || 0,
      runs: bw.runs || 0,
      wickets: bw.wickets || 0,
      dots: bw.dots || 0,
      economy: econ,
      economyNum: balls > 0 ? Number(econ) : Infinity
    };
  }).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs || b.dots - a.dots || a.economyNum - b.economyNum || b.maidens - a.maidens);

  // 3. Top CRC Fielders (catches, run-outs, stumpings in opponent innings)
  const fieldingMap = {};
  (oppInn?.batting || []).forEach(b => {
    const d = b.dismissal || '';
    if (d.includes('c ') && !d.includes('c & b')) {
      const fm = d.match(/c ([^b]+) b /);
      if (fm && fm[1]) {
        const fn = normalizePlayerName(fm[1].trim());
        if (!fieldingMap[fn]) fieldingMap[fn] = { name: fn, catches: 0, runouts: 0, stumpings: 0, total: 0 };
        fieldingMap[fn].catches += 1;
        fieldingMap[fn].total += 1;
      }
    }
    if (d.includes('c & b ')) {
      const bn = normalizePlayerName(d.replace('c & b ', '').trim());
      if (!fieldingMap[bn]) fieldingMap[bn] = { name: bn, catches: 0, runouts: 0, stumpings: 0, total: 0 };
      fieldingMap[bn].catches += 1;
      fieldingMap[bn].total += 1;
    }
    if (/run\s?out/i.test(d)) {
      const rm = d.match(/run\s?out\s*\(([^)]+)\)/i);
      if (rm && rm[1]) {
        rm[1].split('/').forEach(fn => {
          const cleanN = normalizePlayerName(fn.trim());
          if (!fieldingMap[cleanN]) fieldingMap[cleanN] = { name: cleanN, catches: 0, runouts: 0, stumpings: 0, total: 0 };
          fieldingMap[cleanN].runouts += 1;
          fieldingMap[cleanN].total += 1;
        });
      }
    }
    if (d.includes('st ')) {
      const sm = d.match(/st ([^b]+) b /);
      if (sm && sm[1]) {
        const sn = normalizePlayerName(sm[1].trim());
        if (!fieldingMap[sn]) fieldingMap[sn] = { name: sn, catches: 0, runouts: 0, stumpings: 0, total: 0 };
        fieldingMap[sn].stumpings += 1;
        fieldingMap[sn].total += 1;
      }
    }
  });
  const fielders = Object.values(fieldingMap).sort((a, b) => b.total - a.total || b.catches - a.catches || b.runouts - a.runouts);

  // 4. Match MVP / Impact Ranking (Calculated specifically for this match)
  const playerMap = {};
  batters.forEach(b => {
    if (!playerMap[b.name]) playerMap[b.name] = { name: b.name, batPts: 0, bowlPts: 0, fieldPts: 0, potmPts: 0, totalPts: 0, runs: 0, balls: 0, wkts: 0, overs: '0', catches: 0, runouts: 0 };
    let pts = (b.runs * MVP_WEIGHTS.RUN) + (b.fours * MVP_WEIGHTS.FOUR) + (b.sixes * MVP_WEIGHTS.SIX);
    if (b.runs >= 25) pts += MVP_WEIGHTS.MILESTONE_25;
    playerMap[b.name].batPts = pts;
    playerMap[b.name].runs = b.runs;
    playerMap[b.name].balls = b.balls;
  });
  bowlers.forEach(bw => {
    if (!playerMap[bw.name]) playerMap[bw.name] = { name: bw.name, batPts: 0, bowlPts: 0, fieldPts: 0, potmPts: 0, totalPts: 0, runs: 0, balls: 0, wkts: 0, overs: '0', catches: 0, runouts: 0 };
    let pts = (bw.wickets * MVP_WEIGHTS.WICKET) + (bw.maidens * MVP_WEIGHTS.MAIDEN) + (bw.dots * MVP_WEIGHTS.DOT_BALL);
    const balls = oversToBalls(bw.overs);
    if (balls >= 6 && (bw.runs * 6 / balls) <= 6.0) pts += MVP_WEIGHTS.ECONOMY_BONUS;
    playerMap[bw.name].bowlPts = pts;
    playerMap[bw.name].wkts = bw.wickets;
    playerMap[bw.name].overs = bw.overs;
  });
  fielders.forEach(f => {
    if (!playerMap[f.name]) playerMap[f.name] = { name: f.name, batPts: 0, bowlPts: 0, fieldPts: 0, potmPts: 0, totalPts: 0, runs: 0, balls: 0, wkts: 0, overs: '0', catches: 0, runouts: 0 };
    let pts = (f.catches * MVP_WEIGHTS.CATCH) + (f.runouts * MVP_WEIGHTS.RUNOUT) + (f.stumpings * MVP_WEIGHTS.STUMPING);
    playerMap[f.name].fieldPts = pts;
    playerMap[f.name].catches = f.catches;
    playerMap[f.name].runouts = f.runouts;
    playerMap[f.name].stumpings = f.stumpings || 0;
  });
  const crcPotm = getCrcPotm(match);
  if (crcPotm && playerMap[crcPotm]) {
    playerMap[crcPotm].potmPts = MVP_WEIGHTS.POTM_BONUS;
  }
  Object.values(playerMap).forEach(p => {
    p.totalPts = Math.round(p.batPts + p.bowlPts + p.fieldPts + p.potmPts);
  });
  const mvps = Object.values(playerMap).sort((a, b) => b.totalPts - a.totalPts || b.bowlPts - a.bowlPts || b.batPts - a.batPts);

  // Shared first-place ranking logic
  // Bowlers: share top wickets and least runs conceded
  let topBowlerWinners = [];
  if (bowlers.length > 0 && bowlers[0].wickets > 0) {
    const topW = bowlers[0].wickets;
    const topR = bowlers[0].runs;
    topBowlerWinners = bowlers.filter(b => b.wickets === topW && b.runs === topR);
  } else if (bowlers.length > 0) {
    const topR = bowlers[0].runs;
    topBowlerWinners = bowlers.filter(b => b.wickets === 0 && b.runs === topR);
  }

  // Fielders: share top dismissals (> 0)
  let topFielderWinners = [];
  if (fielders.length > 0 && fielders[0].total > 0) {
    const topTot = fielders[0].total;
    topFielderWinners = fielders.filter(f => f.total === topTot);
  }

  // Batters: share top runs (> 0)
  let topBatterWinners = [];
  if (batters.length > 0 && batters[0].runs > 0) {
    const topR = batters[0].runs;
    topBatterWinners = batters.filter(b => b.runs === topR);
  } else if (batters.length > 0) {
    topBatterWinners = [batters[0]];
  }

  // MVPs: share top points (> 0)
  let matchMvpWinners = [];
  if (mvps.length > 0 && mvps[0].totalPts > 0) {
    const topPts = mvps[0].totalPts;
    matchMvpWinners = mvps.filter(m => m.totalPts === topPts);
  }

  const formatWinner = (winners) => {
    if (!winners || winners.length === 0) return null;
    if (winners.length === 1) return winners[0];
    const winnersLabel = winners.map(w => w.name).join(' & ');
    return { ...winners[0], name: winnersLabel, isJoint: true, winners };
  };

  const topBowlerWinner = formatWinner(topBowlerWinners);
  const topFielderWinner = formatWinner(topFielderWinners);
  const topBatterWinner = formatWinner(topBatterWinners);
  const matchMvpWinner = formatWinner(matchMvpWinners);

  return {
    batters,
    bowlers,
    fielders,
    mvps,
    topBatterWinner,
    topBowlerWinner,
    topFielderWinner,
    matchMvpWinner,
    topBatterWinners,
    topBowlerWinners,
    topFielderWinners,
    matchMvpWinners
  };
}


function getTournamentHighlights(tournamentMatches) {
  const bat = new Map();
  const bowl = new Map();
  const potms = new Map();
  tournamentMatches.forEach(match => {
    const crc = match.innings.find(i => isCrcTeam(i));
    const opposition = match.innings.find(i => !isCrcTeam(i));
    (crc?.batting || []).forEach(b => {
      const name = normalizePlayerName(b.player);
      const record = bat.get(name) || { name, runs: 0, highest: 0, sixes: 0 };
      record.runs += b.runs;
      record.highest = Math.max(record.highest, b.runs);
      record.sixes += b.sixes;
      bat.set(name, record);
    });
    (opposition?.bowling || []).forEach(b => {
      const name = normalizePlayerName(b.bowler);
      const record = bowl.get(name) || { name, wickets: 0 };
      record.wickets += b.wickets;
      bowl.set(name, record);
    });
    const potm = getCrcPotm(match);
    if (potm) {
      const record = potms.get(potm) || { name: potm, count: 0 };
      record.count += 1;
      potms.set(potm, record);
    }
  });
  const batting = [...bat.values()].sort((a, b) => b.runs - a.runs || b.highest - a.highest);
  const bowling = [...bowl.values()].filter(b => b.wickets > 0).sort((a, b) => b.wickets - a.wickets || a.name.localeCompare(b.name));
  const officialAwards = [...potms.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { batting, bowling, officialAwards };
}


function oversToBalls(overs) {
  if (typeof overs === 'string' && overs.includes('.')) {
    const [ov, b] = overs.split('.').map(Number);
    return (ov * 6) + (b || 0);
  }
  const ov = Math.floor(overs);
  const b = Math.round((overs - ov) * 10);
  return (ov * 6) + b;
}

function ballsToOvers(balls) {
  const ov = Math.floor(balls / 6);
  const b = balls % 6;
  return b > 0 ? `${ov}.${b}` : `${ov}`;
}

function calculateSeasonStats() {
  const stats = {};
  const filteredMatches = getFilteredMatches();

  playersData.forEach(p => {
    const cleanName = normalizePlayerName(p.name);
    stats[cleanName] = {
      player: p,
      name: cleanName,
      matches: 0,
      innings: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      highestScore: 0,
      isNotOutHighest: false,
      notOuts: 0,
      wickets: 0,
      ballsBowled: 0,
      overs: '0',
      maidens: 0,
      runsConceded: 0,
      dots: 0,
      bestBowling: { wkts: 0, runs: 999 },
      catches: 0,
      runouts: 0,
      stumpings: 0,
      potmCount: 0,
      mvpPoints: 0,
      recentScores: [],
      awards: {
        topBatter: 0,
        topBowler: 0,
        topFielder: 0,
        matchMvp: 0,
        total: 0
      }
    };
  });

  filteredMatches.forEach(match => {
    const crcPotm = getCrcPotm(match);
    if (crcPotm && stats[crcPotm]) {
      stats[crcPotm].potmCount += 1;
      stats[crcPotm].mvpPoints += MVP_WEIGHTS.POTM_BONUS;
    }

    // Tally CRC Match Awards for this match (crediting all tied/joint winners)
    const matchAwards = getMatchCrcAwards(match);
    (matchAwards.topBatterWinners || (matchAwards.topBatterWinner ? [matchAwards.topBatterWinner] : [])).forEach(w => {
      const n = w.name;
      if (!stats[n]) stats[n] = createEmptyPlayerStat(n);
      stats[n].awards.topBatter += 1;
      stats[n].awards.total += 1;
    });
    (matchAwards.topBowlerWinners || (matchAwards.topBowlerWinner ? [matchAwards.topBowlerWinner] : [])).forEach(w => {
      const n = w.name;
      if (!stats[n]) stats[n] = createEmptyPlayerStat(n);
      stats[n].awards.topBowler += 1;
      stats[n].awards.total += 1;
    });
    (matchAwards.topFielderWinners || (matchAwards.topFielderWinner ? [matchAwards.topFielderWinner] : [])).forEach(w => {
      const n = w.name;
      if (!stats[n]) stats[n] = createEmptyPlayerStat(n);
      stats[n].awards.topFielder += 1;
      stats[n].awards.total += 1;
    });
    (matchAwards.matchMvpWinners || (matchAwards.matchMvpWinner ? [matchAwards.matchMvpWinner] : [])).forEach(w => {
      const n = w.name;
      if (!stats[n]) stats[n] = createEmptyPlayerStat(n);
      stats[n].awards.matchMvp += 1;
      stats[n].awards.total += 1;
    });

    // Determine participating CRC players for this match (counted ONCE per match)
    const matchParticipants = new Set();
    if (Array.isArray(match.crcPlayingXI) && match.crcPlayingXI.length > 0) {
      match.crcPlayingXI.forEach(name => matchParticipants.add(normalizePlayerName(name)));
    } else {
      match.innings.forEach(inn => {
        if (isCrcTeam(inn)) {
          inn.batting.forEach(b => matchParticipants.add(normalizePlayerName(b.player)));
        } else {
          inn.bowling.forEach(bw => matchParticipants.add(normalizePlayerName(bw.bowler)));
        }
      });
    }

    matchParticipants.forEach(playerName => {
      if (!stats[playerName]) {
        stats[playerName] = createEmptyPlayerStat(playerName);
      }
      stats[playerName].matches += 1;
    });

    match.innings.forEach(inn => {
      const isCRC = isCrcTeam(inn);

      if (isCRC) {
        inn.batting.forEach(b => {
          const playerName = normalizePlayerName(b.player);
          if (!stats[playerName]) {
            stats[playerName] = createEmptyPlayerStat(playerName);
          }
          const p = stats[playerName];
          p.innings += 1;
          p.runs += b.runs;
          p.balls += b.balls;
          p.fours += b.fours;
          p.sixes += b.sixes;

          const isNotOut = b.dismissal.toLowerCase().includes('not out');
          if (isNotOut) p.notOuts += 1;

          if (b.runs > p.highestScore || (b.runs === p.highestScore && isNotOut)) {
            p.highestScore = b.runs;
            p.isNotOutHighest = isNotOut;
          }

          p.recentScores.push({ score: b.runs, isNotOut, matchId: match.id, opp: getOppositionName(match) });

          p.mvpPoints += (b.runs * MVP_WEIGHTS.RUN) + (b.fours * MVP_WEIGHTS.FOUR) + (b.sixes * MVP_WEIGHTS.SIX);
          if (b.runs >= 25) p.mvpPoints += MVP_WEIGHTS.MILESTONE_25;
        });
      } else {
        inn.bowling.forEach(bw => {
          const bowlerName = normalizePlayerName(bw.bowler);
          if (!stats[bowlerName]) {
            stats[bowlerName] = createEmptyPlayerStat(bowlerName);
          }
          const p = stats[bowlerName];

          p.ballsBowled = (p.ballsBowled || 0) + oversToBalls(bw.overs);
          p.maidens += bw.maidens || 0;
          p.runsConceded += bw.runs;
          p.wickets += bw.wickets;
          p.dots += bw.dots || 0;

          if (bw.wickets > p.bestBowling.wkts || (bw.wickets === p.bestBowling.wkts && bw.runs < p.bestBowling.runs)) {
            p.bestBowling = { wkts: bw.wickets, runs: bw.runs };
          }

          p.mvpPoints += (bw.wickets * MVP_WEIGHTS.WICKET) +
                         (bw.maidens * MVP_WEIGHTS.MAIDEN) +
                         (bw.dots * MVP_WEIGHTS.DOT_BALL);

          if (oversToBalls(bw.overs) >= 6 && (bw.runs * 6 / oversToBalls(bw.overs)) <= 6.0) {
            p.mvpPoints += MVP_WEIGHTS.ECONOMY_BONUS;
          }
        });

        // Fielding is credited once per match below, from the same scorer used
        // by the Match MVP panel, so they cannot disagree for new dismissals.

      }
    });

    // Share the authoritative dismissal parsing with per-match awards.
    // A stumping now contributes to both match and season MVP points.
    matchAwards.fielders.forEach(f => {
      const p = stats[f.name];
      if (!p) return; // Unknown fielders are reported by the JSON validator.
      p.catches += f.catches;
      p.runouts += f.runouts;
      p.stumpings += f.stumpings;
      p.mvpPoints += f.catches * MVP_WEIGHTS.CATCH
        + f.runouts * MVP_WEIGHTS.RUNOUT
        + f.stumpings * MVP_WEIGHTS.STUMPING;
    });
  });

  Object.values(stats).forEach(p => {
    const outs = p.innings - p.notOuts;
    p.battingAvgNum = outs > 0 ? (p.runs / outs) : (p.runs > 0 ? p.runs : 0);
    p.battingAvg = outs > 0 ? (p.runs / outs).toFixed(1) : (p.runs > 0 ? `${p.runs}.0*` : '-');
    p.strikeRateNum = p.balls > 0 ? ((p.runs / p.balls) * 100) : 0;
    p.strikeRate = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : '-';
    
    p.overs = ballsToOvers(p.ballsBowled || 0);
    p.economyNum = p.ballsBowled > 0 ? (p.runsConceded / (p.ballsBowled / 6)) : 999;
    p.economy = p.ballsBowled > 0 ? (p.runsConceded / (p.ballsBowled / 6)).toFixed(2) : '-';
    p.totalFielding = p.catches + p.runouts + p.stumpings;
    p.mvpPoints = Math.round(p.mvpPoints);
  });

  return stats;
}

function createEmptyPlayerStat(name) {
  return {
    player: { id: name.toLowerCase().replace(/\s+/g, '_'), name: name, role: 'Player', jerseyNumber: '-' },
    name: name,
    matches: 0,
    innings: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    highestScore: 0,
    isNotOutHighest: false,
    notOuts: 0,
    wickets: 0,
    ballsBowled: 0,
    overs: '0',
    maidens: 0,
    runsConceded: 0,
    dots: 0,
    bestBowling: { wkts: 0, runs: 999 },
    catches: 0,
    runouts: 0,
    stumpings: 0,
    potmCount: 0,
    mvpPoints: 0,
    recentScores: [],
    awards: {
      topBatter: 0,
      topBowler: 0,
      topFielder: 0,
      matchMvp: 0,
      total: 0
    }
  };
}

