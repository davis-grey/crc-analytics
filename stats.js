// CRC cricket statistics, identity helpers and pure calculations.
// Loaded before app.js: declarations reference app state only when called.

// CRC MVP v2.0: the only production scoring implementation.
const MVP_WEIGHTS = Object.freeze({
  RUN: 1, FOUR: 1, SIX: 2, MILESTONE: 5,
  WICKET: 20, MAIDEN: 12, DOT_BALL: 1,
  RUNS_SAVED: 1.5, CATCH: 10, RUNOUT: 15, STUMPING: 12
});

function getMatchMvpContext(match) {
  // Scheduled limit, never the overs actually used by a shortened chase.
  const limit = match.scheduledOvers ?? Number((match.format || '').match(/(\d+(?:\.\d+)?)\s*overs?\b/i)?.[1]);
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isInteger(limit * 6)) {
    throw new Error(`Missing or invalid scheduled overs for ${match.id}`);
  }
  const runs = match.innings.reduce((sum, inn) => sum + inn.runs, 0);
  const legalBalls = match.innings.reduce((sum, inn) => sum + oversToBalls(inn.overs), 0);
  if (!legalBalls && runs) throw new Error(`Cannot calculate match baseline without legal balls: ${match.id}`);
  const rpb = legalBalls ? runs / legalBalls : 0;
  return { scheduledOvers: limit, runs, legalBalls, rpb, rpo: rpb * 6 };
}

function calculateBattingImpact(b, baseline) {
  const milestonePts = MVP_WEIGHTS.MILESTONE * (
    Number(b.runs >= baseline.scheduledOvers * 3) + Number(b.runs >= baseline.scheduledOvers * 5));
  const strikeRateImpact = b.runs - b.balls * baseline.rpb;
  return { milestonePts, strikeRateImpact,
    batPts: b.runs * MVP_WEIGHTS.RUN + b.fours * MVP_WEIGHTS.FOUR + b.sixes * MVP_WEIGHTS.SIX
      + milestonePts + strikeRateImpact };
}

function calculateBowlingImpact(b, baseline) {
  const runsSavedImpact = MVP_WEIGHTS.RUNS_SAVED * (oversToBalls(b.overs) * baseline.rpb - b.runs);
  return { runsSavedImpact, bowlPts: b.wickets * MVP_WEIGHTS.WICKET
    + b.dots * MVP_WEIGHTS.DOT_BALL + b.maidens * MVP_WEIGHTS.MAIDEN + runsSavedImpact };
}

function calculateFieldingImpact(f) {
  return f.catches * MVP_WEIGHTS.CATCH + f.runouts * MVP_WEIGHTS.RUNOUT + f.stumpings * MVP_WEIGHTS.STUMPING;
}

// Only floating-point representation noise is treated as equal. Display rounding
// never determines rank: 10.04 and 10.03 are different even if both show 10.0.
function sameMvpPoints(a, b) {
  return Math.abs(a - b) <= Number.EPSILON * 16 * Math.max(1, Math.abs(a), Math.abs(b));
}

function rankByPoints(list, key) {
  return [...list].sort((a, b) => sameMvpPoints(a[key], b[key])
    ? a.name.localeCompare(b.name) : b[key] - a[key]);
}

function getCompetitionRanking(list, key, maxRank = Infinity) {
  let place = 0;
  return list.map((item, index) => {
    if (!index || !sameMvpPoints(item[key], list[index - 1][key])) place = index + 1;
    return { item, place };
  }).filter(row => row.place <= maxRank);
}

function getPointWinners(list, key) {
  return list.length ? list.filter(p => sameMvpPoints(p[key], list[0][key])) : [];
}

function formatMvpPoints(points, signed = false) {
  const value = points.toFixed(1);
  // Avoid confusing '-0.0' and '+-x' displays without touching the score.
  const display = value === '-0.0' ? '0.0' : value;
  return signed && points >= 0 ? `+${display}` : display;
}

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

  const baseline = getMatchMvpContext(match);

  // Eligible discipline lists contain players with recorded activity in that discipline.
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
      isNotOut,
      ...calculateBattingImpact({ runs, balls, fours, sixes }, baseline)
    };
  });

  // Bowler-credited wickets come from the bowling scorecard, not innings wickets.
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
      economyNum: balls > 0 ? Number(econ) : Infinity,
      ...calculateBowlingImpact({ ...bw, wickets: bw.wickets || 0, dots: bw.dots || 0, maidens: bw.maidens || 0 }, baseline)
    };
  });

  // 3. Top CRC Fielders (catches, run-outs, stumpings in opponent innings)
  const fieldingMap = {};
  (oppInn?.batting || []).forEach(b => {
    const d = b.dismissal || '';
    if (d.includes('c ') && !d.includes('c & b')) {
      const fm = d.match(/^c (.+?) b /i);
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
      const sm = d.match(/^st (.+?) b /i);
      if (sm && sm[1]) {
        const sn = normalizePlayerName(sm[1].trim());
        if (!fieldingMap[sn]) fieldingMap[sn] = { name: sn, catches: 0, runouts: 0, stumpings: 0, total: 0 };
        fieldingMap[sn].stumpings += 1;
        fieldingMap[sn].total += 1;
      }
    }
  });
  const fielders = Object.values(fieldingMap).map(f => ({ ...f, fieldPts: calculateFieldingImpact(f) }));

  const playerMap = {};
  const player = name => playerMap[name] ||= {
    name, batPts: 0, bowlPts: 0, fieldPts: 0, totalPts: 0,
    runs: 0, balls: 0, wkts: 0, overs: '0', catches: 0, runouts: 0, stumpings: 0
  };
  // Include recorded participants with no scored activity: their contribution is
  // exactly zero, which can outrank a negative contribution. No unused reserves.
  (match.crcPlayingXI || []).forEach(name => player(normalizePlayerName(name)));
  batters.forEach(b => Object.assign(player(b.name), { batPts: b.batPts, runs: b.runs, balls: b.balls }));
  bowlers.forEach(b => Object.assign(player(b.name), { bowlPts: b.bowlPts, wkts: b.wickets, overs: b.overs }));
  fielders.forEach(f => Object.assign(player(f.name), {
    fieldPts: f.fieldPts, catches: f.catches, runouts: f.runouts, stumpings: f.stumpings
  }));
  Object.values(playerMap).forEach(p => { p.totalPts = p.batPts + p.bowlPts + p.fieldPts; });
  const mvps = rankByPoints(Object.values(playerMap), 'totalPts');
  const rankedBatters = rankByPoints(batters, 'batPts');
  const rankedBowlers = rankByPoints(bowlers, 'bowlPts');
  const rankedFielders = rankByPoints(fielders, 'fieldPts');
  const topBatterWinners = getPointWinners(rankedBatters, 'batPts');
  const topBowlerWinners = getPointWinners(rankedBowlers, 'bowlPts');
  const topFielderWinners = getPointWinners(rankedFielders, 'fieldPts');
  const matchMvpWinners = getPointWinners(mvps, 'totalPts');

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
    baseline,
    batters: rankedBatters,
    bowlers: rankedBowlers,
    fielders: rankedFielders,
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
    }

    // Tally CRC Match Awards for this match (crediting all tied/joint winners)
    const matchAwards = getMatchCrcAwards(match);
    matchAwards.mvps.forEach(score => {
      if (!stats[score.name]) stats[score.name] = createEmptyPlayerStat(score.name);
      stats[score.name].mvpPoints += score.totalPts;
    });
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

